import { type ReactElement, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Send, Clock3 } from 'lucide-react';
import { LandingFooter, Logo } from '@/shared/components';
import { getApiUrl } from '@/lib/config';

export default function Contact(): ReactElement {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      const response = await fetch(`${getApiUrl()}/api/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          source: 'web',
        }),
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      setSubmitStatus('success');
      setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
      setTimeout(() => setSubmitStatus('idle'), 5000);
    } catch (error) {
      console.error('[Contact] Failed to submit contact form:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value =
      e.target.name === 'phone' ? e.target.value.replace(/\D/g, '').slice(0, 10) : e.target.value;

    setFormData((prev) => ({
      ...prev,
      [e.target.name]: value,
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-[#fff7ef] text-slate-900">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_8%_12%,rgba(30,93,168,0.12),transparent_45%),radial-gradient(circle_at_90%_18%,rgba(255,153,51,0.16),transparent_40%)]" />

      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-20 items-center justify-between">
            <Link to="/">
              <Logo size="lg" showText={true} />
            </Link>
            <div className="flex items-center gap-6 text-sm font-semibold sm:text-base">
              <Link to="/" className="text-slate-600 transition hover:text-[#ff9933]">
                Home
              </Link>
              <Link to="/features" className="text-slate-600 transition hover:text-[#ff9933]">
                Features
              </Link>
              <Link to="/contact" className="text-[#1e5da8]">
                Contact
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="px-4 pb-20 pt-28 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <section className="mb-8 rounded-3xl border border-[#1e5da8]/10 bg-gradient-to-br from-[#1e5da8]/8 via-white to-[#ff9933]/12 p-6 shadow-sm sm:p-10">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ff9933]">Contact</p>
            <h1 className="mt-3 text-4xl font-black sm:text-5xl">
              Let’s Build Something <span className="text-[#ff9933]">Big</span>
            </h1>
            <p className="mt-3 max-w-3xl text-slate-600">
              Share your requirement and our team will reach out with a rollout approach.
            </p>
          </section>

          <section className="grid gap-6 lg:grid-cols-[1fr,1.25fr]">
            <aside className="space-y-4">
              <div className="rounded-2xl border border-[#1e5da8]/10 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-black text-slate-900">Contact Channels</h2>
                <div className="mt-5 space-y-4 text-slate-700">
                  <div className="flex items-start gap-3">
                    <Mail className="mt-0.5 text-[#ff9933]" size={18} />
                    <div>
                      <p className="font-semibold">Email</p>
                      <p className="text-sm text-slate-600">support@nearhub.com</p>
                      <p className="text-sm text-slate-600">business@nearhub.com</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone className="mt-0.5 text-[#ff9933]" size={18} />
                    <div>
                      <p className="font-semibold">Phone</p>
                      <p className="text-sm text-slate-600">+91 1800-123-4567</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock3 className="mt-0.5 text-[#ff9933]" size={18} />
                    <div>
                      <p className="font-semibold">Working Hours</p>
                      <p className="text-sm text-slate-600">Mon - Fri, 9 AM to 6 PM IST</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-0.5 text-[#ff9933]" size={18} />
                    <div>
                      <p className="font-semibold">Office</p>
                      <p className="text-sm text-slate-600">Bangalore, Karnataka, India</p>
                    </div>
                  </div>
                </div>
              </div>
            </aside>

            <div className="rounded-2xl border border-[#1e5da8]/10 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-2xl font-black text-slate-900">Send Us a Message</h2>
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="name" className="mb-1 block text-sm font-semibold text-slate-700">
                      Name *
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-[#1e5da8] focus:ring-2 focus:ring-[#1e5da8]/30"
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="mb-1 block text-sm font-semibold text-slate-700">
                      Email *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-[#1e5da8] focus:ring-2 focus:ring-[#1e5da8]/30"
                      placeholder="john@example.com"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="phone" className="mb-1 block text-sm font-semibold text-slate-700">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      required
                      inputMode="numeric"
                      pattern="[0-9]{10}"
                      minLength={10}
                      maxLength={10}
                      title="Phone number must be exactly 10 digits"
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-[#1e5da8] focus:ring-2 focus:ring-[#1e5da8]/30"
                      placeholder="9876543210"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="subject"
                      className="mb-1 block text-sm font-semibold text-slate-700"
                    >
                      Subject *
                    </label>
                    <input
                      type="text"
                      id="subject"
                      name="subject"
                      value={formData.subject}
                      onChange={handleChange}
                      required
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-[#1e5da8] focus:ring-2 focus:ring-[#1e5da8]/30"
                      placeholder="How can we help?"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="message" className="mb-1 block text-sm font-semibold text-slate-700">
                    Message *
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows={6}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-[#1e5da8] focus:ring-2 focus:ring-[#1e5da8]/30"
                    placeholder="Tell us about your use case..."
                  />
                </div>

                {submitStatus === 'success' && (
                  <div className="rounded-xl border border-green-500/35 bg-green-500/10 p-4 text-green-200">
                    Message sent successfully. Our team will get back to you soon.
                  </div>
                )}
                {submitStatus === 'error' && (
                  <div className="rounded-xl border border-red-500/35 bg-red-500/10 p-4 text-red-200">
                    Failed to send message. Please try again.
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1e5da8] to-[#ff9933] px-8 py-4 font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <span className="animate-spin">●</span>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send size={18} />
                      Send Message
                    </>
                  )}
                </button>
              </form>
            </div>
          </section>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
