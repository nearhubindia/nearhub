/**
 * OTP Service
 * Handles OTP generation, storage, and delivery via MSG91 or BSNL DLT
 *
 * Features:
 * - Generate secure OTP codes
 * - Store OTP with expiration
 * - Send via MSG91 (primary)
 * - Send via BSNL DLT (if enabled)
 * - Verify OTP codes
 * - Prevent brute force attacks
 * - Rate limiting per phone number
 */

import { bsnlDLT } from '../notifications/bsnl-dlt';
import { msg91 } from '../notifications/msg91';

export interface OTPRecord {
  otp: string;
  phone: string;
  expiresAt: number;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  sentVia: 'msg91' | 'dlt' | 'console';
}

export interface SendOTPResponse {
  success: boolean;
  message: string;
  expiresIn: number; // seconds
  sentVia?: 'msg91' | 'dlt' | 'console';
}

export interface VerifyOTPResponse {
  success: boolean;
  message: string;
  isValid: boolean;
}

class OTPService {
  // Store OTP records: phone -> OTPRecord
  private otpStore = new Map<string, OTPRecord>();

  // Rate limiting: phone -> { count, resetAt }
  private rateLimitStore = new Map<string, { count: number; resetAt: number }>();

  // Configuration
  private readonly OTP_LENGTH = 6;
  private readonly OTP_VALIDITY = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_ATTEMPTS = 3;
  private readonly RATE_LIMIT_ATTEMPTS = 5; // Max OTP send requests
  private readonly RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour

  /**
   * Generate a secure OTP
   */
  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Check if phone is rate limited
   */
  private isRateLimited(phone: string): boolean {
    const limit = this.rateLimitStore.get(phone);

    if (!limit) {
      return false;
    }

    // Reset if window has passed
    if (Date.now() > limit.resetAt) {
      this.rateLimitStore.delete(phone);
      return false;
    }

    return limit.count >= this.RATE_LIMIT_ATTEMPTS;
  }

  /**
   * Increment rate limit counter
   */
  private incrementRateLimit(phone: string): void {
    const limit = this.rateLimitStore.get(phone);

    if (!limit) {
      this.rateLimitStore.set(phone, {
        count: 1,
        resetAt: Date.now() + this.RATE_LIMIT_WINDOW,
      });
    } else {
      limit.count++;
    }
  }

  /**
   * Send OTP to user
   *
   * Example:
   * const result = await otpService.sendOTP('9876543210');
   * if (result.success) {
   *   // OTP sent successfully
   * }
   */
  async sendOTP(phone: string): Promise<SendOTPResponse> {
    // Validate phone number
    if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
      return {
        success: false,
        message: 'Invalid phone number format',
        expiresIn: 0,
      };
    }

    // Check rate limiting
    if (this.isRateLimited(phone)) {
      return {
        success: false,
        message: 'Too many OTP requests. Please try again in 1 hour.',
        expiresIn: 0,
      };
    }

