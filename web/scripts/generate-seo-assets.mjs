import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const seoConfigPath = path.join(rootDir, 'seo', 'routes.json');

function normalizeSiteUrl(url) {
  return url.replace(/\/+$/, '');
}

function normalizeRoutePath(routePath) {
  if (!routePath || routePath === '/') {
    return '/';
  }

  const trimmed = routePath.replace(/^\/+/, '').replace(/\/+$/, '');
  return `/${trimmed}/`;
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeXml(value) {
  return escapeHtml(value);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function upsertMetaTag(html, attr, key, content) {
  const safeContent = escapeHtml(content);
  const replacement = `<meta ${attr}="${key}" content="${safeContent}" />`;
  const regex = new RegExp(`<meta[^>]*${attr}=["']${escapeRegExp(key)}["'][^>]*>`, 'i');

  if (regex.test(html)) {
    return html.replace(regex, replacement);
  }

  return html.replace('</head>', `  ${replacement}\n  </head>`);
}

function upsertCanonical(html, canonicalUrl) {
  const replacement = `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`;
  const regex = /<link[^>]*rel=["']canonical["'][^>]*>/i;

  if (regex.test(html)) {
    return html.replace(regex, replacement);
  }

  return html.replace('</head>', `  ${replacement}\n  </head>`);
}

function upsertJsonLd(html, jsonLd) {
  const replacement = `<script type="application/ld+json" data-seo-id="nearhub-structured-data">${JSON.stringify(jsonLd)}</script>`;
  const regex =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*data-seo-id=["']nearhub-structured-data["'][^>]*>[\s\S]*?<\/script>/i;

  if (regex.test(html)) {
    return html.replace(regex, replacement);
  }

  return html.replace('</head>', `  ${replacement}\n  </head>`);
}

function buildJsonLd(pathname, canonicalUrl, meta, siteUrl, defaultImageUrl) {
  const graph = [
    {
      '@type': 'Organization',
      '@id': `${siteUrl}#organization`,
      name: 'NearHub',
      url: siteUrl,
      logo: defaultImageUrl,
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
      '@id': `${siteUrl}#website`,
      name: 'NearHub',
      url: siteUrl,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${siteUrl}/?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'WebPage',
      '@id': `${canonicalUrl}#webpage`,
      url: canonicalUrl,
      name: meta.title,
      description: meta.description,
      isPartOf: { '@id': `${siteUrl}#website` },
    },
  ];

  if (pathname === '/') {
    graph.push({
      '@type': 'CollectionPage',
      '@id': `${canonicalUrl}#home`,
      url: canonicalUrl,
      name: 'NearHub Home',
      isPartOf: { '@id': `${siteUrl}#website` },
      about: { '@id': `${siteUrl}#organization` },
    });
  }

  if (pathname === '/contact') {
    graph.push({
      '@type': 'ContactPage',
      '@id': `${canonicalUrl}#contact`,
      url: canonicalUrl,
      name: 'NearHub Contact',
      isPartOf: { '@id': `${siteUrl}#website` },
      about: { '@id': `${siteUrl}#organization` },
    });
  }

  if (pathname === '/about') {
    graph.push({
      '@type': 'AboutPage',
      '@id': `${canonicalUrl}#about`,
      url: canonicalUrl,
      name: 'About NearHub',
      isPartOf: { '@id': `${siteUrl}#website` },
      about: { '@id': `${siteUrl}#organization` },
    });
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}

function renderRouteHtml(templateHtml, route, context) {
  const canonicalPath = normalizeRoutePath(route.path);
  const canonicalUrl = `${context.siteUrl}${canonicalPath}`;
  let html = templateHtml;

  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(route.title)}</title>`);
  html = upsertMetaTag(html, 'name', 'description', route.description);
  html = upsertMetaTag(html, 'name', 'keywords', context.keywords);
  html = upsertMetaTag(html, 'name', 'robots', 'index,follow');
  html = upsertMetaTag(html, 'property', 'og:title', route.title);
  html = upsertMetaTag(html, 'property', 'og:description', route.description);
  html = upsertMetaTag(html, 'property', 'og:type', 'website');
  html = upsertMetaTag(html, 'property', 'og:url', canonicalUrl);
  html = upsertMetaTag(html, 'property', 'og:image', context.defaultImageUrl);
  html = upsertMetaTag(html, 'property', 'og:site_name', 'NearHub');
  html = upsertMetaTag(html, 'name', 'twitter:card', 'summary_large_image');
  html = upsertMetaTag(html, 'name', 'twitter:title', route.title);
  html = upsertMetaTag(html, 'name', 'twitter:description', route.description);
  html = upsertMetaTag(html, 'name', 'twitter:image', context.defaultImageUrl);
  html = upsertCanonical(html, canonicalUrl);

  const jsonLd = buildJsonLd(
    route.path,
    canonicalUrl,
    { title: route.title, description: route.description },
    context.siteUrl,
    context.defaultImageUrl
  );
  html = upsertJsonLd(html, jsonLd);

  return html;
}

async function writePrerenderedRoutes(templateHtml, config, context) {
  for (const route of config.routes) {
    const renderedHtml = renderRouteHtml(templateHtml, route, context);
    const outputPath =
      route.path === '/'
        ? path.join(distDir, 'index.html')
        : path.join(distDir, route.path.replace(/^\/+/, ''), 'index.html');

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, renderedHtml, 'utf8');
  }
}

function buildSitemapXml(config, siteUrl) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = config.routes
    .map((route) => {
      const loc = `${siteUrl}${normalizeRoutePath(route.path)}`;
      const changefreq = route.changefreq || 'monthly';
      const priority = route.priority || '0.5';

      return [
        '  <url>',
        `    <loc>${escapeXml(loc)}</loc>`,
        `    <lastmod>${today}</lastmod>`,
        `    <changefreq>${escapeXml(changefreq)}</changefreq>`,
        `    <priority>${escapeXml(priority)}</priority>`,
        '  </url>',
      ].join('\n');
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function buildRobotsTxt(config, siteUrl) {
  const lines = ['User-agent: *', 'Allow: /'];

  for (const disallowPath of config.disallowPaths || []) {
    lines.push(`Disallow: ${disallowPath}`);
  }

  lines.push('', `Sitemap: ${siteUrl}/sitemap.xml`, '');
  return `${lines.join('\n')}`;
}

async function main() {
  const rawConfig = await fs.readFile(seoConfigPath, 'utf8');
  const config = JSON.parse(rawConfig);

  const siteUrl = normalizeSiteUrl(process.env.VITE_SITE_URL || config.siteUrlFallback);
  const defaultImagePath = config.defaultImagePath.startsWith('/')
    ? config.defaultImagePath
    : `/${config.defaultImagePath}`;
  const context = {
    siteUrl,
    defaultImageUrl: `${siteUrl}${defaultImagePath}`,
    keywords: config.keywords || '',
  };

  const templateHtml = await fs.readFile(path.join(distDir, 'index.html'), 'utf8');
  await writePrerenderedRoutes(templateHtml, config, context);

  await fs.writeFile(path.join(distDir, 'sitemap.xml'), buildSitemapXml(config, siteUrl), 'utf8');
  await fs.writeFile(path.join(distDir, 'robots.txt'), buildRobotsTxt(config, siteUrl), 'utf8');

  console.log(
    `Generated SEO assets for ${config.routes.length} route(s): prerendered HTML, sitemap.xml, robots.txt`
  );
}

main().catch((error) => {
  console.error('Failed generating SEO assets:', error);
  process.exit(1);
});
