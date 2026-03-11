import { useEffect, useState, type ReactElement } from 'react';
import { BadgeCheck, ChevronLeft, ChevronRight, Globe, Video, Zap } from 'lucide-react';
import { LandingFooter, LandingHeader } from '@/shared/components';

const cards = [
  {
    Icon: Video,
    title: 'Video-First Listings',
    text: 'Show products and services with crisp short clips that convert fast.',
  },
  {
    Icon: BadgeCheck,
    title: 'Trust Signals Built-In',
    text: 'Verification badges, moderation, and profile controls to reduce noise.',
  },
  {
    Icon: Zap,
    title: 'Growth Controls',
    text: 'Boosts, featured slots, and coupon engines for serious sellers.',
  },
  {
    Icon: Globe,
    title: 'Location Intelligence',
    text: 'Smart local discovery with pincode-aware geo search and filtering.',
  },
];

const advantageStats = [
  { value: '3.2x', label: 'More Qualified Leads' },
  { value: '48h', label: 'Average Lead Response Cycle' },
  { value: '92%', label: 'Seller Satisfaction Score' },
];

export default function Landing(): ReactElement {
  const [currentBanner, setCurrentBanner] = useState<number>(0);
  const banners = ['/banner_web_1.png', '/banner_web_2.png'];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length);
    }, 6000);

    return () => clearInterval(interval);
  }, [banners.length]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-[#fff7ef] text-slate-900">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_15%,rgba(30,93,168,0.12),transparent_45%),radial-gradient(circle_at_90%_20%,rgba(255,153,51,0.14),transparent_42%),radial-gradient(circle_at_50%_95%,rgba(30,93,168,0.08),transparent_45%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(30,93,168,0.03)_1px,transparent_1px),linear-gradient(0deg,rgba(255,153,51,0.03)_1px,transparent_1px)] bg-[size:46px_46px]" />
      </div>

      <LandingHeader active="home" />

      <main className="pt-24 md:pt-26">
        <section className="pb-8">
          <div className="relative mx-auto max-w-[1920px] overflow-hidden">
            <div className="relative aspect-[4/5] w-full sm:aspect-[16/8] lg:aspect-[1920/550]">
              {banners.map((image, index) => (
                <div
                  key={image}
                  className={`absolute inset-0 transition-opacity duration-700 ${
                    index === currentBanner ? 'opacity-100' : 'opacity-0'
                  }`}
                  style={{
                    backgroundImage: `url(${image})`,
                    backgroundSize: 'contain',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                  }}
                />
              ))}
            </div>

            <button
              onClick={() =>
                setCurrentBanner((prev) => (prev - 1 + banners.length) % banners.length)
              }
              className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full border border-white/30 bg-black/35 p-2 text-white backdrop-blur hover:bg-black/55 sm:block"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => setCurrentBanner((prev) => (prev + 1) % banners.length)}
              className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full border border-white/30 bg-black/35 p-2 text-white backdrop-blur hover:bg-black/55 sm:block"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </section>

        <section className="px-4 pb-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="overflow-hidden rounded-[2rem] border border-[#1e5da8]/15 bg-white shadow-[0_28px_70px_-35px_rgba(30,93,168,0.45)]">
              <div className="grid gap-8 border-b border-slate-200/80 bg-gradient-to-r from-[#1e5da8]/8 via-white to-[#ff9933]/10 px-6 py-10 sm:px-10 lg:grid-cols-[1.25fr,1fr] lg:items-end">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#ff9933]">
                    Core Advantage
                  </p>
                  <h2 className="mt-4 text-3xl font-black leading-tight text-slate-900 sm:text-5xl">
                    Elegant by Design.
                    <span className="block bg-gradient-to-r from-[#1e5da8] to-[#ff9933] bg-clip-text text-transparent">
                      Powerful by Outcomes.
                    </span>
                  </h2>
                  <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
                    NearHub is engineered for high-intent commerce with a calm, trust-first
                    experience that helps buyers decide faster and helps sellers convert better.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                  {advantageStats.map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-2xl border border-[#1e5da8]/10 bg-white p-4"
                    >
                      <p className="text-2xl font-black text-[#1e5da8]">{stat.value}</p>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                        {stat.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-8">
                {cards.map(({ Icon, title, text }) => (
                  <article
                    key={title}
                    className="group rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/70 p-6 transition hover:border-[#1e5da8]/25 hover:shadow-[0_16px_40px_-28px_rgba(30,93,168,0.7)]"
                  >
                    <div className="mb-4 inline-flex items-center gap-3">
                      <span className="inline-flex rounded-xl bg-gradient-to-br from-[#1e5da8] to-[#ff9933] p-3 text-white shadow-sm">
                        <Icon size={20} />
                      </span>
                      <span className="h-px w-14 bg-gradient-to-r from-[#1e5da8] to-[#ff9933]/30" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">{title}</h3>
                    <p className="mt-2 text-slate-600">{text}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
