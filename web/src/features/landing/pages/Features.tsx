import { type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import {
  BellRing,
  ChartSpline,
  CircleDollarSign,
  Compass,
  Cpu,
  ShieldCheck,
  Video,
} from 'lucide-react';
import { LandingFooter, Logo } from '@/shared/components';

const featureList = [
  {
    Icon: Video,
    title: 'Short + Long Video Listings',
    text: 'Multiple media formats with optimized streaming and compressed delivery.',
  },
  {
    Icon: Compass,
    title: 'Smart Geo Discovery',
    text: 'Search by radius, pincode boundaries, and local relevance scoring.',
  },
  {
    Icon: BellRing,
    title: 'Push + In-App Alerts',
    text: 'Re-engage users with campaigns, transactional notifications, and reminders.',
  },
  {
    Icon: CircleDollarSign,
    title: 'Revenue Controls',
    text: 'Subscription plans, coupons, payment verification, and invoice workflows.',
  },
  {
    Icon: Cpu,
    title: 'Admin Automation',
    text: 'Moderation pipelines, settings dashboard, and enquiry tracking at scale.',
  },
  {
    Icon: ShieldCheck,
    title: 'Trust + Safety',
    text: 'Spam detection, report management, and secure auth with role-based access.',
  },
];

const stats = [
  { label: 'Feature Modules', value: '25+' },
  { label: 'APIs Integrated', value: '60+' },
  { label: 'Data Pipelines', value: '10+' },
];

export default function Features(): ReactElement {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-[#fff7ef] text-slate-900">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_15%_15%,rgba(30,93,168,0.12),transparent_42%),radial-gradient(circle_at_86%_10%,rgba(255,153,51,0.14),transparent_40%)]" />

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
              <Link to="/features" className="text-[#1e5da8]">
                Features
              </Link>
              <Link to="/contact" className="text-slate-600 transition hover:text-[#ff9933]">
                Contact
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="px-4 pb-20 pt-28 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <section className="rounded-3xl border border-[#1e5da8]/10 bg-gradient-to-br from-[#1e5da8]/8 via-white to-[#ff9933]/12 p-6 shadow-sm sm:p-10">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ff9933]">
              Platform Architecture
            </p>
            <h1 className="mt-3 text-4xl font-black leading-tight sm:text-5xl">
              Powerful Features, <span className="text-[#ff9933]">Single Experience</span>
            </h1>
            <p className="mt-4 max-w-3xl text-slate-600">
              NearHub combines growth tools, reliability, and modern UX into one admin + app
              stack tuned for conversion.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {stats.map((s) => (
                <div key={s.label} className="rounded-2xl border border-[#1e5da8]/10 bg-white p-4">
                  <p className="text-2xl font-black text-slate-900">{s.value}</p>
                  <p className="text-sm text-slate-600">{s.label}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {featureList.map(({ Icon, title, text }) => (
              <article
                key={title}
                className="rounded-2xl border border-[#1e5da8]/10 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-[#ff9933]/45 hover:shadow-lg"
              >
                <div className="mb-4 inline-flex rounded-xl bg-gradient-to-br from-[#1e5da8] to-[#ff9933] p-3 text-white">
                  <Icon size={22} />
                </div>
                <h2 className="text-xl font-bold text-slate-900">{title}</h2>
                <p className="mt-2 text-slate-600">{text}</p>
              </article>
            ))}
          </section>

          <section className="mt-12 rounded-3xl border border-[#1e5da8]/10 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-900 sm:text-3xl">
                  Need a Custom Rollout Plan?
                </h3>
                <p className="mt-2 text-slate-600">
                  We can help shape onboarding, monetization, and moderation strategy.
                </p>
              </div>
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#1e5da8] to-[#ff9933] px-6 py-3 font-bold text-white transition hover:brightness-110"
              >
                Talk to Team
                <ChartSpline size={18} />
              </Link>
            </div>
          </section>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
