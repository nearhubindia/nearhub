package com.synvide.nearhub.battery

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
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
      promise.resolve(result)
    } catch (error: Exception) {
      promise.reject("E_BATTERY_READ_FAILED", "Failed to read battery diagnostics", error)
    }
  }
}
