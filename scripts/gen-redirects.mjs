// Generates dist/_redirects so our own domain (app.uselinq.xyz) proxies the
// win-share card endpoints to the backend. This keeps the shared X link on our
// domain and hides the backend host entirely — X crawls app.uselinq.xyz/predict/
// share, Netlify transparently proxies it to the backend, and the card resolves.
//
// The proxy target follows VITE_API_URL (the same backend the app already calls),
// so there is no hardcoded backend URL to drift. If it's unset, only the SPA
// fallback is written (the app still works; the win-share proxy is just absent).
//
// Runs after `vite build`, writing into the publish dir (dist/), which overrides
// the SPA-only public/_redirects copied there by Vite.
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';

const OUT = 'dist/_redirects';
const base = (process.env.VITE_API_URL || '').replace(/\/+$/, '');

const lines = [];
if (base) {
  // Most specific first. Query strings (?p=…&h=…) are forwarded automatically.
  lines.push(`/predict/share/img  ${base}/predict/share/img  200`);
  lines.push(`/predict/share      ${base}/predict/share      200`);
} else {
  console.warn('[gen-redirects] VITE_API_URL not set — win-share proxy NOT written (SPA only).');
}
lines.push('/*  /index.html  200'); // SPA fallback (must stay last)

if (!existsSync('dist')) mkdirSync('dist', { recursive: true });
writeFileSync(OUT, lines.join('\n') + '\n');
console.log(`[gen-redirects] wrote ${OUT}:\n${lines.join('\n')}`);
