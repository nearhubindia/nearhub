import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { getApiUrl } from '@/lib/config';
import {
  trackWebEvent,
  trackWebLogin,
  trackWebSignUp,
} from '@/lib/firebase';
import { getMeaningfulWebUserName, writeStoredWebAuth } from '@/lib/web-auth-storage';

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
  const [otp, setOtp] = useState(/^\d{6}$/.test(initialOtp) ? initialOtp : '');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isOtpSent, setIsOtpSent] = useState(Boolean(initialPhone) || Boolean(initialOtp));
  const phoneInputRef = useRef<HTMLInputElement | null>(null);
  const otpInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOtpSent) {
      otpInputRef.current?.focus();
      return;
    }

    phoneInputRef.current?.focus();
  }, [isOtpSent]);

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
        setOtp(debugOtp);
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
    if (!/^\d{6}$/.test(otp)) {
      setMessage('Please enter a valid 6-digit OTP.');
      return;
    }

    setIsVerifying(true);
    setMessage('');
    try {
      await verifyOtp(cleaned, otp);
    } catch {
      setMessage('OTP verification failed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#eef5ff_0%,#ffffff_42%,#f6f8fc_100%)] p-0 text-slate-950 sm:bg-[#f6f7fb] sm:p-4 lg:p-6">
      <section className="mx-auto grid min-h-screen w-full overflow-hidden sm:min-h-[calc(100vh-2rem)] sm:rounded-[28px] sm:bg-white sm:shadow-[0_24px_90px_rgba(15,23,42,0.08)] lg:min-h-[calc(100vh-3rem)] lg:max-w-[1860px] lg:grid-cols-[1.03fr_1fr]">
        <div
          className="hidden aspect-[430/451] bg-contain bg-top bg-no-repeat sm:block sm:aspect-auto sm:min-h-[520px] sm:bg-cover sm:bg-center lg:min-h-full"
          style={{
            backgroundImage: "url('/girl.jpeg')",
          }}
          aria-label="NearHub local shopping"
          role="img"
        />

        <div className="flex items-start justify-center px-5 pb-8 pt-7 sm:items-center sm:bg-white sm:px-10 sm:py-12 lg:px-16">
          <form
            className="w-full max-w-[650px] rounded-[28px] border border-white/80 bg-white/95 px-5 py-7 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.55)] sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none"
            onSubmit={(event) => {
              event.preventDefault();
              if (isOtpSent) {
                void submitOtp();
                return;
              }
              void sendOtp();
            }}
          >
            <div className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-[#0759e6] text-2xl font-black text-white shadow-[0_18px_36px_-20px_rgba(7,89,230,0.9)] sm:hidden">
              N
            </div>

            <div className="mb-5 flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.18em] text-[#d57628] sm:mb-7 sm:gap-4 sm:text-[13px] sm:tracking-[0.42em]">
              <span className="h-px w-10 bg-[#d8a873] sm:w-12" />
              <span>Welcome Back</span>
              <span className="h-px w-10 bg-[#d8a873] sm:hidden" />
            </div>

            <h1 className="text-center text-[34px] font-black leading-[1.05] tracking-normal text-[#0d1930] sm:text-[58px] lg:text-[64px]">
              Login with <span className="text-[#236bb2]">OTP</span>
            </h1>
            <p className="mx-auto mt-4 max-w-[300px] text-center text-sm font-medium leading-6 text-[#738096] sm:mt-5 sm:max-w-[560px] sm:text-xl sm:leading-8">
              Enter your mobile number - we'll send you a secure one-time password.
            </p>

            <div className="mt-8 sm:mt-16">
              <label className="mb-3 block text-[11px] font-black uppercase tracking-[0.32em] text-[#68758a] sm:mb-5 sm:text-sm sm:tracking-[0.32em]">
                Mobile Number
              </label>
              <div className="flex gap-2.5 sm:gap-4">
                <span className="inline-flex h-14 w-[88px] shrink-0 items-center justify-center gap-1.5 rounded-2xl border border-[#dfe7f2] bg-[#f8fbff] text-sm font-black text-[#111827] shadow-[0_14px_34px_-28px_rgba(15,23,42,0.9)] sm:h-[82px] sm:w-auto sm:min-w-[120px] sm:gap-3 sm:rounded-[18px] sm:bg-white sm:text-lg">
                  <span className="rounded-lg bg-[#eaf1fb] px-1.5 py-0.5 text-[10px] font-black tracking-[0.08em] text-[#5f6b7a] sm:px-2 sm:py-1 sm:text-xs sm:tracking-[0.14em]">
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
                  className="h-14 min-w-0 flex-1 rounded-2xl border-[#dfe7f2] bg-[#f8fbff] px-4 text-base font-semibold text-slate-900 shadow-[0_14px_34px_-30px_rgba(15,23,42,0.9)] placeholder:text-[#a2a8b1] focus-visible:border-[#0759e6] focus-visible:ring-[#0759e6]/20 sm:h-[82px] sm:rounded-[18px] sm:bg-white sm:px-7 sm:text-xl"
                />
              </div>
            </div>

            {isOtpSent ? (
              <div className="mt-5 rounded-[24px] border border-[#dbe9ff] bg-[#f7fbff] px-4 py-4 shadow-[0_16px_34px_-28px_rgba(7,89,230,0.35)] sm:mt-8 sm:px-5 sm:py-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.32em] text-[#236bb2]">
                      Step 2
                    </p>
                    <h2 className="mt-1 text-lg font-black text-[#0d1930] sm:text-2xl">
                      Enter OTP
                    </h2>
                    <p className="mt-1 text-sm font-medium leading-6 text-[#66758a] sm:text-base">
                      We sent a one-time code to +91 {phone}.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOtpSent(false);
                      setOtp('');
                      setMessage('');
                    }}
                    className="rounded-full border border-[#cfe0fb] bg-white px-4 py-2 text-sm font-bold text-[#236bb2] transition hover:border-[#236bb2] hover:text-[#164a7b]"
                  >
                    Change number
                  </button>
                </div>

                <label className="mb-3 block text-[11px] font-black uppercase tracking-[0.32em] text-[#68758a] sm:mb-5 sm:text-sm sm:tracking-[0.32em]">
                  Verification code
                </label>
                <Input
                  ref={otpInputRef}
                  value={otp}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                  placeholder="6-digit OTP"
                  className="h-14 min-w-0 w-full rounded-2xl border-[#dfe7f2] bg-[#f8fbff] px-4 text-base font-semibold text-slate-900 shadow-[0_14px_34px_-30px_rgba(15,23,42,0.9)] placeholder:text-[#a2a8b1] focus-visible:border-[#0759e6] focus-visible:ring-[#0759e6]/20 sm:h-[82px] sm:rounded-[18px] sm:bg-white sm:px-7 sm:text-xl"
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => void sendOtp()}
                    disabled={isSending}
                    className="text-sm font-semibold text-[#236bb2] transition hover:text-[#164a7b] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Resend OTP
                  </button>
                </div>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSending || isVerifying}
              className="mt-6 h-14 w-full rounded-2xl bg-[linear-gradient(135deg,#0759e6_0%,#2d7bf0_100%)] text-base font-black text-white shadow-[0_18px_34px_-20px_rgba(7,89,230,0.95)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 sm:mt-9 sm:h-[80px] sm:rounded-[16px] sm:text-xl"
            >
              {isOtpSent
                ? isVerifying
                  ? 'Verifying...'
                  : 'Verify & Continue ->'
                : isSending
                  ? 'Sending OTP...'
                  : 'Get OTP ->'}
            </button>

            {message ? (
              <p className="mt-5 rounded-2xl bg-slate-50 px-4 py-3 text-center text-sm font-semibold text-slate-600 sm:bg-transparent sm:p-0 sm:text-base sm:font-medium">
                {message}
              </p>
            ) : null}
          </form>
        </div>
      </section>
    </main>
  );
}
