import { useMemo, useState, type ReactElement } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LandingHeader, LandingFooter } from '@/shared/components';
import { Input } from '@/components/ui/input';
import { getApiUrl } from '@/lib/config';
import { trackWebLogin, trackWebSignUp } from '@/lib/firebase';
import { getMeaningfulWebUserName, writeStoredWebAuth } from '@/lib/web-auth-storage';

export default function AuthVerifyOtp(): ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const phone = params.get('phone') || '';
  const initialOtp = params.get('otp') || '';
  const redirectPath = params.get('redirect') || '/browse';
  const [otp, setOtp] = useState(/^\d{6}$/.test(initialOtp) ? initialOtp : '');
  const [message, setMessage] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const verifyOtp = async () => {
    if (!phone) {
      setMessage('Phone number is missing. Please try login again.');
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      setMessage('Please enter a valid 6-digit OTP.');
      return;
    }

    setIsVerifying(true);
    setMessage('');
    try {
      const response = await fetch(`${getApiUrl()}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp }),
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
          phone: String(data.user?.phone || phone),
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
    } catch {
      setMessage('OTP verification failed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fffef8_0%,#eef6ff_58%,#f8fbff_100%)] text-slate-900">
      <LandingHeader active="browse" />
      <main className="mx-auto max-w-xl px-4 pb-14 pt-28 sm:px-6">
        <section className="rounded-3xl border border-[#1e5da8]/15 bg-white p-6 shadow-[0_24px_60px_-42px_rgba(30,93,168,0.68)]">
          <h1 className="text-2xl font-bold text-[#113965]">Verify OTP</h1>
          <p className="mt-2 text-sm text-slate-600">Enter the 6-digit OTP sent to +91 {phone}.</p>
          <div className="mt-4">
            <Input
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
              placeholder="6-digit OTP"
            />
          </div>
          <button
            type="button"
            onClick={verifyOtp}
            disabled={isVerifying}
            className="mt-4 h-10 w-full rounded-xl bg-[#1e5da8] px-5 text-sm font-semibold text-white transition hover:bg-[#174a86] disabled:opacity-60"
          >
            {isVerifying ? 'Verifying...' : 'Verify & Continue'}
          </button>
          {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
