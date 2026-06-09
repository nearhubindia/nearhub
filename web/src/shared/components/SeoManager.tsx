import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import seoConfigData from '../../../seo/routes.json';
import { BRAND_NAME, BRAND_SIGNATURE } from '@/shared/brand';

type RouteMeta = {
  title: string;
  description: string;
  robots?: 'index,follow' | 'noindex,nofollow';
};

type SeoRouteConfig = {
  path: string;
  title: string;
  description: string;
  robots?: 'index,follow' | 'noindex,nofollow';
};

type SeoRoutesConfig = {
  siteUrlFallback: string;
  brandName?: string;
  alternateBrandNames?: string[];
  socialProfiles?: string[];
  defaultImagePath: string;
  keywords: string;
  defaultMeta: {
    title: string;
    description: string;
  };
  noindexPrefixes: string[];
  routes: SeoRouteConfig[];
};

const SEO_CONFIG = seoConfigData as SeoRoutesConfig;
const SITE_URL = (import.meta.env.VITE_SITE_URL || SEO_CONFIG.siteUrlFallback).replace(/\/+$/, '');
const SITE_BRAND_NAME = SEO_CONFIG.brandName || BRAND_NAME;
const ALTERNATE_BRAND_NAMES = Array.isArray(SEO_CONFIG.alternateBrandNames)
  ? SEO_CONFIG.alternateBrandNames.filter(Boolean)
  : [];
const SOCIAL_PROFILES = Array.isArray(SEO_CONFIG.socialProfiles)
  ? SEO_CONFIG.socialProfiles.filter(Boolean)
  : [];
const DEFAULT_IMAGE_URL = `${SITE_URL}${SEO_CONFIG.defaultImagePath}`;
const ROUTE_META = new Map<string, RouteMeta>(
  SEO_CONFIG.routes.map((route) => [
    route.path,
    { title: route.title, description: route.description, robots: route.robots },
  ])
);

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

function upsertJsonLd(id: string, data: Record<string, unknown>) {
  let script = document.querySelector(
    `script[type="application/ld+json"][data-seo-id="${id}"]`
  ) as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.setAttribute('type', 'application/ld+json');
    script.setAttribute('data-seo-id', id);
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
}

function resolveMeta(pathname: string): RouteMeta {
  const normalizedPath = normalizeLookupPath(pathname);
  const isNoindexPath = SEO_CONFIG.noindexPrefixes.some((prefix) =>
    normalizedPath.startsWith(prefix)
  );
  if (isNoindexPath) {
    return {
      title: 'NearHub Admin',
      description: `${BRAND_SIGNATURE}. Administration portal.`,
      robots: 'noindex,nofollow',
    };
  }

  if (normalizedPath.startsWith('/listing/')) {
    return {
      title: `Listing Details | ${SITE_BRAND_NAME}`,
      description:
        'View NearHub listing details, seller information, pricing, and local deal availability.',
      robots: 'index,follow',
    };
  }

  if (normalizedPath.startsWith('/edit-listing/')) {
    return {
      title: `Edit Listing | ${SITE_BRAND_NAME}`,
      description: 'Update your NearHub listing details, photos, category, location, and deal settings.',
      robots: 'noindex,nofollow',
    };
  }

  if (normalizedPath.startsWith('/order-summary/')) {
    return {
      title: `Deal Checkout | ${SITE_BRAND_NAME}`,
      description: 'Review and purchase your NearHub deal voucher.',
      robots: 'noindex,nofollow',
    };
  }

  if (normalizedPath.startsWith('/messages/')) {
    return {
      title: `Conversation | ${SITE_BRAND_NAME}`,
      description: 'View your NearHub buyer and seller conversation.',
      robots: 'noindex,nofollow',
    };
  }

  if (normalizedPath.startsWith('/shorts/') || normalizedPath.startsWith('/short/')) {
    return {
      title: `NearHub Short | ${SITE_BRAND_NAME}`,
      description: 'Open a NearHub short video listing.',
      robots: 'noindex,nofollow',
    };
  }

  const routeMeta = ROUTE_META.get(normalizedPath);
  if (routeMeta) {
    return routeMeta;
  }

  return {
    title: `Page Not Found | ${BRAND_SIGNATURE}`,
    description:
      'The page you are looking for does not exist on NearHub. Return to the homepage to buy, sell, and discover local deals near you.',
    robots: 'noindex,nofollow',
  };
}