    try {
      // Generate OTP
      const otp = this.generateOTP();

      // Determine delivery method (MSG91 first, BSNL fallback)
      const bsnlStatus = bsnlDLT.getStatus();
      const msg91Status = msg91.getStatus();
      let sentVia: 'msg91' | 'dlt' | 'console' = 'console';

      // Try MSG91 first (primary)
      if (msg91Status.enabled && msg91Status.configured) {
        try {
          const msg91Response = await msg91.sendOTP({
            phone,
            otp,
          });

          if (msg91Response.success) {
            sentVia = 'msg91';
            console.log(`[OTP] Sent via MSG91 to +91${phone} (ID: ${msg91Response.messageId})`);
          } else {
            console.warn(`[OTP] MSG91 failed: ${msg91Response.error}`);
            // Try BSNL as fallback
            if (bsnlStatus.enabled && bsnlStatus.configured) {
              const dltResponse = await bsnlDLT.sendOTP({
                phone,
                otp,
              });
              if (dltResponse.success) {
                sentVia = 'dlt';
                console.log(`[OTP] Sent via BSNL DLT to +91${phone} (ID: ${dltResponse.messageId})`);
              } else {
                console.warn(`[OTP] BSNL DLT also failed: ${dltResponse.error}`);
                console.log(`[OTP] Code for +91${phone}: ${otp}`);
              }
            } else {
              console.log(`[OTP] Code for +91${phone}: ${otp}`);
            }
          }
        } catch (msg91Error) {
          console.error('[OTP] Error with MSG91:', msg91Error);
          // Try BSNL as fallback
          if (bsnlStatus.enabled && bsnlStatus.configured) {
            try {
              const dltResponse = await bsnlDLT.sendOTP({
                phone,
                otp,
              });
              if (dltResponse.success) {
                sentVia = 'dlt';
                console.log(`[OTP] Sent via BSNL DLT to +91${phone} (ID: ${dltResponse.messageId})`);
              } else {
                console.log(`[OTP] Code for +91${phone}: ${otp}`);
              }
            } catch {
              console.log(`[OTP] Code for +91${phone}: ${otp}`);
            }
          } else {
            console.log(`[OTP] Code for +91${phone}: ${otp}`);
          }
        }
      } else if (bsnlStatus.enabled && bsnlStatus.configured) {
        // BSNL only
        try {
          const dltResponse = await bsnlDLT.sendOTP({
            phone,
            otp,
          });

          if (dltResponse.success) {
            sentVia = 'dlt';
            console.log(`[OTP] Sent via BSNL DLT to +91${phone} (ID: ${dltResponse.messageId})`);
          } else {
            console.warn(`[OTP] BSNL DLT failed: ${dltResponse.error}`);
            console.log(`[OTP] Code for +91${phone}: ${otp}`);
          }
        } catch {
          console.log(`[OTP] Code for +91${phone}: ${otp}`);
        }
      } else {
        // Neither configured, just log
        console.log(`[OTP] Code for +91${phone}: ${otp} (MSG91 and BSNL DLT not configured)`);
      }

      // Store OTP
      this.otpStore.set(phone, {
        otp,
        phone,
        expiresAt: Date.now() + this.OTP_VALIDITY,
        attempts: 0,
        maxAttempts: this.MAX_ATTEMPTS,
        createdAt: Date.now(),
        sentVia,
      });

      // Increment rate limit
      this.incrementRateLimit(phone);

      return {
        success: true,
        message:
          sentVia === 'msg91'
            ? 'OTP sent to your mobile via MSG91'
            : sentVia === 'dlt'
              ? 'OTP sent to your mobile via BSNL'
              : 'OTP generated (check server logs in development)',
        expiresIn: Math.ceil(this.OTP_VALIDITY / 1000),
        sentVia,
      };
    } catch (error) {
      console.error('[OTP] Error sending OTP:', error instanceof Error ? error.message : error);
      return {
        success: false,
        message: 'Failed to send OTP. Please try again.',
        expiresIn: 0,
      };
    }
  }

  /**
   * Verify OTP code
   *
   * Example:
   * const result = otpService.verifyOTP('9876543210', '123456');
   * if (result.isValid) {
   *   // OTP is valid, create user session
   * }
   */
  verifyOTP(phone: string, otp: string): VerifyOTPResponse {
    // Validate inputs
    if (!phone || !otp) {
      return {
        success: false,
        message: 'Phone and OTP required',
        isValid: false,
      };
    }

    // Check if OTP exists
    const record = this.otpStore.get(phone);
    if (!record) {
      return {
        success: false,
        message: 'OTP expired or not requested. Please request a new one.',
        isValid: false,
      };
    }

    // Check expiration
    if (Date.now() > record.expiresAt) {
      this.otpStore.delete(phone);
      return {
        success: false,
        message: 'OTP has expired. Please request a new one.',
        isValid: false,
      };
    }

    // Check attempts
    if (record.attempts >= record.maxAttempts) {
      this.otpStore.delete(phone);
      return {
        success: false,
        message: 'Maximum attempts exceeded. Please request a new OTP.',
        isValid: false,
      };
    }

    // Verify OTP
    if (record.otp !== otp) {
      record.attempts++;
      const remaining = record.maxAttempts - record.attempts;

      return {
        success: false,
        message:
          remaining > 0
            ? `Invalid OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
            : 'Maximum attempts exceeded. Please request a new OTP.',
        isValid: false,
      };
    }

    // OTP is valid, clean up
    this.otpStore.delete(phone);

    return {
      success: true,
      message: 'OTP verified successfully',
      isValid: true,
    };
  }

  /**
   * Get OTP record (for testing/debugging only)
   * Remove in production
   */
  getOTPRecord(phone: string): OTPRecord | undefined {
    return this.otpStore.get(phone);
  }

  /**
   * Clear OTP (for testing)
   */
  clearOTP(phone: string): void {
    this.otpStore.delete(phone);
  }

  /**
   * Clear all OTPs (dangerous, for testing only)
   */
  clearAllOTPs(): void {
    this.otpStore.clear();
  }

  /**
   * Get service stats
   */
  getStats(): {
    totalOTPsStored: number;
    rateLimitedPhones: number;
    bsnlStatus: ReturnType<typeof bsnlDLT.getStatus>;
  } {
    return {
      totalOTPsStored: this.otpStore.size,
      rateLimitedPhones: this.rateLimitStore.size,
      bsnlStatus: bsnlDLT.getStatus(),
    };
  }

  /**
   * Clean up expired OTPs (run periodically)
   */
  cleanupExpiredOTPs(): number {
    let cleaned = 0;
    const now = Date.now();

    for (const [phone, record] of this.otpStore.entries()) {
      if (now > record.expiresAt) {
        this.otpStore.delete(phone);
        cleaned++;
      }
    }

    console.log(`[OTP] Cleaned up ${cleaned} expired OTPs`);
    return cleaned;
  }
}

// Export singleton instance
export const otpService = new OTPService();

// Run cleanup every 5 minutes
setInterval(
  () => {
    otpService.cleanupExpiredOTPs();
  },
  5 * 60 * 1000
);

export default otpService;
