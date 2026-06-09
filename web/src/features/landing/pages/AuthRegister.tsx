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
    <main className="min-h-screen bg-[#f6f7fb] p-0 text-slate-950 sm:p-4 lg:p-6">
      <section className="mx-auto grid min-h-screen w-full overflow-hidden bg-white shadow-[0_24px_90px_rgba(15,23,42,0.08)] sm:min-h-[calc(100vh-2rem)] sm:rounded-[28px] lg:min-h-[calc(100vh-3rem)] lg:max-w-[1860px] lg:grid-cols-[1.03fr_1fr]">
        <div
          className="min-h-[390px] bg-cover bg-center sm:min-h-[520px] lg:min-h-full"
          style={{
            backgroundImage: "url('/girl.jpeg')",
          }}
          aria-label="NearHub local shopping"
          role="img"
        />

        <div className="flex items-center justify-center px-6 py-12 sm:px-10 lg:px-16">
          <form
            className="w-full max-w-[650px]"
            onSubmit={(event) => {
              event.preventDefault();
              void sendOtp();
            }}
          >
            <div className="mb-7 flex items-center justify-center gap-4 text-[13px] font-bold uppercase tracking-[0.42em] text-[#c97f3d]">
              <span className="h-px w-12 bg-[#d8a873]" />
              <span>Welcome Back</span>
            </div>

            <h1 className="text-center text-[42px] font-extrabold leading-tight tracking-normal text-[#0d1930] sm:text-[58px] lg:text-[64px]">
              Login with <span className="text-[#236bb2]">OTP</span>
            </h1>
            <p className="mx-auto mt-5 max-w-[560px] text-center text-lg leading-8 text-[#7b8491] sm:text-xl">
              Enter your mobile number - we'll send you a secure one-time password.
            </p>

            <div className="mt-16">
              <label className="mb-5 block text-sm font-bold uppercase tracking-[0.32em] text-[#6e7681]">
                Mobile Number
              </label>
              <div className="flex gap-4">
                <span className="inline-flex h-[82px] min-w-[120px] items-center justify-center gap-3 rounded-[18px] border border-[#e4e8ee] bg-white text-lg font-bold text-[#111827] shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
                  <span className="rounded-md bg-[#eef2f6] px-2 py-1 text-xs font-bold tracking-[0.14em] text-[#5f6b7a]">
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
                  className="h-[82px] flex-1 rounded-[18px] border-[#e0e5ec] px-7 text-xl text-slate-900 shadow-none placeholder:text-[#a2a8b1] focus-visible:ring-[#236bb2]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSending}
              className="mt-9 h-[80px] w-full rounded-[16px] bg-[#2769ae] text-xl font-extrabold text-white shadow-[0_16px_28px_rgba(39,105,174,0.28)] transition hover:bg-[#205a99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSending ? 'Sending OTP...' : 'Get OTP ->'}
            </button>

            {message ? (
              <p className="mt-5 text-center text-base font-medium text-slate-600">{message}</p>
            ) : null}
          </form>
        </div>
      </section>
    </main>
  );
}
