package com.synvide.nearhub.display

import android.content.Context
import android.hardware.display.DisplayManager
import android.os.Build
import android.view.Display
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class DisplayCapabilitiesModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "NearHubDisplayCapabilities"

  @ReactMethod
  fun getCapabilities(promise: Promise) {
    try {
      val manager = reactApplicationContext.getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
      val display = manager.getDisplay(Display.DEFAULT_DISPLAY)
      if (display == null) {
        promise.reject("E_DISPLAY_UNAVAILABLE", "Built-in display is unavailable")
        return
      }

      val modes = Arguments.createArray()
      display.supportedModes
        .distinctBy { Triple(it.physicalWidth, it.physicalHeight, Math.round(it.refreshRate)) }
        .forEach { mode ->
          val item = Arguments.createMap()
          item.putInt("width", mode.physicalWidth)
          item.putInt("height", mode.physicalHeight)
          item.putDouble("refreshRate", mode.refreshRate.toDouble())
          modes.pushMap(item)
        }

      val result = Arguments.createMap()
      result.putArray("supportedModes", modes)
      result.putInt("densityDpi", reactApplicationContext.resources.displayMetrics.densityDpi)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        result.putBoolean("hdr", display.isHdr)
        result.putBoolean("wideColorGamut", display.isWideColorGamut)
        val hdrTypes = Arguments.createArray()
        display.hdrCapabilities.supportedHdrTypes.forEach { type -> hdrTypes.pushString(hdrName(type)) }
        result.putArray("hdrTypes", hdrTypes)
      } else {
        result.putNull("hdr")
        result.putNull("wideColorGamut")
        result.putArray("hdrTypes", Arguments.createArray())
      }
      promise.resolve(result)
    } catch (error: Exception) {
      promise.reject("E_DISPLAY_READ_FAILED", "Failed to read display capabilities", error)
    }
  }

  private fun hdrName(type: Int): String = when (type) {
    Display.HdrCapabilities.HDR_TYPE_DOLBY_VISION -> "Dolby Vision"
    Display.HdrCapabilities.HDR_TYPE_HDR10 -> "HDR10"
    Display.HdrCapabilities.HDR_TYPE_HLG -> "HLG"
    Display.HdrCapabilities.HDR_TYPE_HDR10_PLUS -> "HDR10+"
    else -> "HDR-$type"
  }
}
