const axios = require('axios');
const BaseExtractor = require('./BaseExtractor');

class MegaPlayExtractor extends BaseExtractor {
  constructor() {
    super('megaplay', 'MegaPlay');
  }

  async validateStream(m3u8Url) {
    try {
      // HEAD request on m3u8
      const headRes = await axios.head(m3u8Url, { timeout: 4000 });
      if (headRes.status !== 200) return false;

      // fetch variant playlist
      const m3u8Res = await axios.get(m3u8Url, { timeout: 4000 });
      if (m3u8Res.status !== 200 || !m3u8Res.data.includes('#EXTM3U')) return false;

      // fetch 1 segment
      const lines = m3u8Res.data.split('\n');
      let segmentUrl = null;
      let variantUrl = null;

      for (const line of lines) {
        if (line && !line.startsWith('#')) {
           variantUrl = line.trim();
           // resolve absolute if necessary
           if (!variantUrl.startsWith('http')) {
              const base = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);
              variantUrl = base + variantUrl;
           }
           break;
        }
      }

      if (!variantUrl) return false;

      // Try fetching segment directly OR variant playlist if the first url was a variant
      let segCheckUrl = variantUrl;
      if (variantUrl.endsWith('.m3u8')) {
          const varRes = await axios.get(variantUrl, { timeout: 4000 });
          const varLines = varRes.data.split('\n');
          for (const line of varLines) {
              if (line && !line.startsWith('#') && line.includes('.ts')) {
                  segCheckUrl = line.trim();
                  if (!segCheckUrl.startsWith('http')) {
                     const base = variantUrl.substring(0, variantUrl.lastIndexOf('/') + 1);
                     segCheckUrl = base + segCheckUrl;
                  }
                  break;
              }
          }
      }

      const segRes = await axios.get(segCheckUrl, { responseType: 'arraybuffer', timeout: 4000 });
      return segRes.status === 200;
    } catch (e) {
      return false;
    }
  }

  async extract({ animeId, epNum, category }) {
    if (!animeId || !epNum) return null;
    
    // animeId here should be JIKAN ID (MAL ID)
    const malId = animeId;
    const epMatch = String(epNum).match(/\d+/);
    if (!epMatch) return null;
    const currentEpNum = parseInt(epMatch[0], 10);
    const actualCategory = category || 'sub';

    try {
      const anikotoRes = await axios.get(`https://anikotoapi.site/series/${malId}`, {
         headers: { 'User-Agent': 'Mozilla/5.0' },
         timeout: 4000
      });

      if (!anikotoRes.data || !anikotoRes.data.episodes) return null;

      // Find episode_embed_id(s) for the requested epNum
      const eps = anikotoRes.data.episodes.filter(ep => Number(ep.episode_number) === currentEpNum);
      if (!eps.length) return null;

      let attempts = 0;

      for (const ep of eps) {
         if (!ep.episode_embed_id) continue;
         if (attempts >= 2) break;
         attempts++;
         
         const url = `https://megaplay.buzz/stream/s-2/${ep.episode_embed_id}/${actualCategory}`;
         console.log(`[MegaPlay] Extractor trying episode_embed_id: ${ep.episode_embed_id}`);
         
         try {
            const { data: html, status } = await axios.get(url, {
               headers: { Referer: 'https://hianime.dk/', 'User-Agent': 'Mozilla/5.0' },
               timeout: 4000
            });
            console.log(`[MegaPlay] Upstream status for ${ep.episode_embed_id}: 200`);

            const idMatch = html.match(/data-id="(\d+)"/);
            if (!idMatch) continue;

            const sourcesUrl = `https://megaplay.buzz/stream/getSources?id=${idMatch[1]}`;
            const { data } = await axios.get(sourcesUrl, {
               headers: { Referer: url, 'User-Agent': 'Mozilla/5.0', 'X-Requested-With': 'XMLHttpRequest' },
               timeout: 4000
            });

            if (data && data.sources) {
                let rawSources = data.sources;
                if (!Array.isArray(rawSources)) {
                    if (rawSources.file) rawSources = [{ file: rawSources.file, type: 'hls' }];
                    else rawSources = [rawSources];
                }
                if (rawSources.length === 0) continue;

                const m3u8Url = rawSources[0].file || rawSources[0].url;
                if (!m3u8Url) continue;

                const isValid = await this.validateStream(m3u8Url);
                if (isValid) {
                    return {
                        sources: this.normaliseSources(rawSources),
                        tracks: this.normaliseTracks(data.tracks || []),
                        intro: data.intro || null,
                        outro: data.outro || null,
                        provider: 'Megaplay (Anikoto API)'
                    };
                } else {
                    console.log(`[MegaPlay] Validation failed for episode_embed_id: ${ep.episode_embed_id}`);
                }
            }
         } catch (err) {
             console.log(`[MegaPlay] Upstream error for ${ep.episode_embed_id}: ${err.message}`);
             if (err.response) {
                 const st = err.response.status;
                 console.log(`[MegaPlay] Upstream status for ${ep.episode_embed_id}: ${st}`);
                 if (st === 404 || st === 410) {
                     console.log(`[MegaPlay] DEAD_STREAM. Skipping immediately.`);
                     continue;
                 }
                 if (st === 502 || st === 503) {
                     console.log(`[MegaPlay] PROVIDER_DOWN. Skipping provider entirely.`);
                     return null;
                 }
             }
         }
      }
    } catch (err) {
       console.log(`[MegaPlay] Anikoto API error: ${err.message}`);
       if (err.response && (err.response.status === 502 || err.response.status === 503)) {
           console.log(`[MegaPlay] Anikoto API PROVIDER_DOWN. Skipping.`);
           return null;
       }
    }

    return null;
  }
}

module.exports = new MegaPlayExtractor();
