const axios = require('axios');
const cheerio = require('cheerio');
const BaseExtractor = require('./BaseExtractor');

class HTMLExtractor extends BaseExtractor {
  constructor() {
    super('html', 'HTML Basic');
  }

  async extract({ embedUrl }) {
    if (!embedUrl) return null;

    const embedOrigin = new URL(embedUrl).origin;
    console.log(`  [HTML Extractor] Fetching: ${embedUrl}`);
    
    let html;
    try {
      const res = await axios.get(embedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Referer': `${embedOrigin}/`,
          'Origin': embedOrigin,
        },
        timeout: 15000,
      });
      html = res.data;
    } catch (err) {
      console.warn(`  [HTML Extractor] Failed to fetch: ${err.message}`);
      return null;
    }

    const $ = cheerio.load(html);
    let sources = [];

    $('script').each((_, el) => {
      const t = $(el).html() || '';
      if (!sources.length) {
        const jw = t.match(/sources\s*:\s*(\[\s*\{[\s\S]*?\}\s*\])/);
        if (jw) { try { sources = this.normaliseSources(JSON.parse(jw[1].replace(/'/g, '"'))); } catch (_) {} }
      }
      if (!sources.length) {
        const fm = t.match(/file\s*:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/);
        if (fm) sources = [{ url: fm[1], isM3U8: true, quality: 'auto' }];
      }
      if (!sources.length) {
        const hm = t.match(/https?:\/\/[^\s'"<>]+\.m3u8[^\s'"<>]*/);
        if (hm) sources = [{ url: hm[0], isM3U8: true, quality: 'auto' }];
      }
      // Filemoon-style: jwplayer setup call
      if (!sources.length && t.includes('jwplayer')) {
        const fw = t.match(/\.setup\(\s*(\{[\s\S]*?\})\s*\)/);
        if (fw) {
          try {
            const safeJson = fw[1].replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":').replace(/'/g, '"');
            const cfg = JSON.parse(safeJson);
            if (cfg.sources) sources = this.normaliseSources(cfg.sources);
            else if (cfg.file) sources = [{ url: cfg.file, isM3U8: cfg.file.includes('.m3u8'), quality: 'auto' }];
          } catch (_) {}
        }
      }
    });

    if (!sources.length) {
      $('source[src], video[src]').each((_, el) => {
        const s = $(el).attr('src');
        if (s) sources.push({ url: s, isM3U8: s.includes('.m3u8'), quality: 'auto' });
      });
    }

    const tracks = [];
    try {
       const subMatch = embedUrl.match(/[?&](sub|subtitles)=([^&]+)/);
       if (subMatch && subMatch[1]) {
         tracks.push({ 
           file: decodeURIComponent(subMatch[2]), 
           label: 'English', 
           kind: 'captions', 
           default: true 
         });
       }
    } catch(e) {}
    
    return { sources, tracks, intro: null, outro: null, provider: 'html-extract-v2' };
  }
}

module.exports = new HTMLExtractor();
