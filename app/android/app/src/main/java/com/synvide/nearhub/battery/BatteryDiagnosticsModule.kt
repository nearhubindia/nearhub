package com.synvide.nearhub.battery

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Build
import android.provider.Settings
import android.net.Uri
import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.telephony.TelephonyManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class BatteryDiagnosticsModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "NearHubBatteryDiagnostics"

  @ReactMethod
  fun read(promise: Promise) {
    try {
      val intent = reactApplicationContext.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
      if (intent == null) {
        promise.reject("E_BATTERY_UNAVAILABLE", "Battery diagnostics are unavailable")
        return
      }
      val result = Arguments.createMap()
      result.putString("androidRelease", Build.VERSION.RELEASE ?: "")
      result.putInt("androidApiLevel", Build.VERSION.SDK_INT)
      result.putString("securityPatch", if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) Build.VERSION.SECURITY_PATCH else "")
      result.putString("buildFingerprint", Build.FINGERPRINT ?: "")
      result.putString("deviceCodeName", Build.DEVICE ?: "")
      result.putString("productName", Build.PRODUCT ?: "")
      result.putString("hardware", Build.HARDWARE ?: "")
      val telephony = reactApplicationContext.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager
      result.putString("networkType", try {
        when (telephony?.dataNetworkType) {
          TelephonyManager.NETWORK_TYPE_NR -> "5G"
          TelephonyManager.NETWORK_TYPE_LTE -> "4G"
          TelephonyManager.NETWORK_TYPE_HSPAP,
          TelephonyManager.NETWORK_TYPE_HSDPA,
          TelephonyManager.NETWORK_TYPE_HSUPA,
          TelephonyManager.NETWORK_TYPE_UMTS,
          TelephonyManager.NETWORK_TYPE_TD_SCDMA -> "3G"
          TelephonyManager.NETWORK_TYPE_GSM,
          TelephonyManager.NETWORK_TYPE_GPRS,
          TelephonyManager.NETWORK_TYPE_EDGE,
          TelephonyManager.NETWORK_TYPE_CDMA,
          TelephonyManager.NETWORK_TYPE_1xRTT -> "2G"
          else -> "UNKNOWN"
        }
      } catch (_: SecurityException) {
        "UNKNOWN"
      })
      val level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
      val scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, 100)
      result.putInt("chargeLevel", if (level >= 0 && scale > 0) (level * 100 / scale) else -1)
      result.putString("health", when (intent.getIntExtra(BatteryManager.EXTRA_HEALTH, -1)) {
        BatteryManager.BATTERY_HEALTH_GOOD -> "GOOD"
        BatteryManager.BATTERY_HEALTH_OVERHEAT -> "OVERHEAT"
        BatteryManager.BATTERY_HEALTH_DEAD -> "DEAD"
        BatteryManager.BATTERY_HEALTH_OVER_VOLTAGE -> "OVER_VOLTAGE"
        BatteryManager.BATTERY_HEALTH_UNSPECIFIED_FAILURE -> "FAILURE"
        else -> "UNKNOWN"
      })
      result.putInt("temperatureC", intent.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, -1) / 10)
      result.putInt("voltageMv", intent.getIntExtra(BatteryManager.EXTRA_VOLTAGE, -1))
      val capacity = intent.getIntExtra("capacity", -1)
      result.putInt("healthPercent", if (capacity in 1..100) capacity else -1)
      result.putInt(
        "batteryCycleCount",
        if (Build.VERSION.SDK_INT >= 34) intent.getIntExtra("android.os.extra.CYCLE_COUNT", -1) else -1
      )
      val usageManager = reactApplicationContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val appOps = reactApplicationContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
      val usageAllowed = appOps.checkOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS,
        android.os.Process.myUid(),
        reactApplicationContext.packageName
      ) == AppOpsManager.MODE_ALLOWED
      result.putBoolean("usageAccessGranted", usageAllowed)
      if (usageAllowed) {
        val end = System.currentTimeMillis()
        val start = end - 30L * 24L * 60L * 60L * 1000L
        val usageHours = usageManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, start, end)
          .sumOf { it.totalTimeInForeground.toDouble() } / (60L * 60L * 1000L)
        result.putDouble("usageHoursLast30Days", usageHours.coerceIn(0.0, 744.0))
      } else {
        result.putDouble("usageHoursLast30Days", -1.0)
      }
      promise.resolve(result)
    } catch (error: Exception) {
      promise.reject("E_BATTERY_READ_FAILED", "Failed to read battery diagnostics", error)
    }
  }

  @ReactMethod
  fun openUsageAccessSettings(promise: Promise) {
    try {
      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
        data = Uri.parse("package:${reactApplicationContext.packageName}")
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      reactApplicationContext.startActivity(intent)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("E_USAGE_SETTINGS_FAILED", "Unable to open usage access settings", error)
    }
  }
}
