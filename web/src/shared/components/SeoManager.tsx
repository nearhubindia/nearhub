import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import seoConfigData from '../../../seo/routes.json';

type RouteMeta = {
  title: string;
  description: string;
  robots?: 'index,follow' | 'noindex,nofollow';
};

type SeoRouteConfig = {
  path: string;
  title: string;
  description: string;
};

type SeoRoutesConfig = {
  siteUrlFallback: string;
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
const DEFAULT_IMAGE_URL = `${SITE_URL}${SEO_CONFIG.defaultImagePath}`;
const ROUTE_META = new Map<string, RouteMeta>(
  SEO_CONFIG.routes.map((route) => [
    route.path,
    { title: route.title, description: route.description },
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
  const isNoindexPath = SEO_CONFIG.noindexPrefixes.some((prefix) => pathname.startsWith(prefix));
  if (isNoindexPath) {
    return {
      title: 'NearHub Admin',
      description: 'NearHub administration portal.',
      robots: 'noindex,nofollow',
    };
  }

  const routeMeta = ROUTE_META.get(pathname);
  if (routeMeta) {
    return routeMeta;
  }

  return {
    title: SEO_CONFIG.defaultMeta.title,
    description: SEO_CONFIG.defaultMeta.description,
  };
}

function buildJsonLd(
  pathname: string,
  canonicalUrl: string,
  meta: RouteMeta
): Record<string, unknown> {
  const graph: Record<string, unknown>[] = [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}#organization`,
      name: 'NearHub',
      url: SITE_URL,
      logo: DEFAULT_IMAGE_URL,
      sameAs: [
        'https://x.com',
        'https://www.facebook.com',
        'https://www.linkedin.com',
        'https://www.instagram.com',
      ],
      contactPoint: [
        {
          '@type': 'ContactPoint',
          contactType: 'customer support',
          email: 'support@nearhub.com',
          areaServed: 'IN',
          availableLanguage: ['en'],
        },
      ],
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}#website`,
      name: 'NearHub',
      url: SITE_URL,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${SITE_URL}/?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
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
      name: 'NearHub Home',
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
      SEO_CONFIG.keywords
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
    upsertJsonLd('nearhub-structured-data', buildJsonLd(pathname, canonicalUrl, meta));
  }, [location]);

  return null;
}
