package com.loteriarn.agencias

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == "com.loteriarn.agencias.INSTALL_RESULT") {
            val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
            val message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE) ?: "Sin detalle"
            context.getSharedPreferences("ota", Context.MODE_PRIVATE).edit()
                .putString("result", if (status == PackageInstaller.STATUS_SUCCESS) "SUCCESS" else if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) "WAITING_USER" else "ERROR: $message")
                .apply()
            if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
                @Suppress("DEPRECATION")
                val confirmation = intent.getParcelableExtra<Intent>(Intent.EXTRA_INTENT)
                if (confirmation != null) {
                    confirmation.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    try { context.startActivity(confirmation) } catch (_: Exception) {
                        context.getSharedPreferences("ota", Context.MODE_PRIVATE).edit().putString("result", "ERROR: No se pudo abrir la autorización de Android").apply()
                    }
                }
            }
            return
        }
        val i = Intent(context, MainActivity::class.java)
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        context.startActivity(i)
    }
}
