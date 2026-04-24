import type { ReactElement } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowRight, Download, Smartphone } from 'lucide-react';
import { LandingFooter, LandingHeader } from '@/shared/components';
import { BRAND_SIGNATURE } from '@/shared/brand';

interface FooterPageSection {
  heading: string;
  points: string[];
}

interface FooterPageConfig {
  title: string;
  subtitle: string;
  tag: string;
  sections: FooterPageSection[];
}

const footerPageConfigs: Record<string, FooterPageConfig> = {
  'browse-listings': {
    title: 'Browse Listings',
    subtitle: 'Explore app-first listings designed for faster local discovery and buyer action.',
    tag: 'Platform',
    sections: [
      {
        heading: 'Home Feed + Search Module',
        points: [
          'Personalized home feed ranks listings by freshness, relevance, and local demand.',
          'Search supports category, city, pincode, and distance-based filtering for better intent.',
          'Listing cards surface key details quickly to reduce drop-off before first contact.',
        ],
      },
      {
        heading: 'Listing Details + Conversion Module',
        points: [
          'Detail pages combine photos, video shorts, pricing, and trust signals in one view.',
          'Call and chat actions are placed for one-tap response from interested buyers.',
          'Saved listings and history modules help users return and convert faster.',
        ],
      },
      {
        heading: 'Mobile Buyer Journey',
        points: [
          'Everything is optimized for quick thumb navigation inside the mobile app.',
          'Lightweight modules keep browsing smooth even on slower networks.',
          'Designed to maximize quality enquiries instead of passive impressions.',
        ],
      },
    ],
  },
  'post-an-ad': {
    title: 'Post an Ad',
    subtitle: 'Publish from the app with a guided seller module built for speed and trust.',
    tag: 'Platform',
    sections: [
      {
        heading: 'Create Listing Module',
        points: [
          'Category-smart form flow reduces errors and speeds up listing completion.',
          'Supports image sets and video shorts for higher response-quality leads.',
          'Price, condition, and location inputs are structured for better discovery ranking.',
        ],
      },
      {
        heading: 'Seller Growth Module',
        points: [
          'Promote listings with boosts and featured visibility windows.',
          'Track enquiry quality and listing performance from seller-facing insights.',
          'Use campaign-style promotion controls directly from mobile workflows.',
        ],
      },
      {
        heading: 'Trust + Quality Module',
        points: [
          'Verified seller signals improve confidence before buyers initiate contact.',
          'Moderation and report handling keep marketplace quality high.',
          'Listing quality checks reduce spam and low-value posting behavior.',
        ],
      },
    ],
  },
  categories: {
    title: 'Categories',
    subtitle: 'App-native category architecture built for local commerce and service discovery.',
    tag: 'Platform',
    sections: [
      {
        heading: 'Category Structure Module',
        points: [
          'Supports core verticals like electronics, vehicles, services, jobs, and real estate.',
          'Each category has tailored fields to improve listing quality and buyer clarity.',
          'Architecture is extensible for future categories without changing app flow.',
        ],
      },
      {
        heading: 'Relevance + Ranking Module',
        points: [
          'Category-specific attributes improve search ranking precision.',
          'Structured data supports cleaner filters and higher-intent discovery.',
          'Smarter category matching helps buyers find relevant listings faster.',
        ],
      },
      {
        heading: 'Mobile Experience Module',
        points: [
          'Category browse and switch flows are built for mobile-first interaction.',
          'Visual hierarchy and media cards make scanning easier on smaller screens.',
          'Designed to reduce taps and speed up buyer decision time.',
        ],
      },
    ],
  },
  'mobile-app': {
    title: 'Mobile App',
    subtitle: 'NearHub is a mobile-first platform engineered for fast local buying and selling.',
    tag: 'Platform',
    sections: [
      {
        heading: 'Core App Modules',
        points: [
          'Home discovery, create listing, chat, profile, and saved modules in one app.',
          'Notification module keeps sellers updated on enquiries in real time.',
          'In-app moderation and trust workflows protect listing quality.',
        ],
      },
      {
        heading: 'Speed + Reliability Layer',
        points: [
          'Optimized media pipeline for smooth photo/video rendering on mobile devices.',
          'Session continuity and fast navigation built for daily active usage.',
          'Engineered for high-intent interactions, not passive feed consumption.',
        ],
      },
      {
        heading: 'Business Impact Module',
        points: [
          'Video-first listings drive faster responses than text-only posts.',
          'Verified business badges increase trust and conversion probability.',
          'Hyperlocal ranking improves lead quality for sellers and service teams.',
        ],
      },
    ],
  },
  'about-us': {
    title: 'About Us',
    subtitle: 'NearHub is focused on high-trust local marketplace experiences.',
    tag: 'Company',
    sections: [
      {
        heading: 'Our Focus',
        points: [
          'Build meaningful local commerce connections.',
          'Enable sellers with growth and visibility controls.',
          'Deliver a secure and modern buying experience.',
        ],
      },
      {
        heading: 'How We Build',
        points: [
          'Product-first design informed by user behavior.',
          'Scalable architecture with admin automation.',
          'Continuous improvements through real feedback loops.',
        ],
      },
    ],
  },
  careers: {
    title: 'Careers',
    subtitle: 'Join a team shaping the next generation of local commerce.',
    tag: 'Company',
    sections: [
      {
        heading: 'What We Value',
        points: [
          'Ownership, speed, and product quality.',
          'Clear communication and practical decision-making.',
          'User impact over unnecessary complexity.',
        ],
      },
      {
        heading: 'Open Roles',
        points: [
          'Engineering, product, design, and operations.',
          'Growth, support, and marketplace strategy.',
          'Cross-functional opportunities with real ownership.',
        ],
      },
    ],
  },
  blog: {
    title: 'Blog',
    subtitle: 'Insights on marketplace strategy, growth, and product execution.',
    tag: 'Company',
    sections: [
      {
        heading: 'Topics',
        points: [
          'Seller growth playbooks and conversion tips.',
          'Platform updates and feature deep dives.',
          'Trust, moderation, and quality best practices.',
        ],
      },
      {
        heading: 'For Teams',
        points: [
          'Operational patterns from real marketplace use.',
          'Engineering notes from scaling product workflows.',
          'Decision frameworks used in production planning.',
        ],
      },
    ],
  },
  'press-kit': {
    title: 'Press Kit',
    subtitle: 'Brand and product reference for media and partners.',
    tag: 'Company',
    sections: [
      {
        heading: 'Brand Assets',
        points: [
          'Logo usage guidance and color system references.',
          'Product screenshots and interface previews.',
          'Messaging basics for accurate representation.',
        ],
      },
      {
        heading: 'Media Requests',
        points: [
          'Partnership and press enquiries support.',
          'Product briefings and milestone highlights.',
          'Structured communication for external publications.',
        ],
      },
    ],
  },
  'help-center': {
    title: 'Help Center',
    subtitle: 'Find support resources for buyers, sellers, and admins.',
    tag: 'Support',
    sections: [
      {
        heading: 'Common Help',
        points: [
          'Account setup and access guidance.',
          'Posting, managing, and promoting listings.',
          'Resolving listing visibility or moderation questions.',
        ],
      },
      {
        heading: 'Operational Support',
        points: [
          'Subscription and billing assistance.',
          'Notification and settings troubleshooting.',
          'Escalation paths for urgent issues.',
        ],
      },
    ],
  },
  'safety-tips': {
    title: 'Safety Tips',
    subtitle: 'Practical guidance to keep interactions secure and reliable.',
    tag: 'Support',
    sections: [
      {
        heading: 'User Safety',
        points: [
          'Verify details before completing transactions.',
          'Avoid sharing sensitive credentials or OTPs.',
          'Use clear communication and track agreements.',
        ],
      },
      {
        heading: 'Listing Integrity',
        points: [
          'Provide accurate descriptions and media.',
          'Report suspicious or misleading listings.',
          'Respect platform rules for safe community behavior.',
        ],
      },
    ],
  },
  'terms-of-service': {
    title: 'Terms of Service',
    subtitle: 'Rules and responsibilities for using the NearHub platform.',
    tag: 'Legal',
    sections: [
      {
        heading: 'Use of Platform',
        points: [
          'Users must provide accurate information.',
          'Content should comply with marketplace rules.',
          'Violations may result in moderation actions.',
        ],
      },
      {
        heading: 'Operational Terms',
        points: [
          'Pricing, subscriptions, and promotions follow platform policy.',
          'Feature access can vary by plan and category.',
          'NearHub reserves rights to maintain trust and safety.',
        ],
      },
    ],
  },
  'privacy-policy': {
    title: 'Privacy Policy',
    subtitle: 'How we handle user data, security, and consent.',
    tag: 'Legal',
    sections: [
      {
        heading: 'Data Usage',
        points: [
          'Collected data helps improve discovery and trust.',
          'Operational logs support reliability and moderation.',
          'Sensitive actions include security safeguards.',
        ],
      },
      {
        heading: 'User Control',
        points: [
          'Users can manage profile and communication preferences.',
          'Data handling aligns with platform privacy commitments.',
          'Requests can be routed through official support channels.',
        ],
      },
    ],
  },
  'report-issue': {
    title: 'Report Issue',
    subtitle: 'Submit platform issues with context for faster resolution.',
    tag: 'Support',
    sections: [
      {
        heading: 'What to Include',
        points: [
          'Clear summary of the issue and expected behavior.',
          'Affected listing, account, or flow details.',
          'Screenshots or timestamps when available.',
        ],
      },
      {
        heading: 'Issue Handling',
        points: [
          'Reports are reviewed and prioritized by impact.',
          'Critical trust and payment issues are escalated.',
          'Teams track closure with measurable response goals.',
        ],
      },
    ],
  },
  cookies: {
    title: 'Cookie Policy',
    subtitle: 'How cookies are used for functionality and analytics.',
    tag: 'Legal',
    sections: [
      {
        heading: 'Essential Cookies',
        points: [
          'Enable sessions, authentication, and platform continuity.',
          'Support security and request integrity.',
          'Required for core marketplace functionality.',
        ],
      },
      {
        heading: 'Optimization Cookies',
        points: [
          'Help improve performance and user experience.',
          'Inform design and feature improvements.',
          'Used responsibly to maintain relevance and speed.',
        ],
      },
    ],
  },
  sitemap: {
    title: 'Sitemap',
    subtitle: 'Structured view of key NearHub sections and flows.',
    tag: 'Platform',
    sections: [
      {
        heading: 'Core Routes',
        points: [
          'Home, Features, Contact, and marketplace funnels.',
          'Admin panels for listings, users, reports, and settings.',
          'Support and legal pages for transparency and guidance.',
        ],
      },
      {
        heading: 'Navigation Design',
        points: [
          'Fast path to high-intent actions.',
          'Clear grouping by platform, company, and support.',
          'Consistent route patterns for predictability.',
        ],
      },
    ],
  },
};

