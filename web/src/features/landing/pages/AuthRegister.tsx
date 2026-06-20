import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactElement,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { getApiUrl } from '@/lib/config';
import { trackWebEvent, trackWebLogin, trackWebSignUp } from '@/lib/firebase';
import { getMeaningfulWebUserName, writeStoredWebAuth } from '@/lib/web-auth-storage';

const OTP_LENGTH = 6;

function isValidPhone(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(phone.replace(/\D/g, ''));
}

export default function AuthRegister(): ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const redirectPath = params.get('redirect') || '/browse';
  const initialPhone = params.get('phone') || '';
  const initialOtp = params.get('otp') || '';
  const [phone, setPhone] = useState(initialPhone.replace(/\D/g, '').slice(0, 10));
  const [otp, setOtp] = useState<string[]>(() => {
    const digits = String(initialOtp || '')
      .replace(/\D/g, '')
      .slice(0, OTP_LENGTH)
      .split('');
    return Array.from({ length: OTP_LENGTH }, (_, index) => digits[index] || '');
  });
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isOtpSent, setIsOtpSent] = useState(Boolean(initialPhone) || Boolean(initialOtp));
  const phoneInputRef = useRef<HTMLInputElement | null>(null);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (isOtpSent) {
      otpInputRefs.current[0]?.focus();
      return;
    }

    phoneInputRef.current?.focus();
  }, [isOtpSent]);

  const otpCode = otp.join('');

  const handleOtpChange = (value: string, index: number) => {
    const digits = value.replace(/\D/g, '');
    if (!digits) {
      setOtp((current) => {
        const next = [...current];
        next[index] = '';
        return next;
      });
      return;
    }

    if (digits.length > 1) {
      setOtp((current) => {
        const next = [...current];
        digits
          .split('')
          .slice(0, OTP_LENGTH - index)
          .forEach((digit, offset) => {
            next[index + offset] = digit;
          });
        return next;
      });
      const nextIndex = Math.min(index + digits.length, OTP_LENGTH - 1);
      otpInputRefs.current[nextIndex]?.focus();
      return;
    }

    setOtp((current) => {
      const next = [...current];
      next[index] = digits;
      return next;
    });
    if (index < OTP_LENGTH - 1) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key === 'Backspace' && !otp[index] && index > 0) {
      setOtp((current) => {
        const next = [...current];
        next[index - 1] = '';
        return next;
      });
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    event.preventDefault();
    const next = Array.from({ length: OTP_LENGTH }, (_, index) => pasted[index] || '');
    setOtp(next);
    const focusIndex = Math.min(pasted.length, OTP_LENGTH - 1);
    otpInputRefs.current[focusIndex]?.focus();
  };

  const verifyOtp = async (phoneNumber: string, otpCode: string) => {
    const response = await fetch(`${getApiUrl()}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phoneNumber, otp: otpCode }),
    });
    const data = (await response.json()) as {
      success?: boolean;
      message?: string;
      token?: string;
      user?: {
        id?: string;
        name?: string;
        phone?: string;
        email?: string;
        avatarUrl?: string;
        address?: string;
        gstin?: string;
      };
      isNewUser?: boolean;
      requiresProfileCompletion?: boolean;
    };
    if (!data.success) {
      setMessage(data.message || 'OTP verification failed');
      return;
    }
    const token = String(data.token || '').trim();
    if (!token) {
      setMessage('Login succeeded, but the session token was missing. Please try again.');
      return;
    }
    writeStoredWebAuth(
      {
        id: String(data.user?.id || '').trim(),
        name: getMeaningfulWebUserName(data.user?.name),
        phone: String(data.user?.phone || phoneNumber),
        email: String(data.user?.email || ''),
        avatarUrl: String(data.user?.avatarUrl || ''),
        address: String(data.user?.address || ''),
        gstin: String(data.user?.gstin || ''),
      },
      token
    );
    void trackWebLogin('otp');
    if (data.isNewUser || data.requiresProfileCompletion) {
      void trackWebSignUp('otp');
    }
    navigate(redirectPath.startsWith('/') ? redirectPath : '/browse');
  };

  const sendOtp = async () => {
    const cleaned = phone.replace(/\D/g, '');
    if (!isValidPhone(cleaned)) {
      setMessage('Please enter a valid 10-digit phone number.');
      return;
    }

    setIsSending(true);
    setMessage('');
    try {
      void trackWebEvent('begin_sign_up', { method: 'otp' });
      const response = await fetch(`${getApiUrl()}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleaned }),
      });
      const data = (await response.json()) as {
        success?: boolean;
        message?: string;
        debugOtp?: string;
      };
      if (!data.success) {
        setMessage(data.message || 'Failed to send OTP');
        return;
      }
      setIsOtpSent(true);
      setMessage('OTP sent successfully. Please enter the code below.');
      const nextParams = new URLSearchParams();
      nextParams.set('phone', cleaned);
      if (redirectPath) {
        nextParams.set('redirect', redirectPath);
      }
      if (/^\d{6}$/.test(String(data.debugOtp || ''))) {
        const debugOtp = String(data.debugOtp);
        setOtp(debugOtp.split('').slice(0, OTP_LENGTH));
        nextParams.set('otp', debugOtp);
      }
      navigate(`/auth/register?${nextParams.toString()}`, { replace: true });
    } catch {
      setMessage('Failed to send OTP. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const submitOtp = async () => {
    const cleaned = phone.replace(/\D/g, '');
    if (!isValidPhone(cleaned)) {
      setMessage('Please enter a valid 10-digit phone number.');
      setIsOtpSent(false);
      return;
    }
    if (otpCode.length !== OTP_LENGTH) {
      setMessage('Please enter a valid 6-digit OTP.');
      return;
    }

    setIsVerifying(true);
    setMessage('');
    try {
      await verifyOtp(cleaned, otpCode);
    } catch {
      setMessage('OTP verification failed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f3f6fb] p-0 text-slate-950 sm:p-4 lg:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(7,89,230,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(214,117,40,0.08),transparent_28%)]" />
      <section className="relative mx-auto grid min-h-screen w-full overflow-hidden bg-white sm:min-h-[calc(100vh-2rem)] sm:rounded-[32px] sm:border sm:border-white/70 sm:shadow-[0_28px_100px_rgba(15,23,42,0.08)] lg:min-h-[calc(100vh-3rem)] lg:max-w-[1700px] lg:grid-cols-[1.08fr_0.92fr]">
        <div
          className="relative hidden min-h-[520px] overflow-hidden bg-cover bg-center lg:block lg:min-h-full"
          style={{
            backgroundImage: "url('/login_banner.png')",
          }}
          aria-label="NearHub login banner"
          role="img"
        >
          <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(6,22,63,0.12),rgba(6,22,63,0)_42%),linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0)_32%)]" />
        </div>

        <div className="flex items-center justify-center px-4 py-8 sm:px-8 sm:py-10 lg:px-16">
          <form
            className="w-full max-w-[620px] rounded-[30px] border border-slate-200/80 bg-white/90 px-5 py-6 shadow-[0_26px_90px_-48px_rgba(15,23,42,0.45)] backdrop-blur md:px-8 md:py-8 lg:px-10 lg:py-10"
            onSubmit={(event) => {
              event.preventDefault();
              if (isOtpSent) {
                void submitOtp();
                return;
              }
              void sendOtp();
            }}
          >
            <div className="mb-6 sm:hidden">
              <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-slate-100 shadow-[0_20px_45px_-35px_rgba(15,23,42,0.45)]">
                <div
                  className="aspect-[4/3] bg-cover bg-center"
                  style={{ backgroundImage: "url('/login_banner.png')" }}
                  aria-label="NearHub login banner"
                  role="img"
                />
              </div>
            </div>

            <div className="mb-5 flex items-center justify-center gap-3 text-[10px] font-normal uppercase tracking-[0.36em] text-[#d57628] md:mb-7">
              <span className="h-px w-9 bg-[#d8a873]" />
              <span>Secure Access</span>
              <span className="h-px w-9 bg-[#d8a873]" />
            </div>

            <h1 className="text-center text-[34px] font-medium leading-[0.98] tracking-[-0.04em] text-slate-950 sm:text-[52px] lg:text-[60px]">
              Login with <span className="text-[#236bb2]">OTP</span>
            </h1>
            <p className="mx-auto mt-4 max-w-[36rem] text-center text-sm font-normal leading-6 text-slate-600 sm:mt-5 sm:text-base sm:leading-7 lg:text-lg">
              Enter your mobile number and we&apos;ll send a secure one-time password to verify your
              account.
            </p>

            <div className="mt-8 sm:mt-12">
              <label className="mb-3 block text-[11px] font-normal uppercase tracking-[0.34em] text-slate-500 sm:mb-4">
                Mobile Number
              </label>
              <div className="flex gap-3">
                <span className="inline-flex h-14 w-[96px] shrink-0 items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-normal text-slate-700 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.6)] sm:h-[74px] sm:w-[126px] sm:gap-2.5 sm:rounded-[20px] sm:text-base">
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-normal tracking-[0.14em] text-slate-500 sm:text-[11px]">
                    IN
                  </span>
                  +91
                </span>
                <Input
                  ref={phoneInputRef}
                  value={phone}
                  inputMode="numeric"
                  autoComplete="tel-national"
                  onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                  placeholder="10-digit mobile number"
                  className="h-14 min-w-0 flex-1 rounded-2xl border-slate-200 bg-white px-4 text-base font-normal text-slate-900 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.45)] placeholder:text-slate-400 focus-visible:border-[#0759e6] focus-visible:ring-[#0759e6]/15 sm:h-[74px] sm:rounded-[20px] sm:px-6 sm:text-lg"
                />
              </div>
            </div>

            {isOtpSent ? (
              <div className="mt-5 rounded-[26px] border border-[#dbe9ff] bg-[#f8fbff] px-4 py-4 shadow-[0_18px_40px_-30px_rgba(7,89,230,0.28)] sm:mt-8 sm:px-5 sm:py-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-normal uppercase tracking-[0.32em] text-[#236bb2]">
                      Step 2
                    </p>
                    <h2 className="mt-1 text-lg font-medium text-slate-950 sm:text-2xl">
                      Enter OTP
                    </h2>
                    <p className="mt-1 text-sm font-normal leading-6 text-slate-600 sm:text-base">
                      We sent a one-time code to +91 {phone}.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOtpSent(false);
                      setOtp(Array(OTP_LENGTH).fill(''));
                      setMessage('');
                    }}
                    className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-normal text-slate-700 transition hover:border-[#236bb2] hover:text-[#236bb2]"
                  >
                    Change number
                  </button>
                </div>

                <label className="mb-3 block text-[11px] font-normal uppercase tracking-[0.34em] text-slate-500 sm:mb-5">
                  Verification code
                </label>
                <div className="grid grid-cols-6 gap-2 sm:gap-3">
                  {otp.map((digit, index) => (
                    <Input
                      key={index}
                      ref={(ref) => {
                        otpInputRefs.current[index] = ref;
                      }}
                      value={digit}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      onChange={(e) => handleOtpChange(e.target.value, index)}
                      onKeyDown={(event) => handleOtpKeyDown(event, index)}
                      onPaste={handleOtpPaste}
                      maxLength={OTP_LENGTH}
                      aria-label={`OTP digit ${index + 1}`}
                      className="h-14 rounded-2xl border-slate-200 bg-white px-0 text-center text-lg font-normal text-slate-950 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.45)] placeholder:text-slate-300 focus-visible:border-[#0759e6] focus-visible:ring-[#0759e6]/15 sm:h-[74px] sm:rounded-[20px] sm:text-2xl"
                    />
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => void sendOtp()}
                    disabled={isSending}
                    className="cursor-pointer text-sm font-normal text-[#236bb2] transition hover:text-[#164a7b] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Resend OTP
                  </button>
                </div>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={
                isSending ||
                isVerifying ||
                (!isOtpSent && !isValidPhone(phone)) ||
                (isOtpSent && otpCode.length !== OTP_LENGTH)
              }
              className="mt-6 inline-flex h-14 w-full cursor-pointer items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0759e6_0%,#1f73ff_100%)] text-base font-normal text-white shadow-[0_24px_44px_-18px_rgba(7,89,230,0.52)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 sm:mt-8 sm:h-[76px] sm:rounded-[20px] sm:text-lg"
            >
              {isOtpSent
                ? isVerifying
                  ? 'Verifying...'
                  : 'Verify & Continue'
                : isSending
                  ? 'Sending OTP...'
                  : 'Get OTP →'}
            </button>

            {message ? (
              <p className="mt-5 rounded-2xl bg-slate-50 px-4 py-3 text-center text-sm font-normal text-slate-600 sm:bg-transparent sm:p-0 sm:text-base">
                {message}
              </p>
            ) : null}
          </form>
        </div>
      </section>
    </main>
  );
}
