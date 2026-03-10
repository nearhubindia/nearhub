import type { ReactElement } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { LandingFooter, Logo } from '@/shared/components';

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
    subtitle: 'Explore fresh, trusted listings across categories and locations.',
    tag: 'Platform',
    sections: [
      {
        heading: 'Smart Discovery',
        points: [
          'Search by category, city, and local relevance.',
          'Filter by price, media type, and posting freshness.',
          'View detailed listing pages with seller context.',
        ],
      },
      {
        heading: 'High Intent UX',
        points: [
          'Designed for quick scanning and confident actions.',
          'Consistent cards, clean hierarchy, and conversion-first flow.',
          'Mobile-friendly layout with fast interactions.',
        ],
      },
    ],
  },
  'post-an-ad': {
    title: 'Post an Ad',
    subtitle: 'Publish image or video listings in a guided seller workflow.',
    tag: 'Platform',
    sections: [
      {
        heading: 'Seller Workflow',
        points: [
          'Simple listing creation with category-specific structure.',
          'Media upload support for images and videos.',
          'Pricing, availability, and contact readiness in one flow.',
        ],
      },
      {
        heading: 'Boost Visibility',
        points: [
          'Use featured options and boosts for higher reach.',
          'Track listing impact through admin insights.',
          'Promote strategically by category demand.',
        ],
      },
    ],
  },
  categories: {
    title: 'Categories',
    subtitle: 'Built to support diverse commerce and service needs at scale.',
    tag: 'Platform',
    sections: [
      {
        heading: 'Popular Verticals',
        points: [
          'Electronics, vehicles, real estate, and jobs.',
          'Services, education, fashion, home, and more.',
          'Extensible catalog for future category growth.',
        ],
      },
      {
        heading: 'Category Intelligence',
        points: [
          'Tailored listing fields per category.',
          'Improved search relevance and discovery quality.',
          'Better buyer confidence with structured details.',
        ],
      },
    ],
  },
  'mobile-app': {
    title: 'Mobile App',
    subtitle: 'NearHub mobile experience optimized for speed and reliability.',
    tag: 'Platform',
    sections: [
      {
        heading: 'Performance',
        points: [
          'Fast loading with optimized media pipelines.',
          'Responsive interactions for listing and search flows.',
          'Reliable notifications and session continuity.',
        ],
      },
      {
        heading: 'User Experience',
        points: [
          'Clean navigation built for local buying and selling.',
          'Consistent visual language across app and web.',
          'Designed for daily use by high-intent users.',
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

export default function FooterPage(): ReactElement {
  const { pageKey } = useParams();
  const config = pageKey ? footerPageConfigs[pageKey] : undefined;

  if (!config) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-[#fff7ef] text-slate-900">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_8%_15%,rgba(30,93,168,0.12),transparent_45%),radial-gradient(circle_at_90%_20%,rgba(255,153,51,0.14),transparent_40%)]" />

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
              <Link to="/contact" className="text-slate-600 transition hover:text-[#ff9933]">
                Contact
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="px-4 pb-20 pt-28 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <section className="rounded-3xl border border-[#1e5da8]/10 bg-gradient-to-br from-[#1e5da8]/8 via-white to-[#ff9933]/12 p-6 shadow-sm sm:p-10">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ff9933]">{config.tag}</p>
            <h1 className="mt-3 text-4xl font-black sm:text-5xl">{config.title}</h1>
            <p className="mt-3 max-w-3xl text-slate-600">{config.subtitle}</p>
          </section>

          <section className="grid gap-5 md:grid-cols-2">
            {config.sections.map((section) => (
              <article
                key={section.heading}
                className="rounded-2xl border border-[#1e5da8]/10 bg-white p-6 shadow-sm"
              >
                <h2 className="text-2xl font-black text-slate-900">{section.heading}</h2>
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

          <section className="rounded-3xl border border-[#1e5da8]/10 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-900 sm:text-3xl">
                  Need More Information?
                </h3>
                <p className="mt-2 text-slate-600">
                  Reach out and our team can guide you through this section in detail.
                </p>
              </div>
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#1e5da8] to-[#ff9933] px-6 py-3 font-bold text-white transition hover:brightness-110"
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
