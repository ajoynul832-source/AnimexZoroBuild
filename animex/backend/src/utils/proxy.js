'use strict';

/*
═══════════════════════════════════════════════════════════════════
  ANIMEX VIDEO PROXY
  
  Why this exists:
    Video CDNs (gogocdn, megacloud, etc.) block direct browser
    requests with CORS headers. This proxy fetches everything
    server-side so the browser only talks to YOUR backend.
    No their player = no their ads.

  Routes:
    GET /api/proxy/m3u8?url=<encoded_m3u8_url>
      → Fetches the m3u8 playlist, rewrites all segment URLs
        to go through /api/proxy/seg so the browser never
        contacts the CDN directly.

    GET /api/proxy/seg?url=<encoded_segment_url>&ref=<encoded_referer>
      → Fetches a single .ts / .m4s video segment and pipes
        it straight to the browser. This is what actually
        streams the video data.
═══════════════════════════════════════════════════════════════════
*/

const express = require('express');
const axios   = require('axios');
const router  = express.Router();

// CDN domains we are willing to proxy — add more as needed
const ALLOWED_CDN_HOSTS = [
  'gogocdn.net',
  'gogocdn.stream',
  'vibeplayer.site',
  'gogoanime.by',
  'anitaku.to',
  'anitaku.pe',
  'megacloud.tv',
  'megacloud.club',
  'rapid-cloud.co',
  'vidstreaming.io',
  'filemoon.sx',
  'filemoon.in',
  'streamtape.com',
  'doodstream.com',
  'hianime.dk',
  'hianime.to',
  'hianime.sx',
  'aniwaves.ru',
  'kissanime.com.ru',
  'anikai.to',
  // gogocdn CDN subdomains
  'cdn.gogocdn.net',
  'cdn2.gogocdn.net',
  'cdn3.gogocdn.net',
  'file.takutakucdn.store',
  'takutakucdn.store'
];

function isAllowed(urlStr) {
  try {
    const host = new URL(urlStr).hostname;
    return ALLOWED_CDN_HOSTS.some(h => host === h || host.endsWith('.' + h));
  } catch {
    return false;
  }
}

// Build headers that make CDN think it's a browser request from their own site
function spoofHeaders(targetUrl, referer) {
  const origin = new URL(targetUrl).origin;
  const ref    = referer || origin + '/';
  return {
    'User-Agent':       'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept':           '*/*',
    'Accept-Language':  'en-US,en;q=0.9',
    'Accept-Encoding':  'gzip, deflate, br',
    'Origin':           origin,
    'Referer':          ref,
    'Sec-Fetch-Dest':   'empty',
    'Sec-Fetch-Mode':   'cors',
    'Sec-Fetch-Site':   'cross-site',
    'Connection':       'keep-alive',
  };
}

/*
  GET /api/proxy/m3u8?url=<encoded>&ref=<encoded>
  
  Fetches the .m3u8 playlist and rewrites it so every segment
  line goes through /api/proxy/seg instead of the CDN directly.
*/
router.get('/m3u8', async (req, res) => {
  const { url, ref } = req.query;

  if (!url) return res.status(400).json({ error: 'url param required' });

  let decoded;
  try { decoded = decodeURIComponent(url); } catch { return res.status(400).json({ error: 'invalid url encoding' }); }

  let decodedRef = null;
  try { if (ref) decodedRef = decodeURIComponent(ref); } catch {}

  if (!isAllowed(decoded) && (!decodedRef || !isAllowed(decodedRef))) {
    console.warn(`[Proxy/m3u8] Blocked: ${decoded}`);
    return res.status(403).json({ error: 'CDN host not in allowlist' });
  }

  try {
    const response   = await axios.get(decoded, {
      headers:      spoofHeaders(decoded, decodedRef),
      timeout:      15000,
      responseType: 'text',
    });

    const m3u8Text  = response.data;
    const m3u8Base  = decoded.substring(0, decoded.lastIndexOf('/') + 1);
    const backendBase = `/backend-api/proxy`;

    // Rewrite every URL in the playlist to go through our proxy
    const rewritten = m3u8Text
      .split('\n')
      .map(line => {
        const trimmed = line.trim();

        // Skip comments and empty lines as-is
        if (!trimmed || trimmed.startsWith('#')) {
          // But rewrite URI= attributes inside EXT-X-KEY and EXT-X-MAP tags
          return line.replace(/URI="([^"]+)"/g, (match, uri) => {
            const abs = uri.startsWith('http') ? uri : m3u8Base + uri;
            return `URI="${backendBase}/seg?url=${encodeURIComponent(abs)}&ref=${encodeURIComponent(decoded)}"`;
          });
        }

        // It's a segment or sub-playlist line
        const abs = trimmed.startsWith('http') ? trimmed : m3u8Base + trimmed;

        // Sub-playlist (.m3u8) — proxy through m3u8 route
        if (abs.includes('.m3u8')) {
          return `${backendBase}/m3u8?url=${encodeURIComponent(abs)}&ref=${encodeURIComponent(decoded)}`;
        }

        // Segment (.ts / .m4s / .mp4 fragment) — proxy through seg route
        return `${backendBase}/seg?url=${encodeURIComponent(abs)}&ref=${encodeURIComponent(decoded)}`;
      })
      .join('\n');

    // Send back as m3u8 with correct content type
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(rewritten);

  } catch (err) {
    console.error(`[Proxy/m3u8] Error: ${err.message}`);
    res.status(502).json({ error: 'Failed to fetch m3u8', detail: err.message });
  }
});


/*
  GET /api/proxy/seg?url=<encoded>&ref=<encoded>
  
  Fetches a single video segment (.ts, .m4s) and pipes it
  directly to the browser. This is the hot path — called for
  every chunk of video so it must be fast.
*/
router.get('/seg', async (req, res) => {
  const { url, ref } = req.query;

  if (!url) return res.status(400).send('url param required');

  let decoded;
  try { decoded = decodeURIComponent(url); } catch { return res.status(400).send('invalid url'); }

  let decodedRef = null;
  try { if (ref) decodedRef = decodeURIComponent(ref); } catch {}

  if (!isAllowed(decoded) && (!decodedRef || !isAllowed(decodedRef))) {
    return res.status(403).send('host not allowed');
  }

  try {
    const response   = await axios.get(decoded, {
      headers:      spoofHeaders(decoded, decodedRef),
      timeout:      30000,
      responseType: 'stream',   // stream directly — don't buffer in memory
    });

    // Forward content-type and length from CDN
    const ct = response.headers['content-type'] || 'video/mp2t';
    const cl = response.headers['content-length'];
    res.setHeader('Content-Type', ct);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    if (cl) res.setHeader('Content-Length', cl);

    // Pipe the stream straight through — zero buffering
    response.data.pipe(res);

    response.data.on('error', (err) => {
      console.error(`[Proxy/seg] Stream error: ${err.message}`);
      if (!res.headersSent) res.status(502).send('Stream error');
    });

  } catch (err) {
    console.error(`[Proxy/seg] Error: ${err.message}`);
    if (!res.headersSent) res.status(502).send('Failed to fetch segment');
  }
});

module.exports = router;
