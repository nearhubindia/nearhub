/**
 * BSNL DLT (SMS Gateway) Integration Service
 * Sends OTP via BSNL's transactional SMS service
 *
 * Setup Instructions:
 * 1. Register on BSNL DLT Portal: https://www.ucc-bsnl.co.in/
 * 2. Create a sender ID (e.g., "NRHUB")
 * 3. Register templates for OTP messages
 * 4. Get API credentials and add to .env
 *
 * Environment Variables:
 * - BSNL_DLT_USERNAME
 * - BSNL_DLT_PASSWORD
 * - BSNL_DLT_SENDER_ID
 * - BSNL_DLT_ROUTE (optional, default: 1 for transactional)
 * - BSNL_DLT_ENABLED (optional, default: false)
 */

import axios, { AxiosError } from 'axios';

// BSNL DLT API Configuration
const BSNL_DLT_API_URL = 'https://bulksms.bsnl.in:5010/api/Send_SMS';

export interface BSNLDLTConfig {
  username: string;
  password: string;
  senderId: string;
  route?: number;
  enabled: boolean;
}

export interface BSNLDLTResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  statusCode?: string;
}

export interface OTPSendRequest {
  phone: string;
  otp: string;
  templateId?: string;
}

class BSNLDLTService {
  private config: BSNLDLTConfig;

  constructor() {
    this.config = {
      username: process.env.BSNL_DLT_USERNAME || '',
      password: process.env.BSNL_DLT_PASSWORD || '',
      senderId: process.env.BSNL_DLT_SENDER_ID || 'NRHUB',
      route: parseInt(process.env.BSNL_DLT_ROUTE || '1'),
      enabled: process.env.BSNL_DLT_ENABLED === 'true',
    };

    if (this.config.enabled && !this.config.username) {
      console.warn('[BSNL DLT] Service enabled but credentials not configured');
    }
  }

  /**
   * Validate configuration
   */
  isConfigured(): boolean {
    return (
      this.config.enabled &&
      !!this.config.username &&
      !!this.config.password &&
      !!this.config.senderId
    );
  }

  /**
   * Send OTP via BSNL DLT
   *
   * Example:
   * const response = await bsnlDLT.sendOTP({
   *   phone: '9876543210',
   *   otp: '123456'
   * });
   */
  async sendOTP(request: OTPSendRequest): Promise<BSNLDLTResponse> {
    // Check if service is enabled
    if (!this.config.enabled) {
      console.log('[BSNL DLT] Service not enabled, skipping SMS');
      return { success: true };
    }

    // Validate configuration
    if (!this.isConfigured()) {
      console.error('[BSNL DLT] Service not properly configured');
      return {
        success: false,
        error: 'BSNL DLT service not configured',
      };
    }

    try {
      // Validate phone number
      if (!request.phone || !/^[6-9]\d{9}$/.test(request.phone)) {
        return {
          success: false,
          error: 'Invalid phone number format',
        };
      }

      // Validate OTP
      if (!request.otp || !/^\d{6}$/.test(request.otp)) {
        return {
          success: false,
          error: 'Invalid OTP format',
        };
      }

      // Prepare SMS message
      const message = this.formatOTPMessage(request.otp);

      // Send via BSNL DLT API with template ID from config
      const response = await this.sendSMS({
        phone: request.phone,
        message,
        templateId: request.templateId || process.env.BSNL_DLT_TEMPLATE_ID,
      });

      return response;
    } catch (error) {
      console.error('[BSNL DLT] Error sending OTP:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send generic SMS via BSNL DLT
   */
  async sendSMS(request: {
    phone: string;
    message: string;
    templateId?: string;
  }): Promise<BSNLDLTResponse> {
    try {
      // Required for BSNL DLT API
      const params = {
        username: this.config.username,
        password: this.config.password,
        message: request.message,
        senderId: this.config.senderId,
        MobileNumbers: request.phone,
        route: (this.config.route || 1).toString(),
        DLTTemplateID: request.templateId || '', // Optional: if using pre-registered template
      };

      console.log('[BSNL DLT] Sending SMS to:', request.phone);

      // Convert params to form-urlencoded data
      const formData = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        formData.append(key, String(value));
      });

      const response = await axios.post(BSNL_DLT_API_URL, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000,
      });

      // Parse BSNL response
      if (response.status === 200 && response.data) {
        const data = response.data;

        // BSNL returns success in different formats
        // Common responses: 0 (success), 1xxx (error)
        const isSuccess =
          data.Status === '0' ||
          data.status === 'success' ||
          data.ErrorCode === '0' ||
          (typeof data.Status === 'number' && data.Status === 0);

        if (isSuccess) {
          console.log('[BSNL DLT] SMS sent successfully', {
            phone: request.phone,
            messageId: data.MessageID || data.MessageId || 'N/A',
          });

          return {
            success: true,
            messageId: data.MessageID || data.MessageId,
          };
        } else {
          console.error('[BSNL DLT] API returned error:', data);
          return {
            success: false,
            error: data.Description || data.ErrorDescription || 'Unknown error',
            statusCode: data.Status || data.ErrorCode,
          };
        }
      }

      return {
        success: false,
        error: 'Invalid response from BSNL DLT API',
      };
    } catch (error) {
      console.error('[BSNL DLT] Network error:', error);
      const axiosError = error as AxiosError;
      return {
        success: false,
        error: axiosError.message || 'Network error',
      };
    }
  }

  /**
   * Format OTP message to match BSNL DLT approved template
   * Template ID: 1407168726786339789
   * Template: Dear {#var#}, {#var#} if your registration is successful Please do not share this OTP with anyone for security reasons. Thanks & regards! matrialsandmore
   */
  private formatOTPMessage(otp: string): string {
    return `Dear User, ${otp} if your registration is successful Please do not share this OTP with anyone for security reasons. Thanks & regards! matrialsandmore`;
  }

  /**
   * Format message for bulk SMS
   */
  formatBulkMessage(message: string): string {
    // Ensure message doesn't exceed 160 characters
    if (message.length > 160) {
      console.warn('[BSNL DLT] Message exceeds 160 characters, may be truncated');
    }
    return message;
  }

  /**
   * Get service status
   */
  getStatus(): {
    enabled: boolean;
    configured: boolean;
    senderId: string;
  } {
    return {
      enabled: this.config.enabled,
      configured: this.isConfigured(),
      senderId: this.config.senderId,
    };
  }
}

// Export singleton instance
export const bsnlDLT = new BSNLDLTService();

/**
 * Alternative: Using BSNL Unified SMS Gateway (if available in your region)
 *
 * Some regions use the older SMS gateway endpoint:
 * URL: https://dlt.bsnl-pts.in/api/SendSMS/SendSMSRequest
 * Method: GET
 *
 * Parameters:
 * - username: Your BSNL username
 * - password: Your BSNL password
 * - message: SMS text (max 160 chars)
 * - senderId: Your registered sender ID
 * - MobileNumbers: Recipient phone number (without +91)
 * - route: 1 for transactional, 2 for promotional
 * - DLTTemplateID: Template ID for pre-registered templates
 *
 * Response:
 * 200 OK with JSON or XML containing:
 * - Status: 0 for success, else error code
 * - MessageID: Unique message ID for tracking
 * - Description: Error description if any
 */

export default bsnlDLT;
