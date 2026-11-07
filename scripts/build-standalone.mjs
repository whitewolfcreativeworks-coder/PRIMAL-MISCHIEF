// Builds a single self-contained HTML file of the offline (vs-computer) edition:
// all JS, CSS and fonts inlined. Output: apps/client/dist-standalone/primal-mischief.html
// Usage: node scripts/build-standalone.mjs [--fragment]
//   --fragment  omit <!doctype>/<html>/<head>/<body> wrappers (for hosts that add their own)
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const client = 'apps/client';
const out = join(client, 'dist-standalone');
execSync(`npx vite build --outDir dist-standalone/tmp --emptyOutDir`, {
  cwd: client, stdio: 'inherit',
  env: { ...process.env, VITE_OFFLINE: '1', PM_INLINE_ASSETS: '1' },
});
const tmp = join(out, 'tmp');
const assets = join(tmp, 'assets');
const files = readdirSync(assets);
const css = files.filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(assets, f), 'utf8')).join('\n');
const js = files.filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(assets, f), 'utf8')).join('\n');
const fragment = process.argv.includes('--fragment');
const touchIcon = `data:image/jpeg;base64,${readFileSync(join(client, 'public/icon-180.jpg')).toString('base64')}`;
const head = `<title>Primal Mischief</title>
<link rel="apple-touch-icon" href="${touchIcon}">
<link rel="icon" href="${touchIcon}">
<meta name="theme-color" content="#110d09">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Mischief">
<style>${css}</style>`;
const body = `<div id="root"></div>\n<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>`;
const html = fragment ? `${head}\n${body}\n`
  : `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">${head}</head><body>${body}</body></html>\n`;
mkdirSync(out, { recursive: true });
const file = join(out, fragment ? 'primal-mischief-fragment.html' : 'primal-mischief.html');
writeFileSync(file, html);
console.log(`${file}: ${(html.length / 1024).toFixed(0)} KB`);
