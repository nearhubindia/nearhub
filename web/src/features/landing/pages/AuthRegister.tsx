import { useState, type ReactElement } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { getApiUrl } from '@/lib/config';

function isValidPhone(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(phone.replace(/\D/g, ''));
}

export default function AuthRegister(): ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const sendOtp = async () => {
    const cleaned = phone.replace(/\D/g, '');
    if (!isValidPhone(cleaned)) {
      setMessage('Please enter a valid 10-digit phone number.');
      return;
    }

    setIsSending(true);
    setMessage('');
    try {
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
      const params = new URLSearchParams({ phone: cleaned });
      const redirect = new URLSearchParams(location.search).get('redirect');
      if (redirect) {
        params.set('redirect', redirect);
      }
      if (/^\d{6}$/.test(String(data.debugOtp || ''))) {
        params.set('otp', String(data.debugOtp));
      }
      navigate(`/auth/verify-otp?${params.toString()}`);
    } catch {
      setMessage('Failed to send OTP. Please try again.');
    } finally {
      setIsSending(false);
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
                  value={phone}
                  inputMode="numeric"
                  autoComplete="tel-national"
                  onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                  placeholder="10-digit mobile number"
                  className="h-14 min-w-0 flex-1 rounded-2xl border-[#dfe7f2] bg-[#f8fbff] px-4 text-base font-semibold text-slate-900 shadow-[0_14px_34px_-30px_rgba(15,23,42,0.9)] placeholder:text-[#a2a8b1] focus-visible:border-[#0759e6] focus-visible:ring-[#0759e6]/20 sm:h-[82px] sm:rounded-[18px] sm:bg-white sm:px-7 sm:text-xl"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSending}
              className="mt-6 h-14 w-full rounded-2xl bg-[linear-gradient(135deg,#0759e6_0%,#2d7bf0_100%)] text-base font-black text-white shadow-[0_18px_34px_-20px_rgba(7,89,230,0.95)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 sm:mt-9 sm:h-[80px] sm:rounded-[16px] sm:text-xl"
            >
              {isSending ? 'Sending OTP...' : 'Get OTP ->'}
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
