// SL39: the favicons, the social preview and the footer's dark logo, all rendered from content-pack/brand/ and the traced mark.
// Run from the app folder after trace_mark.py: node scripts/brand/build-assets.mjs. The output is committed under public/.
import { chromium } from 'playwright';
import fs from 'node:fs';

const mark = fs.readFileSync('public/brand/health-in-context-mark.svg', 'utf8');
const [w, h] = mark.match(/viewBox="0 0 (\d+) (\d+)"/).slice(1).map(Number);
const side = Math.max(w, h);
fs.writeFileSync('public/favicon.svg', mark.replace(`viewBox="0 0 ${w} ${h}"`, `viewBox="${(w - side) / 2} ${(h - side) / 2} ${side} ${side}"`));
fs.copyFileSync('content-pack/brand/lof-logo.svg', 'public/brand/lof-logo.svg');

const b64 = (p) => fs.readFileSync(p).toString('base64');
const b = await chromium.launch();
async function shot(html, width, height, out, transparent = false) {
  const p = await b.newPage({ viewport: { width, height } });
  await p.setContent(`<!doctype html><style>html,body{margin:0}</style>${html}`);
  await p.evaluate(() => document.fonts.ready);
  const buf = await p.screenshot({ path: out, omitBackground: transparent });
  await p.close();
  return buf;
}
const icon = (s, pad, bg) => `<div style="width:${s}px;height:${s}px;background:${bg};display:flex;align-items:center;justify-content:center"><div style="width:${s - 2 * pad}px">${mark.replace('<svg ', '<svg style="display:block;width:100%" ')}</div></div>`;

// favicon.ico: an ICONDIR holding PNGs at 16, 32 and 48
const sizes = [16, 32, 48];
const pngs = [];
for (const s of sizes) pngs.push(await shot(icon(s, 0, 'transparent'), s, s, undefined, true));
const dir = Buffer.alloc(6 + 16 * sizes.length);
dir.writeUInt16LE(1, 2); dir.writeUInt16LE(sizes.length, 4);
let at = dir.length;
sizes.forEach((s, i) => {
  const e = 6 + 16 * i;
  dir[e] = s; dir[e + 1] = s; dir.writeUInt16LE(1, e + 4); dir.writeUInt16LE(32, e + 6);
  dir.writeUInt32LE(pngs[i].length, e + 8); dir.writeUInt32LE(at, e + 12);
  at += pngs[i].length;
});
fs.writeFileSync('public/favicon.ico', Buffer.concat([dir, ...pngs]));
await shot(icon(180, 22, '#ffffff'), 180, 180, 'public/apple-touch-icon.png');
await shot(icon(512, 56, '#ffffff'), 512, 512, 'public/icon-512.png');

// the official white logo, at three times its 48 px footer height (the 2048 px master is 200 KB)
await shot(`<img src="data:image/png;base64,${b64('content-pack/brand/lof-logo-white.png')}" style="display:block;height:144px">`, Math.round(144 * 2048 / 893), 144, 'public/brand/lof-logo-white.png', true);

// the social preview, 1200 x 630: mark, wordmark, lockup on white
const face = (fam, file, wt) => `@font-face{font-family:'${fam}';font-weight:${wt};src:url(data:font/woff2;base64,${b64(file)}) format('woff2')}`;
const brand = fs.readFileSync('content-pack/manifest.yaml', 'utf8');
const lockup = brand.match(/^\s*lockup:\s*(.+)$/m)[1].replace(/^['"]|['"]$/g, '');
await shot(`<style>${face('Roboto Slab', 'node_modules/@fontsource/roboto-slab/files/roboto-slab-latin-700-normal.woff2', 700)}${face('Roboto', 'node_modules/@fontsource/roboto/files/roboto-latin-400-normal.woff2', 400)}</style>
<div style="width:1200px;height:630px;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34px;border-bottom:10px solid #ff7d2f;box-sizing:border-box">
<div style="width:250px">${mark.replace('<svg ', '<svg style="display:block;width:100%" ')}</div>
<div style="font:700 76px 'Roboto Slab',serif;color:#333333">Health in Context</div>
<div style="font:400 34px Roboto,sans-serif;color:#636363">${lockup}</div></div>`, 1200, 630, 'public/og-image.png');
await b.close();
fs.writeFileSync('public/site.webmanifest', JSON.stringify({ name: 'Health in Context', short_name: 'Health in Context', start_url: '.', display: 'standalone', theme_color: '#ff7d2f', background_color: '#ffffff', icons: [{ src: 'icon-512.png', sizes: '512x512', type: 'image/png' }, { src: 'apple-touch-icon.png', sizes: '180x180', type: 'image/png' }] }, null, 2) + '\n');
