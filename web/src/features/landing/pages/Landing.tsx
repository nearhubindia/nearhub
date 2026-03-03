import { useEffect, useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { LandingFooter, Logo } from '@/shared/components';

interface BannerStat {
  value: string;
  label: string;
}

interface CarouselBanner {
  title: string;
  subtitle: string;
  cta: string;
  accent: string;
  text: string;
  description?: string;
  ctaSecondary?: string;
  hasSections?: boolean;
  stats?: BannerStat[];
  imageUrl?: string;
}

interface ScrollBannerItem {
  title: string;
  meta: string;
  accent: string;
}

interface ScrollBannerSection {
  eyebrow: string;
  heading: string;
  subheading: string;
  items: ScrollBannerItem[];
}

export default function Landing(): ReactElement {
  const [currentBanner, setCurrentBanner] = useState<number>(0);

  const carouselBanners: CarouselBanner[] = [
    {
      title: '',
      subtitle: '',
      cta: '',
      accent: '',
      text: '',
      imageUrl: '/banner_web_1.png',
    },
    {
      title: '',
      subtitle: '',
      cta: '',
      accent: '',
      text: '',
      imageUrl: '/banner_web_2.png',
    },
  ];

  const bannerSections: ScrollBannerSection[] = [
    {
      eyebrow: 'Live on NearHub',
      heading: 'What people are posting',
      subheading:
        'A quick scroll through the latest momentum across jobs, services, rentals, and local commerce. Hover to pause and explore.',
      items: [
        {
          title: 'Pan-India reach',
          meta: '480+ cities and towns active every day',
          accent: 'from-cyan-500 to-teal-500',
        },
        {
          title: 'Trust-first listings',
          meta: 'Phone verification and moderation on every post',
          accent: 'from-teal-500 to-emerald-500',
        },
        {
          title: 'Video-ready posts',
          meta: 'Short-form and long-form clips hosted seamlessly',
          accent: 'from-cyan-500 to-blue-500',
        },
        {
          title: 'Seller tools that convert',
          meta: 'Boosts, featured badges, analytics, and coupons',
          accent: 'from-amber-400 to-orange-500',
        },
        {
          title: 'Payments built-in',
          meta: 'Subscriptions, payouts, and multi-provider support',
          accent: 'from-indigo-500 to-cyan-500',
        },
      ],
    },
    {
      eyebrow: 'Community signals',
      heading: 'What people are searching',
      subheading: 'Trending categories from jobs to rentals to local services across the platform.',
      items: [
        {
          title: 'Fresh jobs',
          meta: 'Hiring surges in delivery, ops, and sales roles',
          accent: 'from-purple-500 to-indigo-500',
        },
        {
          title: 'Rental hotspots',
          meta: '1/2 BHKs moving fastest in metro suburbs',
          accent: 'from-rose-500 to-orange-500',
        },
        {
          title: 'Home services',
          meta: 'Demand spikes for cleaning, AC servicing, and painters',
          accent: 'from-emerald-500 to-teal-500',
        },
        {
          title: 'Education & skills',
          meta: 'Language tutors and upskilling bootcamps trending',
          accent: 'from-cyan-500 to-blue-500',
        },
        {
          title: 'Automotive',
          meta: 'Pre-loved scooters and EV test-ride requests rising',
          accent: 'from-amber-500 to-yellow-400',
        },
      ],
    },
    {
      eyebrow: 'Seller wins',
      heading: 'What’s performing best',
      subheading: 'Real uplift stories from boosted listings, coupons, and featured placements.',
      items: [
        {
          title: 'Boosted services',
          meta: '3.2x more bookings with weekend boosts',
          accent: 'from-teal-500 to-emerald-500',
        },
        {
          title: 'Featured rentals',
          meta: 'Leads closed in under 48 hours when featured',
          accent: 'from-blue-500 to-cyan-500',
        },
        {
          title: 'Coupons that convert',
          meta: '18% higher checkout when using limited-time coupons',
          accent: 'from-orange-500 to-amber-500',
        },
        {
          title: 'Video-first listings',
          meta: 'Short walkthroughs driving 2.4x saves',
          accent: 'from-indigo-500 to-purple-500',
        },
      ],
    },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % carouselBanners.length);
    }, 6000);

    return () => clearInterval(interval);
  }, [carouselBanners.length]);

  const handlePrevBanner = (): void => {
    setCurrentBanner((prev) => (prev - 1 + carouselBanners.length) % carouselBanners.length);
  };

  const handleNextBanner = (): void => {
    setCurrentBanner((prev) => (prev + 1) % carouselBanners.length);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-orange-50/30 to-white text-slate-900">
      <nav className="fixed top-0 w-full bg-white shadow-sm z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-20 gap-8 sm:gap-10">
            <Logo size="lg" showText={true} />
            <div className="flex items-center gap-4 sm:gap-8">
              <Link to="/" className="text-slate-600 hover:text-[#1e5da8] transition font-medium">
                Home
              </Link>
              <Link
                to="/features"
                className="text-slate-600 hover:text-[#1e5da8] transition font-medium"
              >
                Features
              </Link>
              <Link
                to="/contact"
                className="text-slate-600 hover:text-[#1e5da8] transition font-medium"
              >
                Contact
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <section className="pt-16 pb-0">
        <div className="relative">
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#1e5da8]/5 to-[#ff9933]/10 pointer-events-none"></div>
            <div className="relative w-full max-w-[1920px] mx-auto aspect-[1920/550]">
              {carouselBanners.map((banner, index) => (
                <div
                  key={`${banner.title}-${index}`}
                  className={`absolute inset-0 bg-gradient-to-br ${banner.accent} transition-all duration-1000 ${
                    index === currentBanner ? 'opacity-100' : 'opacity-0'
                  }`}
                  style={banner.imageUrl ? {
                    backgroundImage: `url(${banner.imageUrl})`,
                    backgroundSize: 'contain',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                  } : undefined}
                >
                  {!banner.imageUrl && (
                    <>
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(30,93,168,0.3),rgba(255,255,255,0)_50%)]"></div>
                      <div className="absolute inset-0 bg-slate-950/30"></div>
                      <div className="absolute top-0 right-1/4 h-96 w-96 rounded-full bg-white/20 blur-3xl animate-pulse"></div>
                      <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-[#ff9933]/25 blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
                      <div className="absolute top-1/2 left-0 h-72 w-72 rounded-full bg-[#1e5da8]/15 blur-3xl"></div>
                    </>
                  )}

                  {!banner.imageUrl && banner.hasSections ? (
                    <div className="relative h-full flex flex-col items-center justify-center px-6 sm:px-10 lg:px-16 py-12 text-center">
                      <div className="w-full max-w-5xl rounded-[2rem] border-2 border-white/30 bg-gradient-to-b from-white/15 to-white/5 backdrop-blur-xl px-6 sm:px-12 lg:px-16 py-10 sm:py-14 shadow-[0_20px_70px_-15px_rgba(0,0,0,0.4)]">
                        <div className="inline-block px-4 py-1.5 rounded-full bg-white/20 border border-white/40 backdrop-blur-sm mb-6">
                          <span className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">✨ Welcome to NearHub</span>
                        </div>
                        <h1 className={`text-5xl sm:text-6xl lg:text-8xl font-black mb-6 tracking-tight ${banner.text} leading-[1.1]`}>
                          {banner.title}
                          <br />
                          <span className="text-white/95 bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">{banner.subtitle}</span>
                        </h1>
                        <p
                          className={`text-lg sm:text-xl lg:text-2xl mb-10 max-w-3xl mx-auto leading-relaxed ${banner.text} opacity-95 font-medium`}
                        >
                          {banner.description}
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 mb-12 justify-center">
                          <button className="group px-10 py-4 rounded-2xl font-bold text-base sm:text-lg transition-all duration-300 transform hover:-translate-y-1 hover:scale-[1.03] bg-white text-slate-900 hover:bg-gradient-to-r hover:from-white hover:to-gray-50 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.4)] hover:shadow-[0_20px_60px_-10px_rgba(0,0,0,0.5)]">
                            <span className="flex items-center gap-2">{banner.cta} <span className="group-hover:translate-x-1 transition-transform">→</span></span>
                          </button>
                          <button className="px-10 py-4 rounded-2xl font-bold text-base sm:text-lg border-2 transition-all duration-300 transform hover:-translate-y-1 hover:scale-[1.03] border-white/90 text-white hover:bg-white/20 hover:border-white backdrop-blur-sm shadow-lg">
                            {banner.ctaSecondary}
                          </button>
                        </div>
                        {banner.stats && (
                          <div className="grid grid-cols-3 gap-4 sm:gap-6 w-full max-w-3xl mx-auto">
                            {banner.stats.map((stat) => (
                              <div
                                key={stat.label}
                                className="group text-white text-center rounded-2xl border-2 border-white/40 bg-gradient-to-b from-white/20 to-white/5 backdrop-blur-lg px-4 py-5 sm:py-6 hover:border-white/60 hover:from-white/25 hover:to-white/10 transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1"
                              >
                                <p className="text-4xl sm:text-5xl font-black leading-none mb-2 bg-gradient-to-b from-white to-white/90 bg-clip-text text-transparent">{stat.value}</p>
                                <p className="text-xs sm:text-sm font-semibold opacity-90 uppercase tracking-wide">{stat.label}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : !banner.imageUrl ? (
                    <div className="relative h-full flex items-center px-6 sm:px-10 lg:px-20 py-12">
                      <div className="max-w-4xl rounded-[2rem] border-2 border-white/30 bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-xl px-8 sm:px-12 py-10 shadow-[0_20px_70px_-15px_rgba(0,0,0,0.4)]">
                        <div className="inline-block px-4 py-1.5 rounded-full bg-white/20 border border-white/40 backdrop-blur-sm mb-5">
                          <span className="text-xs font-bold text-white uppercase tracking-wider">✨ Featured</span>
                        </div>
                        <h2
                          className={`text-4xl sm:text-6xl lg:text-7xl font-black mb-5 tracking-tight ${banner.text} leading-[1.1]`}
                        >
                          {banner.title}
                        </h2>
                        <p
                          className={`text-lg sm:text-2xl mb-8 max-w-2xl leading-relaxed ${banner.text} opacity-95 font-medium`}
                        >
                          {banner.subtitle}
                        </p>
                        <button className="group px-10 py-4 rounded-2xl font-bold text-base sm:text-lg transition-all duration-300 transform hover:-translate-y-1 hover:scale-[1.03] bg-white text-slate-900 hover:bg-gradient-to-r hover:from-white hover:to-gray-50 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.4)] hover:shadow-[0_20px_60px_-10px_rgba(0,0,0,0.5)]">
                          <span className="flex items-center gap-2">{banner.cta} <span className="group-hover:translate-x-1 transition-transform">→</span></span>
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            <button
              onClick={handlePrevBanner}
              className="absolute left-2 sm:left-4 md:left-8 top-1/2 -translate-y-1/2 z-20 h-10 w-10 sm:h-14 sm:w-14 md:h-16 md:w-16 flex items-center justify-center bg-white/90 hover:bg-white text-slate-900 rounded-full transition-all duration-300 shadow-[0_8px_30px_rgba(0,0,0,0.3)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.4)] border-2 border-white/80 hover:scale-110 backdrop-blur-sm"
              aria-label="Previous banner"
            >
              <ChevronLeft className="w-5 h-5 sm:w-7 sm:h-7" strokeWidth={3} />
            </button>
            <button
              onClick={handleNextBanner}
              className="absolute right-2 sm:right-4 md:right-8 top-1/2 -translate-y-1/2 z-20 h-10 w-10 sm:h-14 sm:w-14 md:h-16 md:w-16 flex items-center justify-center bg-white/90 hover:bg-white text-slate-900 rounded-full transition-all duration-300 shadow-[0_8px_30px_rgba(0,0,0,0.3)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.4)] border-2 border-white/80 hover:scale-110 backdrop-blur-sm"
              aria-label="Next banner"
            >
              <ChevronRight className="w-5 h-5 sm:w-7 sm:h-7" strokeWidth={3} />
            </button>

            <div className="absolute bottom-4 sm:bottom-6 md:bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 sm:gap-2.5 rounded-full border-2 border-white/50 bg-white/25 px-3 py-2 sm:px-4 sm:py-2.5 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
              {carouselBanners.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentBanner(index)}
                  className={`h-2.5 sm:h-3 rounded-full transition-all duration-500 shadow-sm ${
                    index === currentBanner 
                      ? 'w-8 sm:w-10 bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]' 
                      : 'w-2.5 sm:w-3 bg-white/60 hover:bg-white/90 hover:w-4 sm:hover:w-5'
                  }`}
                  aria-label={`Go to banner ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 space-y-14">
        {bannerSections.map((section) => (
          <div key={section.heading} className="space-y-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-cyan-700">
                    {section.eyebrow}
                  </p>
                  <h2 className="text-4xl sm:text-5xl font-black text-slate-900">{section.heading}</h2>
                </div>
                <p className="text-slate-600 max-w-xl">{section.subheading}</p>
              </div>
            </div>

            <div className="scroll-banner bg-white/80 shadow-md">
              <div className="scroll-banner-track px-6 py-6">
                {[...section.items, ...section.items].map((item, index) => (
                  <div
                    key={`${section.heading}-${item.title}-${index}`}
                    className="min-w-[260px] md:min-w-[320px] bg-white border border-cyan-100 rounded-xl px-5 py-4 shadow-sm hover:shadow-lg transition duration-300"
                  >
                    <div
                      className={`inline-flex items-center gap-2 text-sm font-semibold text-white px-3 py-1 rounded-full bg-gradient-to-r ${item.accent}`}
                    >
                      <span className="text-xs">NOW</span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mt-3 mb-2">{item.title}</h3>
                    <p className="text-slate-600 text-sm leading-relaxed">{item.meta}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </section>

      <LandingFooter />
    </div>
  );
}
