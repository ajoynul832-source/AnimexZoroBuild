const axios = require('axios');
const cheerio = require('cheerio');
const BaseAdapter = require('./BaseAdapter');

class HiAnimeAdapter extends BaseAdapter {
  constructor() {
    super('hianime', 'HiAnime');
    this.baseUrl = 'https://hianime.dk';
  }

  getHeaders() {
    return {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Referer': `${this.baseUrl}/`,
      'Origin': this.baseUrl,
    };
  }

  async searchAndVerify(metadata) {
    const results = [];
    try {
      const keyword = metadata.title_english || metadata.title_romaji || metadata.title;
      const searchRes = await axios.get(`${this.baseUrl}/search?keyword=${encodeURIComponent(keyword)}`, {
        headers: this.getHeaders(),
        timeout: 10000
      });
      const $ = cheerio.load(searchRes.data);
      
      let bestMatch = $('.flw-item').first();
      
      const sanitize = (str) => str ? str.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
      const sKey = sanitize(keyword);

      $('.flw-item').each((_, el) => {
          const t = $(el).find('.film-name a').text().trim();
          if (sanitize(t) === sKey) {
             bestMatch = $(el);
          }
      });
      
      const firstResult = bestMatch;
      if (!firstResult.length) return results;

      const title = firstResult.find('.film-name a').text().trim() || firstResult.find('.dynamic-name').text().trim();
      const url = firstResult.find('.film-name a').attr('href') || firstResult.find('.film-poster').attr('href');
      
      let providerAnimeId = firstResult.find('.film-poster').attr('data-id') || firstResult.find('a[data-id]').attr('data-id');
      if (!providerAnimeId && url) {
        
        // Fetch the page directly to parse the numeric data-id required for episodes
        try {
           const seriesRes = await axios.get(`${this.baseUrl}${url}`, { headers: this.getHeaders(), timeout: 8000 });
           const $s = cheerio.load(seriesRes.data);
           const syncParams = $s('div#syncData').attr('data-sync');
           if (syncParams) {
               // maybe defined as json
           }
           providerAnimeId = $s('#watch-main').attr('data-id') || $s('input#movie_id').val() || null;
           
           if (!providerAnimeId) {
                // look for any data-id
                const candidate = $s('[data-id]').first().attr('data-id');
                if (candidate && /^\d+$/.test(candidate)) providerAnimeId = candidate;
           }
        } catch (e) {}

        // Fallback to slug if still not found
        if (!providerAnimeId) {
           providerAnimeId = url.split('/').filter(Boolean)[1];
        }
      }

      if (providerAnimeId) {
        results.push({
          providerId: this.id,
          providerAnimeId,
          type: 'both', // HiAnime handles sub/dub via episode servers
          url: `${this.baseUrl}${url}`,
        });
      }
    } catch (err) {
      console.warn(`[HiAnimeAdapter] Search failed: ${err.message}`);
    }
    return results;
  }

  async fetchEpisodes(providerAnimeId, type) {
    const episodes = [];
    try {
      // Trying the newer endpoint for episodes
      const res = await axios.get(`${this.baseUrl}/ajax/episode/list/${providerAnimeId}`, {
        headers: { ...this.getHeaders(), 'X-Requested-With': 'XMLHttpRequest' },
        timeout: 10000
      });
      const htmlContent = res.data?.html || res.data?.result || res.data || '';
      const $ = cheerio.load(htmlContent);
      
      $('.ep-item').each((_, el) => {
        const epNum = $(el).attr('data-num') || $(el).attr('data-number');
        const epId = $(el).attr('data-id') || $(el).attr('data-ids');
        if (epNum && epId) {
          episodes.push({
            episodeNumber: parseFloat(epNum),
            providerEpisodeId: epId,
            type: 'both' 
          });
        }
      });
    } catch (err) {
      console.warn(`[HiAnimeAdapter] Episodes fetch failed: ${err.message}`);
    }
    return episodes;
  }

  async fetchServers(providerEpisodeId) {
    const servers = [];
    try {
      const res = await axios.get(`${this.baseUrl}/ajax/episode/servers?episodeId=${providerEpisodeId}`, {
        headers: { ...this.getHeaders(), 'X-Requested-With': 'XMLHttpRequest' },
        timeout: 10000
      });
      const htmlContent = res.data?.html || res.data?.result || res.data || '';
      const $ = cheerio.load(htmlContent);
      
      $('.ps_-block').each((_, blockEl) => {
        const type = $(blockEl).attr('data-type'); // sub, dub, raw
        $(blockEl).find('.server-item').each((_, el) => {
          servers.push({
            serverId: $(el).attr('data-id'),
            serverName: $(el).find('a').text().trim().toLowerCase(),
            type
          });
        });
      });
    } catch (err) {
      console.warn(`[HiAnimeAdapter] Servers fetch failed: ${err.message}`);
    }
    return servers;
  }

  async getSourceUrl(serverId) {
    try {
      const res = await axios.get(`${this.baseUrl}/ajax/episode/sources?id=${serverId}`, {
        headers: { ...this.getHeaders(), 'X-Requested-With': 'XMLHttpRequest' },
        timeout: 10000
      });
      return res.data?.link;
    } catch (err) {
      console.warn(`[HiAnimeAdapter] Source URL fetch failed: ${err.message}`);
      return null;
    }
  }
}

module.exports = new HiAnimeAdapter();
