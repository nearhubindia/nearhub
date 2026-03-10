import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

type RouteMeta = {
  title: string;
  description: string;
  robots?: 'index,follow' | 'noindex,nofollow';
};

const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://nearhub.in').replace(/\/+$/, '');
const DEFAULT_IMAGE_URL = `${SITE_URL}/nearhub.png`;

const FOOTER_META: Record<string, RouteMeta> = {
  'browse-listings': {
    title: 'Browse Listings | NearHub',
    description: 'Explore fresh local listings across categories on NearHub.',
  },
  'post-an-ad': {
    title: 'Post an Ad | NearHub',
    description: 'Publish your NearHub listing with images or video in minutes.',
  },
  categories: {
    title: 'Categories | NearHub',
    description: 'Discover listing categories across jobs, services, vehicles, homes, and more.',
  },
  'mobile-app': {
    title: 'Mobile App | NearHub',
    description: 'NearHub mobile experience for fast, local buying and selling.',
  },
  'about-us': {
    title: 'About NearHub',
    description: 'Learn about NearHub and our mission to improve local commerce.',
  },
  careers: {
    title: 'Careers | NearHub',
    description: 'Join the NearHub team building the future of hyperlocal marketplaces.',
  },
  blog: {
    title: 'Blog | NearHub',
    description: 'Insights from NearHub on product, growth, and local marketplace operations.',
  },
  'press-kit': {
    title: 'Press Kit | NearHub',
    description: 'NearHub brand references and media resources.',
  },
  'help-center': {
    title: 'Help Center | NearHub',
    description: 'Support resources for buyers, sellers, and administrators on NearHub.',
  },
  'safety-tips': {
    title: 'Safety Tips | NearHub',
    description: 'Practical marketplace safety guidance for secure local transactions.',
  },
  'terms-of-service': {
    title: 'Terms of Service | NearHub',
    description: 'Read NearHub terms governing platform usage.',
  },
  'privacy-policy': {
    title: 'Privacy Policy | NearHub',
    description: 'Understand how NearHub handles personal data and privacy.',
  },
  'report-issue': {
    title: 'Report an Issue | NearHub',
    description: 'Report a NearHub issue with context for faster resolution.',
  },
  cookies: {
    title: 'Cookie Policy | NearHub',
    description: 'How NearHub uses cookies for functionality and analytics.',
  },
  sitemap: {
    title: 'Sitemap | NearHub',
    description: 'Browse a structured overview of key NearHub routes and sections.',
  },
};

function upsertMeta(
  attr: 'name' | 'property',
  key: string,
  content: string,
  parent: HTMLElement = document.head
) {
  let meta = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(attr, key);
    parent.appendChild(meta);
  }
  meta.setAttribute('content', content);
}

function upsertCanonical(href: string) {
  let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

function resolveMeta(pathname: string): RouteMeta {
  if (pathname.startsWith('/admin')) {
    return {
      title: 'NearHub Admin',
      description: 'NearHub administration portal.',
      robots: 'noindex,nofollow',
    };
  }

  if (pathname === '/') {
    return {
      title: 'NearHub | Buy, Sell & Discover Near You',
      description:
        'NearHub is a hyperlocal classifieds platform to buy, sell, and discover trusted listings near you.',
    };
  }

  if (pathname === '/features') {
    return {
      title: 'Features | NearHub',
      description:
        'Explore NearHub features including video-first listings, geo discovery, alerts, and trust controls.',
    };
  }

  if (pathname === '/contact') {
    return {
      title: 'Contact | NearHub',
      description: 'Get in touch with NearHub for support, partnerships, and platform enquiries.',
    };
  }

  if (pathname.startsWith('/footer/')) {
    const key = pathname.split('/')[2] || '';
    return (
      FOOTER_META[key] || {
        title: 'NearHub',
        description: 'NearHub hyperlocal classifieds platform.',
      }
    );
  }

  return {
    title: 'NearHub',
    description: 'NearHub hyperlocal classifieds platform.',
  };
}

export function SeoManager() {
  const location = useLocation();

  useEffect(() => {
    const { pathname } = location;
    const meta = resolveMeta(pathname);
    const canonicalUrl = `${SITE_URL}${pathname === '/' ? '' : pathname}`;
    const robots = meta.robots || 'index,follow';

    document.title = meta.title;
    document.documentElement.lang = 'en';

    upsertMeta('name', 'description', meta.description);
    upsertMeta('name', 'robots', robots);
    upsertMeta(
      'name',
      'keywords',
      'nearhub, classifieds, buy and sell, local marketplace, hyperlocal listings, ads'
    );

    upsertMeta('property', 'og:title', meta.title);
    upsertMeta('property', 'og:description', meta.description);
    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:url', canonicalUrl);
    upsertMeta('property', 'og:image', DEFAULT_IMAGE_URL);
    upsertMeta('property', 'og:site_name', 'NearHub');

    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', meta.title);
    upsertMeta('name', 'twitter:description', meta.description);
    upsertMeta('name', 'twitter:image', DEFAULT_IMAGE_URL);

    upsertCanonical(canonicalUrl);
  }, [location]);

  return null;
}
