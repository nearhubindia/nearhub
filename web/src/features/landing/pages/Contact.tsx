import { type ChangeEvent, type FormEvent, type ReactElement, useState } from 'react';
import { Clock3, Mail, MapPin, Phone, Send, Sparkles } from 'lucide-react';
import { LandingFooter, LandingHeader } from '@/shared/components';
import { getApiUrl } from '@/lib/config';

const contactChannels = [
  {
    Icon: Mail,
    title: 'Email Support',
    lines: ['support@nearhub.com', 'business@nearhub.com'],
  },
  {
    Icon: Phone,
    title: 'Phone Assistance',
    lines: ['+91 1800-123-4567', 'Mon - Fri, 9 AM to 6 PM IST'],
  },
  {
    Icon: MapPin,
    title: 'Business Office',
    lines: ['Bangalore, Karnataka, India', 'India Operations Center'],
  },
];

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

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
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

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value =
      e.target.name === 'phone' ? e.target.value.replace(/\D/g, '').slice(0, 10) : e.target.value;

    setFormData((prev) => ({
      ...prev,
      [e.target.name]: value,
    }));
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7fbff_0%,#edf5ff_46%,#fff5ea_100%)] text-slate-900">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_10%,rgba(30,93,168,0.16),transparent_34%),radial-gradient(circle_at_92%_14%,rgba(255,153,51,0.18),transparent_32%),radial-gradient(circle_at_50%_92%,rgba(30,93,168,0.09),transparent_40%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(30,93,168,0.03)_1px,transparent_1px),linear-gradient(0deg,rgba(255,153,51,0.035)_1px,transparent_1px)] bg-[size:44px_44px]" />
      </div>

      <LandingHeader active="contact" />

      <main className="pt-20">
        <section className="w-full px-4 pb-8 pt-8 sm:px-8 lg:px-12">
          <div className="rounded-[2rem] border border-[#1e5da8]/20 bg-[linear-gradient(125deg,#0f4684_0%,#1e5da8_42%,#ff9933_165%)] px-6 py-8 text-white shadow-[0_34px_72px_-40px_rgba(14,63,120,0.78)] sm:px-9 sm:py-10">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]">
              <Sparkles size={12} />
              Contact NearHub
            </p>
            <h1 className="mt-4 max-w-5xl text-3xl font-bold leading-tight sm:text-5xl">
              Let&apos;s Build Your
              <span className="block text-[#fff0db]"> Next Local Growth Milestone.</span>
            </h1>
            <p className="mt-4 max-w-4xl text-sm leading-relaxed text-blue-50/95 sm:text-base">
              Tell us your goals and we will help shape onboarding, acquisition, trust workflows,
              and monetization strategy for your market.
            </p>
          </div>
        </section>

        <section className="w-full px-4 pb-8 sm:px-8 lg:px-12">
          <div className="rounded-[2rem] border border-[#1e5da8]/18 bg-white/92 p-6 shadow-[0_26px_56px_-36px_rgba(30,93,168,0.68)] backdrop-blur-sm sm:p-8">
            <div className="flex items-center gap-2">
              <Clock3 size={17} className="text-[#ff9933]" />
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ff9933]">
                Contact Channels
              </p>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {contactChannels.map(({ Icon, title, lines }) => (
                <article
                  key={title}
                  className="group relative overflow-hidden rounded-xl border border-[#1e5da8]/14 bg-[linear-gradient(180deg,#ffffff_0%,#f3f8ff_100%)] p-5 shadow-[0_14px_30px_-24px_rgba(17,61,104,0.6)] transition duration-300 hover:-translate-y-0.5 hover:border-[#1e5da8]/30 hover:shadow-[0_24px_40px_-26px_rgba(30,93,168,0.7)]"
                >
                  <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-[#ff9933]/12 blur-2xl transition group-hover:bg-[#ff9933]/18" />
                  <div className="mb-3 inline-flex rounded-xl bg-gradient-to-br from-[#1e5da8] to-[#ff9933] p-2.5 text-white">
                    <Icon size={18} />
                  </div>
                  <h2 className="text-lg font-semibold text-[#123d68]">{title}</h2>
                  <div className="mt-2 space-y-1">
                    {lines.map((line) => (
                      <p key={line} className="text-sm leading-relaxed text-slate-600">
                        {line}
                      </p>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="w-full px-4 pb-16 sm:px-8 lg:px-12">
          <div className="rounded-[2rem] border border-[#1e5da8]/18 bg-white/94 p-6 shadow-[0_30px_62px_-40px_rgba(15,63,120,0.68)] sm:p-8 lg:p-10">
            <h2 className="text-2xl font-bold text-[#113965] sm:text-3xl">Send Us a Message</h2>
            <p className="mt-2 text-sm text-slate-600 sm:text-base">
              Share your requirements and our team will respond with the right next steps.
            </p>

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
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-[#1e5da8] focus:ring-2 focus:ring-[#1e5da8]/25"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label
                    htmlFor="email"
                    className="mb-1 block text-sm font-semibold text-slate-700"
                  >
                    Email *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-[#1e5da8] focus:ring-2 focus:ring-[#1e5da8]/25"
                    placeholder="john@example.com"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="phone"
                    className="mb-1 block text-sm font-semibold text-slate-700"
                  >
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
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-[#1e5da8] focus:ring-2 focus:ring-[#1e5da8]/25"
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
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-[#1e5da8] focus:ring-2 focus:ring-[#1e5da8]/25"
                    placeholder="How can we help?"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="message"
                  className="mb-1 block text-sm font-semibold text-slate-700"
                >
                  Message *
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  rows={6}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-[#1e5da8] focus:ring-2 focus:ring-[#1e5da8]/25"
                  placeholder="Tell us about your use case..."
                />
              </div>

              {submitStatus === 'success' && (
                <div className="rounded-xl border border-emerald-500/35 bg-emerald-50 p-4 text-emerald-700">
                  Message sent successfully. Our team will get back to you soon.
                </div>
              )}
              {submitStatus === 'error' && (
                <div className="rounded-xl border border-red-500/35 bg-red-50 p-4 text-red-700">
                  Failed to send message. Please try again.
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1e5da8] to-[#ff9933] px-8 py-4 font-bold text-white shadow-[0_14px_34px_-18px_rgba(30,93,168,0.8)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
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
      </main>

      <LandingFooter />
    </div>
  );
}