function buildJsonLd(
  pathname: string,
  canonicalUrl: string,
  meta: RouteMeta
): Record<string, unknown> {
  const organizationNode: Record<string, unknown> = {
    '@type': 'Organization',
    '@id': `${SITE_URL}#organization`,
    name: SITE_BRAND_NAME,
    alternateName: ALTERNATE_BRAND_NAMES,
    url: SITE_URL,
    logo: DEFAULT_IMAGE_URL,
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: 'support@nearhub.com',
        areaServed: 'IN',
        availableLanguage: ['en'],
      },
    ],
  };

  if (SOCIAL_PROFILES.length > 0) {
    organizationNode.sameAs = SOCIAL_PROFILES;
  }

  const graph: Record<string, unknown>[] = [
    organizationNode,
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}#website`,
      name: SITE_BRAND_NAME,
      alternateName: ALTERNATE_BRAND_NAMES,
      url: SITE_URL,
    },
    {
      '@type': 'WebPage',
      '@id': `${canonicalUrl}#webpage`,
      url: canonicalUrl,
      name: meta.title,
      description: meta.description,
      isPartOf: { '@id': `${SITE_URL}#website` },
    },
  ];

  if (pathname === '/') {
    graph.push({
      '@type': 'CollectionPage',
      '@id': `${canonicalUrl}#home`,
      url: canonicalUrl,
      name: BRAND_SIGNATURE,
      isPartOf: { '@id': `${SITE_URL}#website` },
      about: { '@id': `${SITE_URL}#organization` },
    });
  }

  if (pathname === '/contact') {
    graph.push({
      '@type': 'ContactPage',
      '@id': `${canonicalUrl}#contact`,
      url: canonicalUrl,
      name: 'NearHub Contact',
      isPartOf: { '@id': `${SITE_URL}#website` },
      about: { '@id': `${SITE_URL}#organization` },
    });
  }

  if (pathname === '/about') {
    graph.push({
      '@type': 'AboutPage',
      '@id': `${canonicalUrl}#about`,
      url: canonicalUrl,
      name: 'About NearHub',
      isPartOf: { '@id': `${SITE_URL}#website` },
      about: { '@id': `${SITE_URL}#organization` },
    });
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}

function normalizeCanonicalPath(pathname: string) {
  if (!pathname || pathname === '/') {
    return '/';
  }
  return pathname.endsWith('/') ? pathname : `${pathname}/`;
}

function normalizeLookupPath(pathname: string) {
  if (!pathname || pathname === '/') {
    return '/';
  }
  return pathname.replace(/\/+$/, '');
}

export function SeoManager() {
  const location = useLocation();

  useEffect(() => {
    const { pathname } = location;
    const normalizedPath = normalizeLookupPath(pathname);
    const meta = resolveMeta(normalizedPath);
    const canonicalPath = normalizeCanonicalPath(pathname);
    const canonicalUrl = `${SITE_URL}${canonicalPath}`;
    const robots = meta.robots || 'index,follow';

    document.title = meta.title;
    document.documentElement.lang = 'en';

    upsertMeta('name', 'description', meta.description);
    upsertMeta('name', 'robots', robots);
    upsertMeta('name', 'googlebot', robots);
    upsertMeta('name', 'keywords', SEO_CONFIG.keywords);

    upsertMeta('property', 'og:title', meta.title);
    upsertMeta('property', 'og:description', meta.description);
    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:url', canonicalUrl);
    upsertMeta('property', 'og:image', DEFAULT_IMAGE_URL);
    upsertMeta('property', 'og:image:alt', BRAND_SIGNATURE);
    upsertMeta('property', 'og:locale', 'en_IN');
    upsertMeta('property', 'og:site_name', SITE_BRAND_NAME);
    upsertMeta('name', 'application-name', SITE_BRAND_NAME);
    upsertMeta('name', 'apple-mobile-web-app-title', SITE_BRAND_NAME);

    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', meta.title);
    upsertMeta('name', 'twitter:description', meta.description);
    upsertMeta('name', 'twitter:image', DEFAULT_IMAGE_URL);
    upsertMeta('name', 'twitter:image:alt', BRAND_SIGNATURE);

    upsertCanonical(canonicalUrl);
    upsertJsonLd('nearhub-structured-data', buildJsonLd(normalizedPath, canonicalUrl, meta));
  }, [location]);

  return null;
}
