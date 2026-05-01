const axios = require('axios');
const cheerio = require('cheerio');
const BaseAdapter = require('./BaseAdapter');

class ZoroCloneAdapter extends BaseAdapter {
  constructor(id, name, baseUrl) {
    super(id, name);
    this.baseUrl = baseUrl;
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
      const searchPaths = ['/search?keyword=', '/browser?keyword=', '/filter?keyword='];
      
      let searchRes = null;
      let $ = null;
      
      for (const path of searchPaths) {
         try {
            const res = await axios.get(`${this.baseUrl}${path}${encodeURIComponent(keyword)}`, {
              headers: this.getHeaders(),
              timeout: 10000
            });
            if (res.status === 200) {
               $ = cheerio.load(res.data);
               // check if items exist
               if ($('.flw-item').length > 0 || $('.film_list-wrap .flw-item').length > 0 || $('a[href*="/watch/"]').length > 0) {
                  searchRes = res;
                  break;
               }
            }
         } catch(e){}
      }
      
      if (!$) return results;
      
      let bestMatch = $('.flw-item, .aitem').first();
      // fallback for some clones
      if (bestMatch.length === 0) {
          bestMatch = $('.film_list-wrap a[href*="/watch/"], .film_list-wrap a[href*="/detail/"], .film_list-wrap a[href*="/title/"]').first().parent(); 
          if (bestMatch.length === 0) {
               bestMatch = $('#main-wrapper a[href*="/watch/"], #main-content a[href*="/watch/"]').first().parent();
          }
      }
      
      const sanitize = (str) => str ? str.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
      const sKey = sanitize(keyword);

      $('.flw-item, .film-detail, .item, .aitem').each((_, el) => {
          const t = $(el).find('.film-name a, .dynamic-name, h3 a, a.title').text().trim();
          if (sanitize(t) === sKey) {
             bestMatch = $(el);
          }
      });
      
      const firstResult = bestMatch;
      if (!firstResult.length) return results;

      const title = firstResult.find('.film-name a, .dynamic-name, a.title').first().text().trim();
      const url = firstResult.find('.film-name a, .film-poster, a.poster, a[href*="/watch/"]').first().attr('href');
      
      let providerAnimeId = firstResult.find('.film-poster').attr('data-id') || firstResult.find('a[data-id]').attr('data-id');
      if (!providerAnimeId && url) {
        try {
           const seriesRes = await axios.get(`${this.baseUrl}${url}`, { headers: this.getHeaders(), timeout: 8000 });
           const $s = cheerio.load(seriesRes.data);
           providerAnimeId = $s('#watch-main').attr('data-id') || $s('input#movie_id').val() || null;
           
           if (!providerAnimeId) {
                const candidate = $s('[data-id]').first().attr('data-id');
                if (candidate && /^\d+$/.test(candidate)) providerAnimeId = candidate;
           }
        } catch (e) {}

        if (!providerAnimeId) {
           providerAnimeId = url.split('/').filter(Boolean)[1];
        }
      }

      if (providerAnimeId) {
        results.push({
          providerId: this.id,
          providerAnimeId,
          type: 'both',
          url: `${this.baseUrl}${url}`,
        });
      }
    } catch (err) {
      console.warn(`[${this.name}] Search failed: ${err.message}`);
    }
    return results;
  }

  async fetchEpisodes(providerAnimeId, type) {
    const episodes = [];
    try {
      const endpoints = [
          `/ajax/episode/list/${providerAnimeId}`,
          `/ajax/v2/episodes/${providerAnimeId}`,
          `/ajax/episodes/list/${providerAnimeId}`
      ];
      let res;
      for (const ep of endpoints) {
         try {
            const temp = await axios.get(`${this.baseUrl}${ep}`, {
               headers: { ...this.getHeaders(), 'X-Requested-With': 'XMLHttpRequest' },
               timeout: 5000
            });
            if (temp.data && (temp.data.html || temp.data.result || temp.data.includes('ep-item'))) {
               res = temp; break;
            }
         } catch(e){}
      }
      
      if (!res) return episodes;

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

      // Special fallback for SSR / mutated clones (like hianime.ws and aniwatch.co.at)
      if (episodes.length === 0) {
          try {
             // Look for episode array in raw HTML
             const scriptMatches = [...htmlContent.matchAll(/['"]?episodes?['"]?\s*:\s*(\[.*?\])/g)];
             if (scriptMatches.length > 0) {
                 const arr = JSON.parse(scriptMatches[0][1]);
                 arr.forEach(ep => {
                     const epId = ep.id || ep.episodeId;
                     const epNum = ep.number || ep.ep_num || ep.epNum || ep.id; // fallback to ID as string if needed
                     if (epId && epNum) {
                         episodes.push({
                             episodeNumber: parseFloat(epNum) || 1,
                             providerEpisodeId: epId.toString(),
                             type: 'both'
                         });
                     }
                 });
             } else {
                 // Try parsing __NEXT_DATA__
                 const nextData = $('#__NEXT_DATA__').html();
                 if (nextData) {
                     const parsed = JSON.parse(nextData);
                     // Just stringify and apply the regex to find episodes arrays
                     const strParsed = JSON.stringify(parsed);
                     const epsMatches = [...strParsed.matchAll(/['"]?episodes?['"]?\s*:\s*(\[{.*?}\])/gi)];
                     if(epsMatches.length > 0) {
                         const arr = JSON.parse(epsMatches[0][1]);
                         arr.forEach(ep => {
                             if(ep.id || ep.episodeId) {
                                episodes.push({
                                    episodeNumber: parseFloat(ep.number || ep.ep_num || ep.epNum || 1),
                                    providerEpisodeId: (ep.id || ep.episodeId).toString(),
                                    type: 'both'
                                });
                             }
                         });
                     }
                 }
             }
         } catch(e) {}
      }
    } catch (err) {
      console.warn(`[${this.name}] Episodes fetch failed: ${err.message}`);
    }
    return episodes;
  }

  async fetchServers(providerEpisodeId) {
    const servers = [];
    try {
      const endpoints = [
          `/ajax/v2/episode/servers?episodeId=${providerEpisodeId}`,
          `/ajax/episode/servers?episodeId=${providerEpisodeId}`
      ];
      let res;
      for (const ep of endpoints) {
         try {
            const temp = await axios.get(`${this.baseUrl}${ep}`, {
               headers: { ...this.getHeaders(), 'X-Requested-With': 'XMLHttpRequest' },
               timeout: 5000
            });
            if (temp.data && (temp.data.html || temp.data.result || temp.data.includes('server-item'))) {
               res = temp; break;
            }
         } catch(e){}
      }
      
      if (!res) return servers;

      const htmlContent = res.data?.html || res.data?.result || res.data || '';
      const $ = cheerio.load(htmlContent);
      
      $('.ps_-block').each((_, blockEl) => {
        const type = $(blockEl).attr('data-type');
        $(blockEl).find('.server-item').each((_, el) => {
          servers.push({
            serverId: $(el).attr('data-id'),
            serverName: $(el).find('a').text().trim().toLowerCase(),
            type
          });
        });
      });
    } catch (err) {
      console.warn(`[${this.name}] Servers fetch failed: ${err.message}`);
    }
    return servers;
  }

  async getSourceUrl(serverId) {
    try {
      const res = await axios.get(`${this.baseUrl}/ajax/v2/episode/sources?id=${serverId}`, {
        headers: { ...this.getHeaders(), 'X-Requested-With': 'XMLHttpRequest' },
        timeout: 10000
      });
      return res.data?.link;
    } catch (err) {
      console.warn(`[${this.name}] Source URL fetch failed: ${err.message}`);
      return null;
    }
  }
}

module.exports = ZoroCloneAdapter;
