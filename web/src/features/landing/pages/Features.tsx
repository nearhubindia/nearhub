import { type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BellRing,
  ChartSpline,
  CircleDollarSign,
  Compass,
  Cpu,
  ShieldCheck,
  Sparkles,
  Video,
} from 'lucide-react';
import { LandingFooter, LandingHeader } from '@/shared/components';

const featureList = [
  {
    Icon: Video,
    title: 'Short + Long Video Listings',
    text: 'High-impact video cards with optimized streaming and fast delivery for stronger buyer attention.',
  },
  {
    Icon: Compass,
    title: 'Smart Geo Discovery',
    text: 'Search by radius, pincode boundaries, and location relevance to capture nearby demand first.',
  },
  {
    Icon: BellRing,
    title: 'Push + In-App Alerts',
    text: 'Reactivate users with transactional and campaign-based notifications across the funnel.',
  },
  {
    Icon: CircleDollarSign,
    title: 'Revenue Controls',
    text: 'Subscriptions, coupons, featured placements, and payment validation in one monetization stack.',
  },
  {
    Icon: Cpu,
    title: 'Admin Automation',
    text: 'Scale moderation, settings, and operations with centralized admin tools and workflow controls.',
  },
  {
    Icon: ShieldCheck,
    title: 'Trust + Safety',
    text: 'Spam detection, report handling, and role-based controls keep platform quality consistently high.',
  },
];

const stats = [
  { label: 'Feature Modules', value: '25+' },
  { label: 'Core Integrations', value: '60+' },
  { label: 'Automation Flows', value: '10+' },
  { label: 'Admin Controls', value: '40+' },
];

const growthFlow = [
  {
    title: 'Attract',
    text: 'Video-first listings and location-aware ranking bring better-fit buyers to every post.',
  },
  {
    title: 'Convert',
    text: 'Verified trust signals, quick messaging, and smart reminders reduce drop-offs in decision journeys.',
  },
  {
    title: 'Scale',
    text: 'Monetization and automation modules help business teams grow reach without growing complexity.',
  },
];

export default function Features(): ReactElement {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7fbff_0%,#edf5ff_46%,#fff5ea_100%)] text-slate-900">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_10%,rgba(30,93,168,0.16),transparent_34%),radial-gradient(circle_at_92%_14%,rgba(255,153,51,0.18),transparent_32%),radial-gradient(circle_at_50%_92%,rgba(30,93,168,0.09),transparent_40%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(30,93,168,0.03)_1px,transparent_1px),linear-gradient(0deg,rgba(255,153,51,0.035)_1px,transparent_1px)] bg-[size:44px_44px]" />
      </div>

      <LandingHeader active="features" />

      <main className="pt-20">
        <section className="w-full px-4 pb-8 pt-8 sm:px-8 lg:px-12">
          <div className="rounded-[2rem] border border-[#1e5da8]/20 bg-[linear-gradient(125deg,#0f4684_0%,#1e5da8_42%,#ff9933_165%)] px-6 py-8 text-white shadow-[0_34px_72px_-40px_rgba(14,63,120,0.78)] sm:px-9 sm:py-10">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]">
              <Sparkles size={12} />
              Platform Architecture
            </p>
            <h1 className="mt-4 max-w-5xl text-3xl font-bold leading-tight sm:text-5xl">
              Powerful Features,
              <span className="block text-[#fff0db]">One Unified Growth Experience.</span>
            </h1>
            <p className="mt-4 max-w-4xl text-sm leading-relaxed text-blue-50/95 sm:text-base">
              NearHub combines acquisition, trust, engagement, and monetization features into a
              single app + admin stack designed for serious local commerce businesses.
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {stats.map((s) => (
                <div key={s.label} className="rounded-xl border border-white/22 bg-white/14 p-4">
                  <p className="text-2xl font-bold text-white">{s.value}</p>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-blue-50/85">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="w-full px-4 pb-9 sm:px-8 lg:px-12">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {featureList.map(({ Icon, title, text }) => (
              <article
                key={title}
                className="group relative overflow-hidden rounded-xl border border-[#1e5da8]/14 bg-[linear-gradient(180deg,#ffffff_0%,#f3f8ff_100%)] p-6 shadow-[0_16px_34px_-26px_rgba(14,63,120,0.52)] transition duration-300 hover:-translate-y-1 hover:border-[#1e5da8]/30 hover:shadow-[0_24px_42px_-24px_rgba(30,93,168,0.66)]"
              >
                <div className="pointer-events-none absolute left-0 top-0 h-24 w-24 -translate-x-8 -translate-y-8 rounded-full bg-[#1e5da8]/12 blur-2xl transition group-hover:bg-[#1e5da8]/20" />
                <div className="mb-4 inline-flex items-center gap-3">
                  <span className="inline-flex rounded-xl bg-gradient-to-br from-[#1e5da8] via-[#2478d8] to-[#ff9933] p-3 text-white shadow-sm">
                    <Icon size={20} />
                  </span>
                  <span className="h-px w-16 bg-gradient-to-r from-[#1e5da8] to-[#ff9933]/35" />
                </div>
                <h2 className="text-xl font-semibold text-[#113965]">{title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-base">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="w-full px-4 pb-9 sm:px-8 lg:px-12">
          <div className="rounded-[2rem] border border-[#1e5da8]/18 bg-white/92 p-6 shadow-[0_26px_56px_-36px_rgba(30,93,168,0.68)] backdrop-blur-sm sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ff9933]">Feature Flow</p>
            <h3 className="mt-2 text-2xl font-bold text-[#113965] sm:text-3xl">
              How NearHub Turns Features Into Growth
            </h3>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {growthFlow.map((item, index) => (
                <article
                  key={item.title}
                  className="rounded-xl border border-[#1e5da8]/14 bg-[linear-gradient(180deg,#ffffff_0%,#f5f9ff_100%)] p-5"
                >
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#ff9933]">
                    Step {index + 1}
                  </p>
                  <h4 className="mt-1 text-xl font-bold text-[#123d68]">{item.title}</h4>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="w-full px-4 pb-16 sm:px-8 lg:px-12">
          <div className="overflow-hidden rounded-[2rem] border border-[#1e5da8]/18 bg-[linear-gradient(120deg,#0f3f78_0%,#1e5da8_58%,#ff9933_165%)] px-6 py-8 text-white shadow-[0_30px_62px_-38px_rgba(15,63,120,0.8)] sm:px-9 lg:flex lg:items-center lg:justify-between lg:gap-10">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ffe2bf]">Deployment Support</p>
              <h3 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">
                Need a Custom Rollout Plan?
              </h3>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-blue-50/95 sm:text-base">
                Get a focused roadmap for onboarding, monetization, moderation, and analytics tuned
                to your market and growth goals.
              </p>
            </div>

            <div className="mt-5 flex flex-wrap gap-3 lg:mt-0 lg:justify-end">
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 rounded-xl bg-[#ff9933] px-6 py-3 text-sm font-semibold text-slate-900 shadow-[0_14px_34px_-18px_rgba(255,153,51,0.95)] transition hover:bg-[#ffad57]"
              >
                Talk to Team
                <ChartSpline size={18} />
              </Link>
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-xl border border-white/35 bg-white/14 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/24"
              >
                Back to Home
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
