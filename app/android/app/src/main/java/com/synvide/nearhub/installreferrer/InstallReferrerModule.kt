package com.synvide.nearhub.installreferrer

import com.android.installreferrer.api.InstallReferrerClient
import com.android.installreferrer.api.InstallReferrerStateListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class InstallReferrerModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "NearHubInstallReferrer"

  @ReactMethod
  fun getInstallReferrer(promise: Promise) {
    val referrerClient = InstallReferrerClient.newBuilder(reactApplicationContext).build()
    var settled = false

    fun resolveOnce(value: String?) {
      if (!settled) {
        settled = true
        promise.resolve(value)
      }
    }

    fun rejectOnce(code: String, message: String, throwable: Throwable? = null) {
      if (!settled) {
        settled = true
        if (throwable != null) {
          promise.reject(code, message, throwable)
        } else {
          promise.reject(code, message)
        }
      }
    }

    referrerClient.startConnection(
      object : InstallReferrerStateListener {
        override fun onInstallReferrerSetupFinished(responseCode: Int) {
          try {
            when (responseCode) {
              InstallReferrerClient.InstallReferrerResponse.OK -> {
                val response = referrerClient.installReferrer
                val referrer = response.installReferrer?.trim()
                resolveOnce(if (referrer.isNullOrEmpty()) null else referrer)
              }
              InstallReferrerClient.InstallReferrerResponse.FEATURE_NOT_SUPPORTED,
              InstallReferrerClient.InstallReferrerResponse.SERVICE_UNAVAILABLE -> {
                resolveOnce(null)
              }
              InstallReferrerClient.InstallReferrerResponse.DEVELOPER_ERROR -> {
                rejectOnce("E_REFERRER_DEVELOPER_ERROR", "Install referrer developer error")
              }
              InstallReferrerClient.InstallReferrerResponse.SERVICE_DISCONNECTED -> {
                resolveOnce(null)
              }
              else -> {
                resolveOnce(null)
              }
            }
          } catch (error: Exception) {
            rejectOnce("E_REFERRER_READ_FAILED", "Failed to read install referrer", error)
          } finally {
            try {
              referrerClient.endConnection()
            } catch (_: Exception) {
              // no-op
            }
          }
        }

        override fun onInstallReferrerServiceDisconnected() {
          resolveOnce(null)
        }
      }
    )
  }
}
