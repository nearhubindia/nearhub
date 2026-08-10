import type { ReactElement } from 'react';
import {
  ArrowRight,
  BatteryFull,
  CircleCheck,
  SearchCheck,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { LandingFooter, LandingHeader } from '@/shared/components';
import { BRAND_SIGNATURE } from '@/shared/brand';

const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.synvide.nearhub';

const valuationSignals = [
  'Phone model and hardware configuration',
  'Device age and software support',
  'Physical condition and battery health',
  'Current local demand and comparable listings',
];

const steps = [
  {
    number: '01',
    title: 'Enter your phone details',
    text: 'Tell NearHub the model, age, condition, storage, and battery details of your device.',
  },
  {
    number: '02',
    title: 'Generate your valuation',
    text: 'The AI valuation engine combines device evidence with current market signals.',
  },
  {
    number: '03',
    title: 'Decide your next move',
    text: 'Use the estimated resale range to prepare your phone for sale or compare local demand.',
  },
];

export default function AiMobileValuatorPage(): ReactElement {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7fbff_0%,#edf5ff_52%,#fff5ea_100%)] text-slate-900">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_8%,rgba(30,93,168,0.17),transparent_34%),radial-gradient(circle_at_92%_14%,rgba(255,153,51,0.18),transparent_32%),radial-gradient(circle_at_52%_90%,rgba(30,93,168,0.1),transparent_42%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(30,93,168,0.03)_1px,transparent_1px),linear-gradient(0deg,rgba(255,153,51,0.035)_1px,transparent_1px)] bg-[size:44px_44px]" />
      </div>

      <LandingHeader active="home" />

      <main className="pt-20">
        <section className="w-full px-4 pb-8 pt-8 sm:px-8 lg:px-12">
          <div className="overflow-hidden rounded-[2rem] border border-[#1e5da8]/20 bg-[linear-gradient(125deg,#0f4684_0%,#1e5da8_48%,#ff9933_165%)] px-6 py-9 text-white shadow-[0_34px_72px_-40px_rgba(14,63,120,0.78)] sm:px-10 sm:py-12 lg:flex lg:items-center lg:justify-between lg:gap-12">
            <div className="max-w-3xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]">
                <Smartphone size={13} />
                AI Mobile Valuator India
              </p>
              <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-5xl">
                Check Your Phone&apos;s Resale Value Online
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-blue-50/95 sm:text-lg">
                Estimate the resale value of your used mobile phone with NearHub&apos;s AI-powered
                valuation engine. Get a market-aligned price range before you sell.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a
                  href={playStoreUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#ff9933] px-5 py-3 text-sm font-bold text-slate-950 shadow-[0_16px_32px_-16px_rgba(255,153,51,0.9)] transition hover:bg-[#ffad57]"
                >
                  Download the NearHub App
                  <ArrowRight size={17} />
                </a>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/35 bg-white/12 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/20"
                >
                  See how it works
                </a>
              </div>
              <p className="mt-4 text-xs font-semibold text-blue-100/80">{BRAND_SIGNATURE}</p>
            </div>

            <div className="mt-8 hidden shrink-0 lg:block">
              <div className="relative grid h-64 w-52 place-items-center rounded-[2rem] border border-white/25 bg-white/12 shadow-[0_28px_70px_-28px_rgba(0,0,0,0.5)] backdrop-blur">
                <div className="absolute inset-3 rounded-[1.5rem] border border-white/20 bg-[linear-gradient(160deg,rgba(255,255,255,0.2),rgba(255,255,255,0.04))]" />
                <div className="relative grid h-24 w-24 place-items-center rounded-3xl bg-white text-[#1e5da8] shadow-xl">
                  <Smartphone size={48} strokeWidth={1.5} />
                </div>
                <div className="absolute bottom-7 rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-bold text-emerald-100">
                  Market estimate
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="w-full px-4 pb-8 sm:px-8 lg:px-12">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              [
                SearchCheck,
                'Used mobile price check',
                'Understand your phone value before listing it.',
              ],
              [
                BatteryFull,
                'Condition-aware estimate',
                'Include battery health, age, and device condition.',
              ],
              [
                ShieldCheck,
                'Evidence-led range',
                'See a realistic range instead of an unsupported single number.',
              ],
            ].map(([Icon, title, text]) => {
              const FeatureIcon = Icon as typeof SearchCheck;
              return (
                <article
                  key={title as string}
                  className="rounded-2xl border border-[#1e5da8]/15 bg-white/90 p-5 shadow-[0_22px_48px_-34px_rgba(30,93,168,0.7)]"
                >
                  <span className="inline-flex rounded-xl bg-gradient-to-br from-[#1e5da8] to-[#ff9933] p-2.5 text-white">
                    <FeatureIcon size={19} />
                  </span>
                  <h2 className="mt-4 text-lg font-bold text-[#123d68]">{title as string}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{text as string}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section id="how-it-works" className="w-full scroll-mt-24 px-4 pb-8 sm:px-8 lg:px-12">
          <div className="rounded-[2rem] border border-[#1e5da8]/15 bg-white/92 p-6 shadow-[0_28px_58px_-38px_rgba(30,93,168,0.7)] sm:p-9">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ff9933]">
              Simple process
            </p>
            <h2 className="mt-2 text-2xl font-bold text-[#113965] sm:text-3xl">
              How the phone valuation calculator works
            </h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {steps.map((step) => (
                <article
                  key={step.number}
                  className="rounded-xl border border-[#1e5da8]/12 bg-[#f6faff] p-5"
                >
                  <p className="text-xs font-black tracking-[0.18em] text-[#ff9933]">
                    {step.number}
                  </p>
                  <h3 className="mt-2 text-lg font-bold text-[#123d68]">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="w-full px-4 pb-8 sm:px-8 lg:px-12">
          <div className="grid gap-5 rounded-[2rem] border border-[#1e5da8]/15 bg-white/92 p-6 shadow-[0_28px_58px_-38px_rgba(30,93,168,0.7)] sm:p-9 lg:grid-cols-[1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ff9933]">
                What it considers
              </p>
              <h2 className="mt-2 text-2xl font-bold text-[#113965] sm:text-3xl">
                A better starting point for resale decisions
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                Your estimate becomes more useful when the details are complete. NearHub combines
                device information, condition signals, and market evidence to guide your next step.
              </p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {valuationSignals.map((signal) => (
                <li
                  key={signal}
                  className="flex items-start gap-2 rounded-xl bg-[#f6faff] p-3 text-sm font-semibold text-slate-700"
                >
                  <CircleCheck size={18} className="mt-0.5 shrink-0 text-emerald-600" />
                  <span>{signal}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="w-full px-4 pb-16 sm:px-8 lg:px-12">
          <div className="rounded-[2rem] bg-[linear-gradient(120deg,#0f3f78_0%,#1e5da8_58%,#ff9933_165%)] px-6 py-8 text-white shadow-[0_30px_62px_-38px_rgba(15,63,120,0.8)] sm:px-9 sm:py-10">
            <h2 className="text-2xl font-bold sm:text-3xl">Ready to check your phone value?</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-blue-50/95 sm:text-base">
              Download NearHub and use the AI Mobile Valuator to estimate your used phone&apos;s
              resale value in India.
            </p>
            <a
              href={playStoreUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-bold text-[#123d68] transition hover:bg-blue-50"
            >
              Get the app on Google Play
              <ArrowRight size={17} />
            </a>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
