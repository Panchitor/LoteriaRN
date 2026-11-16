package com.loteriarn.agencias

import android.os.Build
import android.os.Bundle
import android.content.Intent
import android.media.AudioManager
import android.util.Log
import androidx.core.content.pm.ShortcutInfoCompat
import androidx.core.content.pm.ShortcutManagerCompat
import androidx.core.graphics.drawable.IconCompat
import kotlin.math.roundToInt

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    setTheme(R.style.AppTheme);
    super.onCreate(null)
    try {
      val audio = getSystemService(AUDIO_SERVICE) as AudioManager
      val target = (audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC) * 0.8).roundToInt()
      audio.setStreamVolume(AudioManager.STREAM_MUSIC, target, 0)
      Log.i("LoteriaSetup", "Media volume=${audio.getStreamVolume(AudioManager.STREAM_MUSIC)}/$target fixed=${audio.isVolumeFixed}")
    } catch (error: Exception) {
      Log.w("LoteriaSetup", "No se pudo establecer el volumen multimedia", error)
    }
  }

  override fun onPostResume() {
    super.onPostResume()
    val prefs = getSharedPreferences("launcher_setup", MODE_PRIVATE)
    if (prefs.getBoolean("shortcut_requested", false)) return
    try {
      if (!ShortcutManagerCompat.isRequestPinShortcutSupported(this)) return
      val shortcut = ShortcutInfoCompat.Builder(this, "loteria_tv_home")
        .setShortLabel(getString(R.string.app_name))
        .setIcon(IconCompat.createWithResource(this, R.mipmap.ic_launcher))
        .setIntent(Intent(this, MainActivity::class.java).apply {
          action = Intent.ACTION_VIEW
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        })
        .build()
      if (ShortcutManagerCompat.requestPinShortcut(this, shortcut, null)) {
        prefs.edit().putBoolean("shortcut_requested", true).apply()
      }
    } catch (error: Exception) {
      Log.w("LoteriaSetup", "El launcher no permite agregar el acceso directo", error)
    }
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  /**
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
    */
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish them.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }
}
