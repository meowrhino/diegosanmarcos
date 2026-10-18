/* ============================================================
   build.mjs — data/ + projects/ + index.html y proyecto.html (las
   plantillas) → dist/, la web tal cual se publica.
       node build/build.mjs

   La home y una página por proyecto (/p/<slug>/), cada una con su title,
   description, og:image y canonical, y el contenido en español ya escrito
   (el título, los textos, la galería y los créditos), para que Google y
   WhatsApp lo lean sin JS. Al cargar, el JS de siempre vuelve a pintar lo
   mismo: el reproductor y el cambio de idioma no cambian de página. Sustituye
   a scripts/generate-project-pages.mjs, que se ejecutaba a mano.

   Si algo está mal (una coma, un campo mal escrito, un fichero que no está)
   para y dice qué, y no se publica nada: la web se queda como estaba.
   ============================================================ */

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { entriesOf, toOld } from '../js/house.js';
import { leerJSON, validar } from '../js/validar.js';
import '../seo-shared.js';   // deja DSM_SEO en globalThis (lo mismo que usa el navegador)

const DSM_SEO = globalThis.DSM_SEO;
const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const OUT = join(ROOT, 'dist');
const at = (...p) => join(ROOT, ...p);
const fail = (msg) => { console.error(`\n✗ ${msg}\n\nNo se ha publicado nada: la web sigue como estaba.\n`); process.exit(1); };

/* ---------- leer y revisar ---------- */

