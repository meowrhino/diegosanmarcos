#!/usr/bin/env node
// Genera una pagina estatica p/<slug>/index.html por proyecto a partir de
// proyecto.html (plantilla) y data/data.json. Cada pagina lleva sus propios
// meta de SEO/og (los crawlers no ejecutan JS) y un <base href="../../"> para
// que todas las rutas relativas sigan resolviendo desde la raiz del sitio.
//
// Ejecutar tras anadir/quitar proyectos en data.json:
//   node scripts/generate-project-pages.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const dataPath = path.join(rootDir, 'data', 'data.json');
const templatePath = path.join(rootDir, 'proyecto.html');
const outputDir = path.join(rootDir, 'p');

const baseUrlInput = (process.env.BASE_URL || 'https://diegosanmarcos.com').trim();
const baseUrl = baseUrlInput.replace(/\/+$/, '');

for (const file of [dataPath, templatePath]) {
  if (!fs.existsSync(file)) {
    console.error(`Missing file: ${file}`);
    process.exit(1);
  }
}

const template = fs.readFileSync(templatePath, 'utf8');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const projects = (Array.isArray(data.projects) ? data.projects : [])
  .filter((p) => typeof p?.slug === 'string' && p.slug.length > 0 && p.visible !== false);

// ===== Helpers (replican la logica de proyecto.js) =====
const IMAGE_PATTERN = /\.(jpg|jpeg|png|gif|webp|svg)$/i;

function loc(project, field) {
  return project[`${field}_es`] ?? project[field] ?? [];
}

function getProjectTitle(project) {
  return project.titulo_proyecto ?? project.titulo_home ?? project.slug;
}

function stripHtml(text) {
  return String(text || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateText(text, maxLength = 170) {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3).trimEnd() + '...';
}

function getSeoDescription(project) {
  const credit = (loc(project, 'creditos') || []).find(Boolean);
  const text1 = (loc(project, 'texto1') || []).find(Boolean);
  const text2 = (loc(project, 'texto2') || []).find(Boolean);
  const fallback = `Proyecto de ${getProjectTitle(project)} por Diego San Marcos.`;
  return truncateText(stripHtml(credit || text1 || text2 || fallback));
}

function getSeoImageUrl(project) {
  const principal = (project.principal || []).find((f) => IMAGE_PATTERN.test(f));
  if (principal) return `${baseUrl}/data/projects/${project.slug}/${encodeURIComponent(principal)}`;
  const gallery = (project.galeria || []).find((f) => IMAGE_PATTERN.test(f));
  if (gallery) return `${baseUrl}/data/projects/${project.slug}/${encodeURIComponent(gallery)}`;
  return `${baseUrl}/data/icons/LOGO%20URL.png`;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

// Sustituye el atributo content del tag que contiene `marker` (id o name)
function setMetaByMarker(html, marker, value) {
  const pattern = new RegExp(`(<meta[^>]*${marker}[^>]*content=")[^"]*(")`);
  const alt = new RegExp(`(<meta[^>]*content=")[^"]*("[^>]*${marker})`);
  if (pattern.test(html)) return html.replace(pattern, `$1${escapeHtml(value)}$2`);
  return html.replace(alt, `$1${escapeHtml(value)}$2`);
}

function buildPage(project) {
  const title = getProjectTitle(project);
  const pageTitle = `${title} — diego san marcos`;
  const description = getSeoDescription(project);
  const canonical = `${baseUrl}/p/${encodeURIComponent(project.slug)}/`;
  const image = getSeoImageUrl(project);

  let html = template;

  // <base> justo despues del charset: las rutas relativas (CSS, JS, fetch,
  // audio, imagenes) resuelven desde la raiz del sitio, tambien en subpaths.
  html = html.replace(
    '<meta charset="UTF-8">',
    '<meta charset="UTF-8">\n    <base href="../../">'
  );

  html = html.replace(
    /<title id="page-title">[^<]*<\/title>/,
    `<title id="page-title">${escapeHtml(pageTitle)}</title>`
  );
  html = setMetaByMarker(html, 'name="description"', description);
  html = setMetaByMarker(html, 'id="og-title"', pageTitle);
  html = setMetaByMarker(html, 'id="og-description"', description);
  html = setMetaByMarker(html, 'id="og-url"', canonical);
  html = setMetaByMarker(html, 'id="og-image"', image);
  html = setMetaByMarker(html, 'id="twitter-title"', pageTitle);
  html = setMetaByMarker(html, 'id="twitter-description"', description);
  html = setMetaByMarker(html, 'id="twitter-image"', image);
  html = html.replace(
    /(<link rel="canonical" id="canonical-url" href=")[^"]*(")/,
    `$1${escapeHtml(canonical)}$2`
  );

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: title,
    url: canonical,
    inLanguage: 'es',
    description,
    image,
    genre: project.tipo,
    author: { '@type': 'Person', name: 'Diego San Marcos' }
  };
  html = html.replace(
    /(<script type="application\/ld\+json" id="project-json-ld">)[^<]*(<\/script>)/,
    `$1${JSON.stringify(jsonLd)}$2`
  );

  // Slug inyectado: proyecto.js lo lee en vez del query param
  html = html.replace(
    '<script src="./shared.js"></script>',
    `<script>window.DSM_PROJECT_SLUG = ${JSON.stringify(project.slug)};</script>\n    <script src="./shared.js"></script>`
  );

  return html;
}

// ===== Generar =====
// Limpiar paginas de slugs que ya no existen
if (fs.existsSync(outputDir)) {
  const current = new Set(projects.map((p) => p.slug));
  for (const entry of fs.readdirSync(outputDir)) {
    if (!current.has(entry)) {
      fs.rmSync(path.join(outputDir, entry), { recursive: true, force: true });
      console.log(`Removed stale page: p/${entry}/`);
    }
  }
}

for (const project of projects) {
  const dir = path.join(outputDir, project.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), buildPage(project), 'utf8');
}

console.log(`Generated ${projects.length} project pages in p/`);
console.log(`Base URL: ${baseUrl}`);