const mobileAppFocusedPageKeys = new Set([
  'browse-listings',
  'post-an-ad',
  'categories',
  'mobile-app',
]);
const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.synvide.nearhub';

export default function FooterPage(): ReactElement {
  const { pageKey } = useParams();
  const config = pageKey ? footerPageConfigs[pageKey] : undefined;
  const isMobileAppFocusedPage = Boolean(pageKey && mobileAppFocusedPageKeys.has(pageKey));

  if (!config) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7fbff_0%,#edf5ff_46%,#fff5ea_100%)] text-slate-900">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_10%,rgba(30,93,168,0.16),transparent_34%),radial-gradient(circle_at_92%_14%,rgba(255,153,51,0.18),transparent_32%),radial-gradient(circle_at_50%_92%,rgba(30,93,168,0.09),transparent_40%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(30,93,168,0.03)_1px,transparent_1px),linear-gradient(0deg,rgba(255,153,51,0.035)_1px,transparent_1px)] bg-[size:44px_44px]" />
      </div>

      <LandingHeader active="home" />

      <main className="pt-20">
        <div className="w-full px-4 pb-16 pt-8 sm:px-8 lg:px-12">
          <section className="rounded-[2rem] border border-[#1e5da8]/20 bg-[linear-gradient(125deg,#0f4684_0%,#1e5da8_42%,#ff9933_165%)] px-6 py-8 text-white shadow-[0_34px_72px_-40px_rgba(14,63,120,0.78)] sm:px-9 sm:py-10">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]">
              {config.tag}
            </p>
            <h1 className="mt-4 max-w-5xl text-3xl font-bold leading-tight sm:text-5xl">
              {config.title}
            </h1>
            <p className="mt-4 max-w-4xl text-sm leading-relaxed text-blue-50/95 sm:text-base">
              {config.subtitle}
            </p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#ffe5c8]">
              {BRAND_SIGNATURE}
            </p>
          </section>

          <section className="mt-8 grid gap-5 md:grid-cols-2">
            {config.sections.map((section) => (
              <article
                key={section.heading}
                className="group relative overflow-hidden rounded-xl border border-[#1e5da8]/14 bg-[linear-gradient(180deg,#ffffff_0%,#f3f8ff_100%)] p-6 shadow-[0_16px_34px_-26px_rgba(14,63,120,0.52)] transition duration-300 hover:-translate-y-1 hover:border-[#1e5da8]/30 hover:shadow-[0_24px_42px_-24px_rgba(30,93,168,0.66)]"
              >
                <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-[#ff9933]/12 blur-2xl transition group-hover:bg-[#ff9933]/18" />
                <h2 className="text-2xl font-bold text-[#113965]">{section.heading}</h2>
                <ul className="mt-4 space-y-2">
                  {section.points.map((point) => (
                    <li key={point} className="flex items-start gap-2 text-slate-600">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#ff9933]" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </section>

          {isMobileAppFocusedPage && (
            <section className="mt-9 overflow-hidden rounded-[2rem] border border-[#1e5da8]/18 bg-[linear-gradient(120deg,#0f3f78_0%,#1e5da8_58%,#ff9933_165%)] px-6 py-8 text-white shadow-[0_30px_62px_-38px_rgba(15,63,120,0.8)] sm:px-9 lg:flex lg:items-center lg:justify-between lg:gap-10">
              <div>
                <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#ffe2bf]">
                  <Smartphone size={14} />
                  Mobile App Focused
                </p>
                <h3 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">
                  Download NearHub On Google Play
                </h3>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-blue-50/95 sm:text-base">
                  These modules are designed for the mobile app experience with faster posting,
                  video-first discovery, verified trust signals, and real-time enquiry handling.
                </p>
              </div>
              <div className="mt-5 lg:mt-0">
                <a
                  href={playStoreUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#ff9933] px-6 py-3 text-sm font-semibold text-slate-900 shadow-[0_14px_34px_-18px_rgba(255,153,51,0.95)] transition hover:bg-[#ffad57]"
                >
                  <Download size={18} />
                  Download On Play Store
                </a>
              </div>
            </section>
          )}

          <section className="mt-9 overflow-hidden rounded-[2rem] border border-[#1e5da8]/18 bg-[linear-gradient(120deg,#0f3f78_0%,#1e5da8_58%,#ff9933_165%)] px-6 py-8 text-white shadow-[0_30px_62px_-38px_rgba(15,63,120,0.8)] sm:px-9 lg:flex lg:items-center lg:justify-between lg:gap-10">
            <div>
              <div>
                <h3 className="text-3xl font-bold leading-tight sm:text-4xl">
                  Need More Information?
                </h3>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-blue-50/95 sm:text-base">
                  Reach out and our team can guide you through this section in detail.
                </p>
              </div>
            </div>
            <div className="mt-5 lg:mt-0">
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 rounded-xl bg-[#ff9933] px-6 py-3 text-sm font-semibold text-slate-900 shadow-[0_14px_34px_-18px_rgba(255,153,51,0.95)] transition hover:bg-[#ffad57]"
              >
                Contact Team
                <ArrowRight size={18} />
              </Link>
            </div>
          </section>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