const read = (rel) => {
  if (!existsSync(at(rel))) fail(`no encuentro ${rel}`);
  try { return leerJSON(readFileSync(at(rel), 'utf8'), rel); } catch (e) { fail(e.message); }
};
// cada JSON con su esquema (schema/): lo mismo que VS Code subraya en rojo
const schema = (t) => JSON.parse(readFileSync(at('schema', `${t}.json`), 'utf8'));
const site = read('data/site.json');
const errors = validar(site, schema('site'), 'data/site.json');
const entries = errors.length ? [] : entriesOf(site);
const projects = {};
for (const { slug } of entries) {
  const rel = `projects/${slug}/project.json`;
  if (projects[slug]) { errors.push(`data/site.json: "${slug}" está dos veces en "lists"`); continue; }
  if (!existsSync(at(rel))) { errors.push(`data/site.json: "lists" dice "${slug}", y no hay ningún ${rel}`); continue; }
  const p = projects[slug] = read(rel);
  const before = errors.length;
  errors.push(...validar(p, schema('project'), rel));
  if (errors.length > before) continue;
  if (!site.typeColors[p.type]) errors.push(`${rel}: el tipo "${p.type}" no tiene color en data/site.json → typeColors`);
  // los ficheros que nombra tienen que estar en su carpeta (los de YouTube, no)
  for (const [field, files] of [['main', p.main], ['audio', p.audio], ['photos', p.photos], ['textFiles', p.textFiles]]) {
    for (const f of files || []) {
      if (!/^https?:\/\//.test(f) && !existsSync(at('projects', slug, f))) errors.push(`${rel}: "${field}" dice "${f}", y no está en projects/${slug}/`);
    }
  }
}
if (errors.length) fail(errors.join('\n✗ '));
const data = toOld(site, projects);

/* Dónde se publica (los dos en GitHub Pages: hay audios de más de 25 MB, que
   Cloudflare no publica). En nuestra copia (meowrhino), en
   meowrhino.github.io/<repo>/ y sin indexar; en la de Diego, o en local, en
   la raíz con el dominio de site.json → "url", y se indexa si lo hay. */
const ours = process.env.GITHUB_REPOSITORY_OWNER === 'meowrhino';
const repo = (process.env.GITHUB_REPOSITORY || '/').split('/')[1];
const BASE = ours ? `/${repo}` : '';
const SITE = ours ? `https://meowrhino.github.io${BASE}` : String(site.url || '').replace(/\/+$/, '');
const INDEX = !ours && !!site.url;

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const enc = (p) => p.split('/').map(encodeURIComponent).join('/');

/* ---------- la imagen al compartir, con sharp ---------- */

/* 1200×630 en JPG, la imagen del proyecto entera sobre negro, con aire. En
   .cache/og/ (fuera de git); solo se rehace si cambia la foto. Sin sharp (o
   si la imagen es un svg) se comparte la imagen tal cual. */
let sharp = null;
try { sharp = (await import('sharp')).default; } catch (e) {
  console.warn(`⚠ sin sharp (${e.code || e.message}): al compartir sale la imagen tal cual. Se arregla con: npm ci`);
}
const ogs = new Map();   // ruta de la imagen → og/<slug>.jpg
for (const p of data.projects) {
  const src = DSM_SEO.getProjectSeoImagePath(p);
  if (!sharp || !src || !/\.(webp|png|jpe?g)$/i.test(src) || !existsSync(at(src))) continue;
  const cached = at('.cache', 'og', `${p.slug}.jpg`);
  try {
    if (!(existsSync(cached) && statSync(cached).mtimeMs >= statSync(at(src)).mtimeMs)) {
      mkdirSync(dirname(cached), { recursive: true });
      await sharp(at(src)).resize(1104, 534, { fit: 'contain', background: '#000000' })
        .extend({ top: 48, bottom: 48, left: 48, right: 48, background: '#000000' })
        .flatten({ background: '#000000' }).jpeg({ quality: 85, mozjpeg: true }).toFile(cached);
    }
    ogs.set(p.slug, cached);
  } catch (e) {
    console.warn(`⚠ ${src}: sharp no la puede leer (${e.message}); al compartir sale tal cual`);
  }
}
const ogUrl = (p) => (ogs.has(p.slug) ? `${SITE}/og/${p.slug}.jpg` : `${SITE}/${enc(DSM_SEO.getProjectSeoImagePath(p))}`);

/* ---------- las plantillas ---------- */

function swap(html, find, replace, file) {
  if (!find.test(html)) fail(`no encuentro ${find} en ${file}: el build lo necesita para escribir las páginas.`);
  return html.replace(find, replace);
}
// el content de la etiqueta que lleva `marker` (un id o un name/property)
const meta = (html, marker, value, file) =>
  swap(html, new RegExp(`(<meta[^>]*${marker}[^>]*content=")[^"]*(")|(<meta[^>]*content=")[^"]*("[^>]*${marker})`),
    (_, a, b, c, d) => (a ? `${a}${esc(value)}${b}` : `${c}${esc(value)}${d}`), file);

function head(html, file, { title, desc, url, image, robots }) {
  html = swap(html, /<html lang="[^"]*"/, '<html lang="es" data-built', file);
  html = html.replace(/<title([^>]*)>[^<]*<\/title>/, `<title$1>${esc(title)}</title>`);
  html = meta(html, 'name="description"', desc, file);
  html = meta(html, 'name="robots"', robots || (INDEX ? 'index,follow,max-image-preview:large' : 'noindex'), file);
  for (const m of ['property="og:title"', 'name="twitter:title"']) if (new RegExp(m).test(html)) html = meta(html, m, title, file);
  for (const m of ['property="og:description"', 'name="twitter:description"']) if (new RegExp(m).test(html)) html = meta(html, m, desc, file);
  html = meta(html, 'property="og:url"', url, file);
  html = meta(html, 'property="og:image"', image, file);
  html = meta(html, 'name="twitter:image"', image, file);
  html = swap(html, /(<link rel="canonical"[^>]*href=")[^"]*(")/, `$1${esc(url)}$2`, file);
  return html;
}

const lang = (o, k) => o[`${k}_es`] || [];

function homePage() {
  const file = 'index.html';
  let html = head(readFileSync(at(file), 'utf8'), file, {
    title: site.title,
    desc: (readFileSync(at(file), 'utf8').match(/<meta name="description" content="([^"]*)"/) || [])[1] || site.title,
    url: `${SITE}/`,
    image: `${SITE}/data/icons/LOGO%20URL.png`,
  });
  // la lista de proyectos, para quien no ejecuta JS (home.js la cambia por los cuadrados)
  const links = data.projects.filter((p) => p.visible).map((p) =>
    `<a href="p/${enc(p.slug)}/">${esc(p.titulo_home)}</a>`).join('\n        ');
  return swap(html, /<main id="projects-container"([^>]*)><\/main>/, `<main id="projects-container"$1>\n        ${links}\n    </main>`, file);
}

function projectPage(p) {
  const file = 'proyecto.html';
  const title = DSM_SEO.getFullProjectTitle(p);
  let html = readFileSync(at(file), 'utf8');
  // <base>: las rutas relativas (css, js, fetch, audio) salen desde la raíz, también en subcarpeta
  html = swap(html, /<meta charset="UTF-8">/, '<meta charset="UTF-8">\n    <base href="../../">', file);
  html = head(html, file, {
    title: `${title} — ${site.title}`,
    desc: DSM_SEO.getProjectSeoDescription(p, 'es'),
    url: `${SITE}/p/${enc(p.slug)}/`,
    image: ogUrl(p),
    robots: p.visible ? null : 'noindex',
  });
  html = html.replace(/(<script type="application\/ld\+json" id="project-json-ld">)[^<]*(<\/script>)/,
    `$1${JSON.stringify({ '@context': 'https://schema.org', '@type': 'CreativeWork', name: title, url: `${SITE}/p/${enc(p.slug)}/`,
      inLanguage: 'es', description: DSM_SEO.getProjectSeoDescription(p, 'es'), image: ogUrl(p), genre: p.tipo,
      author: { '@type': 'Person', name: 'Diego San Marcos' } }).replace(/</g, '\\u003c')}$2`);
  // el contenido, como lo pinta js/project.js (que lo borra y lo vuelve a pintar)
  const ps = (arr, raw) => arr.map((t) => `<p>${raw ? t : esc(t)}</p>`).join('');
  html = swap(html, /(<main class="project-main[^"]*">)/,
    `$1\n        <div class="project-title-section project-section dsm-dynamic-section"><h1>${esc(title)}</h1></div>`, file);
  html = swap(html, /<div id="texto1-content" class="text-content"><\/div>/, `<div id="texto1-content" class="text-content">${ps(lang(p, 'texto1'), true)}</div>`, file);
  html = swap(html, /<div id="texto2-content" class="text-content"><\/div>/, `<div id="texto2-content" class="text-content">${ps(lang(p, 'texto2'), true)}</div>`, file);
  html = swap(html, /<div id="galeria-content" class="gallery-grid"><\/div>/, `<div id="galeria-content" class="gallery-grid">${p.galeria.map((f) =>
    `<div class="gallery-item"><img src="projects/${enc(p.slug)}/${enc(f)}" alt="${esc(f)}" loading="lazy"></div>`).join('')}</div>`, file);
  html = swap(html, /<div id="creditos-content" class="credits-content"><\/div>/, `<div id="creditos-content" class="credits-content">${ps(lang(p, 'creditos'))}</div>`, file);
  return html;
}

/* ---------- escribir dist/ ---------- */

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const STATIC = ['proyecto.html', '404.html', 'frame-viewer.html', 'styles.css', 'proyecto.css', 'app.js', 'shared.js',
  'player.js', 'player-ambience.js', 'player-butterchurn.js', 'seo-shared.js', 'js', 'vendor', 'data', 'projects'];
for (const f of STATIC) cpSync(at(f), join(OUT, f), { recursive: true, filter: (x) => !x.endsWith('.DS_Store') });
writeFileSync(join(OUT, 'index.html'), homePage());
mkdirSync(join(OUT, 'og'), { recursive: true });
for (const [slug, cached] of ogs) cpSync(cached, join(OUT, 'og', `${slug}.jpg`));
for (const p of data.projects) {
  mkdirSync(join(OUT, 'p', p.slug), { recursive: true });
  writeFileSync(join(OUT, 'p', p.slug, 'index.html'), projectPage(p));
}
const urls = [`${SITE}/`, ...data.projects.filter((p) => p.visible).map((p) => `${SITE}/p/${enc(p.slug)}/`)];
writeFileSync(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n')}
</urlset>
`);
writeFileSync(join(OUT, 'robots.txt'), INDEX ? `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n` : 'User-agent: *\nDisallow: /\n');
writeFileSync(join(OUT, '.nojekyll'), '');

const hidden = data.projects.filter((p) => !p.visible).length;
console.log(`✓ dist/: home y ${data.projects.length} proyectos${hidden ? ` (${hidden} ocultos)` : ''}${INDEX ? ` · se indexa (${SITE})` : ' · sin indexar'}`);
