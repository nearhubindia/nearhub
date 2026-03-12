import { useState } from 'react';
import { Lock, Mail, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Logo } from '@/shared/components';
import { getApiUrl } from '@/lib/config';

export default function AdminLogin() {
  // Note: useNavigate is not needed - using window.location.href instead
  const [email, setEmail] = useState('admin@nearhub.local');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Call the backend admin login endpoint
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });

      const data = await response.json();
      console.log('[AdminLogin] Response status:', response.status);
      console.log('[AdminLogin] Response data:', data);

      if (!data.success) {
        setError(data.message || 'Invalid email or password');
        console.error('[AdminLogin] Login failed:', data.message);
        return;
      }

      // Store admin token and user info
      localStorage.setItem('adminToken', data.token);
      localStorage.setItem('adminUser', JSON.stringify(data.admin));
      console.log('[AdminLogin] Token stored, navigating to /admin');

      // Redirect to admin dashboard
      window.location.href = '/admin';
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Logo size="xl" showText={true} showTagline={true} />
        </div>

        {/* Card */}
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-800/20 border border-[#1e5da8]/30 rounded-2xl p-8 backdrop-blur">
          <h1 className="text-3xl font-bold text-white mb-2 text-center">
            <span className="bg-gradient-to-r from-[#1e5da8] to-[#ff9933] bg-clip-text text-transparent">
              Admin Panel
            </span>
          </h1>
          <p className="text-slate-400 text-center mb-8">Sign in to manage the platform</p>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex gap-3">
              <AlertCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Email Address</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-3 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full bg-slate-700/30 border border-[#1e5da8]/30 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#1e5da8] transition"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-3 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-700/30 border border-[#1e5da8]/30 rounded-lg pl-10 pr-10 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#1e5da8] transition"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-300 transition"
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-[#1e5da8] to-[#ff9933] hover:from-[#1a4d8f] hover:to-[#ff8820] disabled:from-slate-600 disabled:to-slate-600 text-white font-bold py-2.5 rounded-lg transition transform hover:scale-105 disabled:hover:scale-100 shadow-lg shadow-[#1e5da8]/30 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Signing in...</span>
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
