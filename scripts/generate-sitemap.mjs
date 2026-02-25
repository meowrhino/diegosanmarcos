#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const dataPath = path.join(rootDir, 'data', 'data.json');
const outputPath = path.join(rootDir, 'sitemap.xml');

const baseUrlInput = (process.env.BASE_URL || 'https://example.com').trim();
const baseUrl = baseUrlInput.replace(/\/+$/, '');
const today = new Date().toISOString().slice(0, 10);

if (!fs.existsSync(dataPath)) {
  console.error(`Missing data file: ${dataPath}`);
  process.exit(1);
}

const raw = fs.readFileSync(dataPath, 'utf8');
const parsed = JSON.parse(raw);
const projects = Array.isArray(parsed.projects) ? parsed.projects : [];
const slugs = projects
  .map((project) => project?.slug)
  .filter((slug) => typeof slug === 'string' && slug.length > 0);

const urls = [
  `${baseUrl}/`,
  ...slugs.map((slug) => `${baseUrl}/proyecto.html?proyecto=${encodeURIComponent(slug)}`),
];

const xmlLines = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls.flatMap((loc) => [
    '  <url>',
    `    <loc>${loc}</loc>`,
    `    <lastmod>${today}</lastmod>`,
    '  </url>',
  ]),
  '</urlset>',
];

fs.writeFileSync(outputPath, `${xmlLines.join('\n')}\n`, 'utf8');

console.log(`Generated ${outputPath}`);
console.log(`Base URL: ${baseUrl}`);
console.log(`Entries: ${urls.length}`);
