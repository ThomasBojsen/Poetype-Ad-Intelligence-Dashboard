#!/usr/bin/env node
// Test om /{ad_id}/previews → iframe → og:image giver HD-thumbnails.
// Run:  META_TOKEN=xxx AD_ID=yyy node scripts/test-preview-fetch.mjs
//
// AD_ID kan tages fra Supabase: SELECT ad_id FROM performance_insights WHERE name LIKE '%Vimpel%' LIMIT 1;

const metaToken = process.env.META_TOKEN;
const adId = process.env.AD_ID;
const adFormat = process.env.AD_FORMAT || 'INSTAGRAM_STANDARD';
const META_API_VERSION = 'v21.0';

if (!metaToken || !adId) {
  console.error('Usage: META_TOKEN=xxx AD_ID=yyy node scripts/test-preview-fetch.mjs');
  process.exit(1);
}

const log = (...args) => console.log(...args);
const trim = (s, n = 140) => (s && s.length > n ? s.slice(0, n) + '…' : s);

async function main() {
  // ---- Step 1: Get iframe URL from previews endpoint ----
  const previewsUrl =
    `https://graph.facebook.com/${META_API_VERSION}/${adId}/previews` +
    `?ad_format=${adFormat}` +
    `&access_token=${encodeURIComponent(metaToken)}`;
  log('───────────────────────────────────────────────');
  log('STEP 1: GET /previews');
  log('  URL:', previewsUrl.replace(metaToken, '***'));
  const resp = await fetch(previewsUrl);
  log('  Status:', resp.status, resp.statusText);
  if (!resp.ok) {
    log('  Body:', trim(await resp.text(), 600));
    log('\nFAIL at step 1.');
    return;
  }
  const json = await resp.json();
  const iframeHtml = json.data?.[0]?.body;
  if (!iframeHtml) {
    log('  Response:', JSON.stringify(json));
    log('\nFAIL: no iframe body in response.');
    return;
  }
  log('  iframe HTML:', trim(iframeHtml, 200));

  const srcMatch = iframeHtml.match(/src="([^"]+)"/);
  if (!srcMatch) {
    log('\nFAIL: no src= in iframe HTML.');
    return;
  }
  const iframeSrc = srcMatch[1].replace(/&amp;/g, '&');
  log('  iframe src:', trim(iframeSrc, 140));

  // ---- Step 2: Fetch iframe HTML ----
  log('\n───────────────────────────────────────────────');
  log('STEP 2: GET iframe HTML');
  const iframeResp = await fetch(iframeSrc, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
        'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });
  log('  Status:', iframeResp.status, iframeResp.statusText);
  if (!iframeResp.ok) {
    log('  Body:', trim(await iframeResp.text(), 400));
    log('\nFAIL at step 2.');
    return;
  }
  const html = await iframeResp.text();
  log('  HTML length:', html.length);

  // ---- Step 3: Parse for image URLs ----
  log('\n───────────────────────────────────────────────');
  log('STEP 3: Parse HTML for thumbnail candidates');

  const og = html.match(/property=["']og:image["']\s+content=["']([^"']+)["']/i);
  log('  og:image:', og ? trim(og[1].replace(/&amp;/g, '&')) : '(none)');

  const poster = html.match(/<video[^>]+poster=["']([^"']+)["']/i);
  log('  video poster:', poster ? trim(poster[1].replace(/&amp;/g, '&')) : '(none)');

  const imgRegex = /<img[^>]+src=["']([^"']+fbcdn[^"']+)["']/gi;
  const imgs = Array.from(html.matchAll(imgRegex)).map((m) =>
    m[1].replace(/&amp;/g, '&')
  );
  log('  fbcdn <img> tags:', imgs.length);
  imgs.slice(0, 5).forEach((u, i) => log(`    [${i}]`, trim(u)));

  // Show stp= parameter analysis for each candidate
  log('\n───────────────────────────────────────────────');
  log('STEP 4: stp= parameter analysis (size hints)');
  const candidates = [
    og && ['og:image', og[1].replace(/&amp;/g, '&')],
    poster && ['video.poster', poster[1].replace(/&amp;/g, '&')],
    ...imgs.slice(0, 3).map((u, i) => [`img[${i}]`, u]),
  ].filter(Boolean);
  for (const [label, url] of candidates) {
    try {
      const u = new URL(url);
      const path = u.pathname.match(/\/(t\d+\.\d+-\d+)\//)?.[1] || '?';
      const stp = u.searchParams.get('stp') || '(none)';
      log(`  ${label}: ns=${path} stp=${stp}`);
    } catch {
      log(`  ${label}: <invalid URL>`);
    }
  }

  log('\n───────────────────────────────────────────────');
  log('Pick the first non-tiny fbcdn URL as our HD thumbnail:');
  for (const u of imgs) {
    if (/[\/_]p\d{1,2}x\d{1,2}/.test(u)) continue;
    if (u.includes('profile') || u.includes('avatar')) continue;
    log('  ✓', trim(u));
    log('\nSUCCESS — looks usable.');
    return;
  }
  if (og) {
    log('  ✓ og:image:', trim(og[1].replace(/&amp;/g, '&')));
    log('\nSUCCESS — using og:image.');
    return;
  }
  log('  ✗ no usable URL found');
  log('\nFAIL: nothing matched.');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
