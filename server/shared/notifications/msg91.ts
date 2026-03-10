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
 * - MSG91_ROUTE: Route type (optional; set only if required by your MSG91 account)
 * - MSG91_TEMPLATE_ID: DLT template ID for compliant OTP delivery in India
 * - MSG91_ENABLED: Enable/disable service (optional, default: true)
 */

import axios, { AxiosError } from 'axios';

// MSG91 API Configuration
const MSG91_SMS_API_URL = 'https://api.msg91.com/api/v2/send';
const MSG91_SMS_TEMPLATE_API_URL = 'https://api.msg91.com/api/v2/sendsms';
const MSG91_FLOW_API_URL = 'https://control.msg91.com/api/v5/flow/';

export interface MSG91Config {
  apiKey: string;
  senderId: string;
  route?: number;
  templateId?: string;
  otpTemplateId?: string;
  flowOtpKey?: string;
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
  templateId?: string;
}

class MSG91Service {
  private config: MSG91Config;

  constructor() {
    this.config = {
      apiKey: process.env.MSG91_API_KEY || '',
      senderId: process.env.MSG91_SENDER_ID || 'NRHUB',
      route: process.env.MSG91_ROUTE ? parseInt(process.env.MSG91_ROUTE, 10) : undefined,
      templateId: process.env.MSG91_TEMPLATE_ID || '',
      otpTemplateId: process.env.MSG91_OTP_TEMPLATE_ID || '',
      flowOtpKey: process.env.MSG91_FLOW_OTP_KEY || 'otp',
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
      templateIdConfigured: !!this.config.templateId,
      otpTemplateIdConfigured: !!this.config.otpTemplateId,
    };
  }

  /**
   * Send OTP via MSG91 v5 Flow API
   *
   * Example:
   * const response = await msg91.sendOTP({
   *   phone: '919876543210',  // Include country code
   *   otp: '123456'
   * });
   */
  async sendOTP(request: { phone: string; otp: string }): Promise<MSG91Response> {
    if (!this.isConfigured()) {
      console.error('[MSG91] Service not properly configured');
      return {
        success: false,
        error: 'MSG91 service not configured',
      };
    }

    if (!request.phone) {
      return {
        success: false,
        error: 'Phone number required',
      };
    }

    if (!request.otp || !/^\d{6}$/.test(request.otp)) {
      return {
        success: false,
        error: 'Invalid OTP format (must be 6 digits)',
      };
    }

    const flowTemplateId = this.config.otpTemplateId?.trim();
    if (!flowTemplateId) {
      return {
        success: false,
        error: 'MSG91_OTP_TEMPLATE_ID is required for Flow API',
      };
    }

    let phoneNumber = request.phone.toString();
    if (!phoneNumber.startsWith('91') && !phoneNumber.startsWith('+91')) {
      phoneNumber = '91' + phoneNumber;
    }
    phoneNumber = phoneNumber.replace(/^\+/, '');

    try {
      console.log(`[MSG91] Sending OTP via v5 flow API to ${phoneNumber}...`);
      const response = await axios.post(
        MSG91_FLOW_API_URL,
        {
          template_id: flowTemplateId,
          short_url: '0',
          recipients: [
            {
              mobiles: phoneNumber,
              mobile: phoneNumber,
              phone: phoneNumber,
              otp: request.otp,
              OTP: request.otp,
              var: request.otp,
              var1: request.otp,
              VAR1: request.otp,
              Param1: request.otp,
              numeric: request.otp,
              [this.config.flowOtpKey || 'otp']: request.otp,
            },
          ],
        },
        {
          headers: {
            authkey: this.config.apiKey,
            'content-type': 'application/json',
            accept: 'application/json',
          },
        }
      );

      console.log('[MSG91] Flow API Response:', response.data);
      const responseData = response.data;
      const isSuccessful =
        responseData?.type === 'success' ||
        responseData?.success === true ||
        responseData?.status === 'success';

      if (isSuccessful) {
        const messageId =
          responseData?.message ||
          responseData?.request_id ||
          responseData?.requestId ||
          'unknown';
        return {
          success: true,
          messageId: messageId.toString(),
          requestId: responseData?.request_id?.toString(),
          data: responseData,
        };
      }

      const providerError =
        responseData?.message ||
        responseData?.error ||
        responseData?.reason ||
        responseData?.description;
      return {
        success: false,
        error:
          typeof providerError === 'string' && providerError.trim().length > 0
            ? providerError
            : 'Unexpected response format from MSG91 Flow API',
        data: responseData,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<any>;
        console.error('[MSG91] Flow API Error:', {
          status: axiosError.response?.status,
          data: axiosError.response?.data,
          message: axiosError.message,
        });
        return {
          success: false,
          statusCode: axiosError.response?.status?.toString(),
          error:
            axiosError.response?.data?.message ||
            axiosError.response?.data?.error ||
            axiosError.message,
          data: axiosError.response?.data,
        };
      }

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
      const templateId = request.templateId || this.config.templateId;
      const params: Record<string, string | number> = {
        authkey: this.config.apiKey,
        mobiles: phoneNumber,
        message: request.message,
        sender: request.senderId || this.config.senderId,
        response: 'json', // Request JSON response format
      };
      const route = request.route || this.config.route;
      if (typeof route === 'number') {
        params.route = route;
      }
      if (templateId) {
        params.DLT_TE_ID = templateId;
      }

      // Make API request
      const response = await axios.get(MSG91_SMS_API_URL, { params });

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

      // Non-success payloads can still come with HTTP 200; surface provider error.
      const providerError =
        (typeof responseData === 'object' &&
          (responseData.error ||
            responseData.message ||
            responseData.reason ||
            responseData.description)) ||
        undefined;
      return {
        success: false,
        error:
          typeof providerError === 'string' && providerError.trim().length > 0
            ? providerError
            : 'Unexpected response format from MSG91',
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
   * Format OTP message to match approved DLT text.
   */
  private formatOTPMessage(otp: string): string {
    return `Dear User, your OTP for NearHub authentication is ${otp}. This OTP is valid for 5 minutes. Do not share this OTP with anyone. - NearHub`;
  }

}

// Export singleton instance
export const msg91 = new MSG91Service();
