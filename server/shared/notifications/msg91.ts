/**
 * MSG91 SMS Gateway Integration Service
 * Sends SMS via MSG91's API
 *
 * Setup Instructions:
 * 1. Register on MSG91: https://msg91.com/
 * 2. Get your Auth Key from account settings
 * 3. Add AUTH_KEY to .env as MSG91_API_KEY
 * 4. Set sender ID (typically alphanumeric, e.g., "NRHUB")
 *
 * Environment Variables:
 * - MSG91_API_KEY: Your MSG91 authentication key
 * - MSG91_SENDER_ID: Sender ID for SMS (optional, default: "NRHUB")
 * - MSG91_ROUTE: Route type (optional, default: 4 for promotional)
 * - MSG91_ENABLED: Enable/disable service (optional, default: true)
 */

import axios, { AxiosError } from 'axios';

// MSG91 API Configuration
// Using v2 API endpoint which is the current stable version
const MSG91_API_URL = 'https://api.msg91.com/api/v2/send';

export interface MSG91Config {
  apiKey: string;
  senderId: string;
  route?: number;
  enabled: boolean;
}

export interface MSG91Response {
  success: boolean;
  messageId?: string;
  data?: any;
  error?: string;
  statusCode?: string;
  requestId?: string;
}

export interface SMSSendRequest {
  phone: string;
  message: string;
  senderId?: string;
  route?: number;
}

class MSG91Service {
  private config: MSG91Config;

  constructor() {
    this.config = {
      apiKey: process.env.MSG91_API_KEY || '',
      senderId: process.env.MSG91_SENDER_ID || 'NRHUB',
      route: parseInt(process.env.MSG91_ROUTE || '4'), // 4 = Transactional
      enabled: process.env.MSG91_ENABLED !== 'false', // default enabled
    };

    if (this.config.enabled && !this.config.apiKey) {
      console.warn('[MSG91] Service enabled but API key not configured');
    } else if (this.config.enabled && this.config.apiKey) {
      console.log('[MSG91] Service initialized and ready');
    }
  }

  /**
   * Check if MSG91 is properly configured
   */
  isConfigured(): boolean {
    return this.config.enabled && !!this.config.apiKey;
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      enabled: this.config.enabled,
      configured: this.isConfigured(),
      senderId: this.config.senderId,
    };
  }

  /**
   * Send OTP via MSG91
   *
   * Example:
   * const response = await msg91.sendOTP({
   *   phone: '919876543210',  // Include country code
   *   otp: '123456'
   * });
   */
  async sendOTP(request: { phone: string; otp: string }): Promise<MSG91Response> {
    // Validate configuration
    if (!this.isConfigured()) {
      console.error('[MSG91] Service not properly configured');
      return {
        success: false,
        error: 'MSG91 service not configured',
      };
    }

    try {
      // Validate phone number
      if (!request.phone) {
        return {
          success: false,
          error: 'Phone number required',
        };
      }

      // Validate OTP
      if (!request.otp || !/^\d{6}$/.test(request.otp)) {
        return {
          success: false,
          error: 'Invalid OTP format (must be 6 digits)',
        };
      }

      // Format message
      const message = this.formatOTPMessage(request.otp);

      // Send SMS
      const response = await this.sendSMS({
        phone: request.phone,
        message,
      });

      return response;
    } catch (error) {
      console.error('[MSG91] Error sending OTP:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send generic SMS via MSG91
   *
   * Example:
   * const response = await msg91.sendSMS({
   *   phone: '919876543210',
   *   message: 'Hello World!'
   * });
   */
  async sendSMS(request: SMSSendRequest): Promise<MSG91Response> {
    try {
      // Validate configuration
      if (!this.isConfigured()) {
        console.error('[MSG91] Service not configured');
        return {
          success: false,
          error: 'MSG91 service not configured',
        };
      }

      // Validate inputs
      if (!request.phone || !request.message) {
        return {
          success: false,
          error: 'Phone number and message are required',
        };
      }

      // Ensure phone number includes country code (91 for India)
      let phoneNumber = request.phone.toString();
      if (!phoneNumber.startsWith('91') && !phoneNumber.startsWith('+91')) {
        phoneNumber = '91' + phoneNumber;
      }
      phoneNumber = phoneNumber.replace(/^\+/, ''); // Remove + if present

      console.log(`[MSG91] Sending SMS to ${phoneNumber}...`);

      // Prepare request parameters
      const params = {
        authkey: this.config.apiKey,
        mobiles: phoneNumber,
        message: request.message,
        sender: request.senderId || this.config.senderId,
        response: 'json', // Request JSON response format
      };

      // Make API request
      const response = await axios.get(MSG91_API_URL, { params });

      console.log('[MSG91] API Response:', response.data);

      // MSG91 v2 API returns different response formats
      const responseData = response.data;

      // Handle direct string response (message ID)
      if (typeof responseData === 'string') {
        const msgId = responseData.trim();
        if (msgId && msgId.length > 0 && !msgId.toLowerCase().includes('error')) {
          return {
            success: true,
            messageId: msgId,
            data: { raw: responseData },
          };
        }
      }

      // Handle JSON object response
      if (responseData && typeof responseData === 'object') {
        // Check for success indicator in response
        const isSuccessful =
          responseData.type === 'success' ||
          responseData.success === true ||
          responseData.status === 'success';

        if (isSuccessful) {
          // Extract message ID from various possible fields
          const messageId =
            responseData.message ||
            responseData.message_id ||
            responseData.MessageID ||
            responseData.msgid ||
            responseData[0]?.message_id ||
            responseData[0]?.msgid ||
            'unknown';

          const reqId = responseData.request_id || responseData[0]?.request_id || '';

          return {
            success: true,
            messageId: messageId.toString(),
            requestId: reqId.toString(),
            data: responseData,
          };
        }
      }

      // If we get here and response status is 200, consider it success
      if (response.status === 200 && responseData) {
        return {
          success: true,
          messageId: typeof responseData === 'string' ? responseData : 'unknown',
          data: responseData,
        };
      }

      return {
        success: false,
        error: 'Unexpected response format from MSG91',
        data: responseData,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<any>;
        console.error('[MSG91] API Error:', {
          status: axiosError.response?.status,
          data: axiosError.response?.data,
          message: axiosError.message,
        });

        return {
          success: false,
          statusCode: axiosError.response?.status?.toString(),
          error: axiosError.response?.data?.error || axiosError.message,
        };
      }

      console.error('[MSG91] Error sending SMS:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Format OTP message
   */
  private formatOTPMessage(otp: string): string {
    return `Your OTP is ${otp}. Do not share with anyone. Valid for 5 minutes.`;
  }
}

// Export singleton instance
export const msg91 = new MSG91Service();
