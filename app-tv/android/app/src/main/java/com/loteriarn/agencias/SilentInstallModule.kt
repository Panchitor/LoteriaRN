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
import java.security.MessageDigest
import java.util.zip.ZipFile

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
    fun getInstallStatus(promise: Promise) {
        val info = Arguments.createMap()
        @Suppress("DEPRECATION")
        val installed = reactContext.packageManager.getPackageInfo(reactContext.packageName, 0)
        info.putString("version", installed.versionName)
        info.putString("result", reactContext.getSharedPreferences("ota", 0).getString("result", "WAITING"))
        promise.resolve(info)
    }

    @ReactMethod
    fun sha256File(filePath: String, promise: Promise) {
        Thread {
            try {
                val file = File(filePath.removePrefix("file://"))
                require(file.exists() && file.isFile) { "El archivo no existe" }
                val digest = MessageDigest.getInstance("SHA-256")
                FileInputStream(file).use { input ->
                    val buffer = ByteArray(65536)
                    var count = input.read(buffer)
                    while (count != -1) {
                        digest.update(buffer, 0, count)
                        count = input.read(buffer)
                    }
                }
                promise.resolve(digest.digest().joinToString("") { "%02x".format(it.toInt() and 255) })
            } catch (e: Exception) {
                promise.reject("SHA256_ERROR", e.message, e)
            }
        }.start()
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

                fun sha256(stream: java.io.InputStream): String = stream.use { input ->
                    val digest = MessageDigest.getInstance("SHA-256")
                    val buffer = ByteArray(65536)
                    var count = input.read(buffer)
                    while (count != -1) {
                        digest.update(buffer, 0, count)
                        count = input.read(buffer)
                    }
                    digest.digest().joinToString("") { "%02x".format(it.toInt() and 255) }
                }
                val sourceHash = sha256(FileInputStream(sourceFile))
                android.util.Log.i("LoteriaOTA", "Downloaded APK bytes=${sourceFile.length()} sha256=$sourceHash")
                ZipFile(sourceFile).use { zip ->
                    require(zip.getEntry("AndroidManifest.xml") != null) { "APK descargada sin AndroidManifest.xml; bytes=${sourceFile.length()} sha256=$sourceHash" }
                }
                @Suppress("DEPRECATION")
                val archive = reactContext.packageManager.getPackageArchiveInfo(sourceFile.absolutePath, 0)
                    ?: throw IllegalArgumentException("Android no puede analizar la APK descargada; bytes=${sourceFile.length()} sha256=$sourceHash")
                require(archive.packageName == reactContext.packageName) { "La APK pertenece a otro paquete: ${archive.packageName}" }

                // 1. Intentar instalación usando la API nativa PackageInstaller (apps de /system/priv-app)
                try {
                    reactContext.getSharedPreferences("ota", 0).edit().putString("result", "WAITING").apply()
                    val packageInstaller = reactContext.packageManager.packageInstaller
                    val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
                    params.setAppPackageName(reactContext.packageName)
                    params.setSize(sourceFile.length())
                    val sessionId = packageInstaller.createSession(params)
                    val session = packageInstaller.openSession(sessionId)

                    val out = session.openWrite("base.apk", 0, sourceFile.length())
                    val input = FileInputStream(sourceFile)
                    val copiedBytes = input.copyTo(out)
                    session.fsync(out)
                    input.close()
                    out.close()

                    require(copiedBytes == sourceFile.length()) { "Copia incompleta a Android: $copiedBytes/${sourceFile.length()} bytes" }
                    val sessionHash = sha256(session.openRead("base.apk"))
                    require(sessionHash == sourceHash) { "APK alterada en sesión $sessionId: origen=$sourceHash sesión=$sessionHash" }
                    android.util.Log.i("LoteriaOTA", "Verified session=$sessionId bytes=$copiedBytes sha256=$sessionHash version=${archive.versionName}")

                    val intent = Intent(reactContext, BootReceiver::class.java)
                    intent.action = "com.loteriarn.agencias.INSTALL_RESULT"
                    val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
                    } else {
                        PendingIntent.FLAG_UPDATE_CURRENT
                    }
                    val pendingIntent = PendingIntent.getBroadcast(reactContext, 0, intent, flags)

                    session.commit(pendingIntent.intentSender)
                    session.close()
                    promise.resolve("INSTALL_REQUESTED session=$sessionId bytes=$copiedBytes sha256=$sessionHash version=${archive.versionName}")
                    return@Thread
                } catch (nativeErr: Exception) {
                    promise.reject("SESSION_ERROR", "Falló la sesión Android: ${nativeErr.message}; bytes=${sourceFile.length()} sha256=$sourceHash", nativeErr)
                    return@Thread
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
