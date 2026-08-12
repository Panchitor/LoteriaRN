package com.loteriarn.agencias

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import android.content.pm.PackageInstaller
import android.content.Intent
import android.app.PendingIntent
import android.os.Build
import java.io.File
import java.io.FileInputStream
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.DataOutputStream
import java.io.ByteArrayOutputStream
import android.graphics.Bitmap
import android.util.Base64
import android.view.PixelCopy
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import com.facebook.react.bridge.Arguments

class SilentInstallModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "SilentInstall"
    }

    @ReactMethod
    fun getDeviceInfo(promise: Promise) {
        try {
            fun readProperty(name: String): String {
                return try {
                    val process = Runtime.getRuntime().exec(arrayOf("getprop", name))
                    BufferedReader(InputStreamReader(process.inputStream)).readText().trim()
                } catch (_: Exception) { "" }
            }

            var serial = readProperty("ro.serialno")
            if (serial.isBlank() || serial.equals("unknown", true)) serial = readProperty("ro.boot.serialno")
            if (serial.isBlank() || serial.equals("unknown", true)) {
                serial = try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Build.getSerial() else Build.SERIAL
                } catch (_: Exception) { "" }
            }
            if (serial.isBlank() || serial.equals("unknown", true)) {
                val androidId = Settings.Secure.getString(reactContext.contentResolver, Settings.Secure.ANDROID_ID)
                serial = "ANDROID-ID:${androidId ?: "NO-DISPONIBLE"}"
            }

            val info = Arguments.createMap()
            info.putString("androidVersion", "Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})")
            info.putString("deviceModel", "${Build.MANUFACTURER} ${Build.MODEL}".trim())
            info.putString("deviceSerial", serial)
            promise.resolve(info)
        } catch (e: Exception) {
            promise.reject("DEVICE_INFO_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun captureScreen(promise: Promise) {
        val activity = reactContext.currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No hay una actividad disponible para capturar")
            return
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            promise.reject("ANDROID_UNSUPPORTED", "La captura remota requiere Android 8 o superior")
            return
        }

        activity.runOnUiThread {
            try {
                val view = activity.window.decorView
                if (view.width <= 0 || view.height <= 0) throw IllegalStateException("La ventana todavía no tiene dimensiones")
                val bitmap = Bitmap.createBitmap(view.width, view.height, Bitmap.Config.ARGB_8888)
                PixelCopy.request(activity.window, bitmap, { result ->
                    if (result != PixelCopy.SUCCESS) {
                        bitmap.recycle()
                        promise.reject("PIXEL_COPY_FAILED", "PixelCopy devolvió código $result")
                        return@request
                    }
                    try {
                        val maxWidth = 1280
                        val output = if (bitmap.width > maxWidth) {
                            val targetHeight = (bitmap.height * (maxWidth.toFloat() / bitmap.width)).toInt()
                            Bitmap.createScaledBitmap(bitmap, maxWidth, targetHeight, true)
                        } else bitmap
                        val bytes = ByteArrayOutputStream()
                        output.compress(Bitmap.CompressFormat.JPEG, 72, bytes)
                        val encoded = Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP)
                        if (output !== bitmap) output.recycle()
                        bitmap.recycle()
                        promise.resolve(encoded)
                    } catch (e: Exception) {
                        bitmap.recycle()
                        promise.reject("SCREENSHOT_ENCODING_ERROR", e.message, e)
                    }
                }, Handler(Looper.getMainLooper()))
            } catch (e: Exception) {
                promise.reject("SCREENSHOT_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun restartApp(promise: Promise) {
        val activity = reactContext.currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No hay una actividad disponible para reiniciar")
            return
        }
        activity.runOnUiThread {
            try {
                promise.resolve("RESTARTING")
                activity.recreate()
            } catch (e: Exception) {
                promise.reject("RESTART_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun installApk(apkPath: String, promise: Promise) {
        Thread {
            try {
                val sourceFile = File(apkPath)
                if (!sourceFile.exists()) {
                    promise.reject("FILE_NOT_FOUND", "El archivo APK no existe en la ruta: $apkPath")
                    return@Thread
                }

                // 1. Intentar instalación usando la API nativa PackageInstaller (apps de /system/priv-app)
                try {
                    val packageInstaller = reactContext.packageManager.packageInstaller
                    val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
                    val sessionId = packageInstaller.createSession(params)
                    val session = packageInstaller.openSession(sessionId)

                    val out = session.openWrite("update_session", 0, sourceFile.length())
                    val input = FileInputStream(sourceFile)
                    input.copyTo(out)
                    session.fsync(out)
                    input.close()
                    out.close()

                    val intent = Intent(reactContext, BootReceiver::class.java)
                    intent.action = "android.intent.action.MY_PACKAGE_REPLACED"
                    val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
                    } else {
                        PendingIntent.FLAG_UPDATE_CURRENT
                    }
                    val pendingIntent = PendingIntent.getBroadcast(reactContext, 0, intent, flags)

                    session.commit(pendingIntent.intentSender)
                    session.close()
                    promise.resolve("SUCCESS_NATIVE_PACKAGE_INSTALLER")
                    return@Thread
                } catch (nativeErr: Exception) {
                    // Fallback a Root (su) si no tiene privilegios PackageInstaller directos
                }

                // 2. Buscar ejecutable SU disponible en la ROM
                val suCandidates = arrayOf("/system/xbin/su", "/system/bin/su", "/su/bin/su", "/sbin/su", "su")
                var suBinary: String? = null
                for (candidate in suCandidates) {
                    if (candidate == "su" || File(candidate).exists()) {
                        suBinary = candidate
                        break
                    }
                }

                if (suBinary == null) {
                    promise.reject("SU_NOT_FOUND", "No se encontró ejecutable Root (su) en el sistema.")
                    return@Thread
                }

                val targetPath = "/sdcard/update.apk"

                val command = """
                    settings put global install_non_market_apps 1
                    settings put global package_verifier_enable 0
                    cp "${sourceFile.absolutePath}" "$targetPath"
                    chmod 777 "$targetPath"
                    
                    OUT_PM=${'$'}(pm install -r -d -g "$targetPath" 2>&1)
                    echo "PM_RESULT: ${'$'}OUT_PM"
                    
                    if echo "${'$'}OUT_PM" | grep -iq "Success"; then
                        echo "SUCCESS_PM"
                        rm -f "$targetPath"
                        am start -n com.loteriarn.agencias/.MainActivity
                        exit 0
                    fi

                    mount -o remount,rw /system 2>/dev/null || mount -o remount,rw / 2>/dev/null
                    SYS_DIR=${'$'}(ls -d /system/priv-app/Loteria* 2>/dev/null | head -n 1)
                    if [ -n "${'$'}SYS_DIR" ]; then
                        cp "$targetPath" "${'$'}SYS_DIR/"*.apk 2>/dev/null || cp "$targetPath" "${'$'}SYS_DIR/base.apk"
                        chmod 644 "${'$'}SYS_DIR"/*.apk
                    fi
                    
                    OUT_PM2=${'$'}(pm install -r -d -g "$targetPath" 2>&1)
                    rm -f "$targetPath"
                    echo "RETRY_PM_RESULT: ${'$'}OUT_PM2"
                    am start -n com.loteriarn.agencias/.MainActivity
                """.trimIndent()

                val process = Runtime.getRuntime().exec(suBinary)
                val os = DataOutputStream(process.outputStream)
                os.writeBytes(command + "\nexit\n")
                os.flush()

                val stdout = BufferedReader(InputStreamReader(process.inputStream)).readText()
                val stderr = BufferedReader(InputStreamReader(process.errorStream)).readText()
                val exitCode = process.waitFor()

                val fullOutput = "OUT: ${stdout.trim()} | ERR: ${stderr.trim()}"

                if (exitCode == 0 || stdout.contains("Success", ignoreCase = true) || stdout.contains("SUCCESS_PM", ignoreCase = true)) {
                    promise.resolve("SUCCESS: $fullOutput")
                } else {
                    promise.reject("INSTALL_FAILED", "Exit Code: $exitCode | $fullOutput")
                }
            } catch (e: Exception) {
                promise.reject("EXEC_ERROR", e.message, e)
            }
        }.start()
    }
}
