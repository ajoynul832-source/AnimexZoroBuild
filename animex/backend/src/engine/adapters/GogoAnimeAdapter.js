const axios = require('axios');
const cheerio = require('cheerio');
const BaseAdapter = require('./BaseAdapter');

class GogoAnimeAdapter extends BaseAdapter {
  constructor() {
    super('gogoanime', 'GogoAnime');
    this.baseUrl = 'https://anitaku.to';
  }

  async searchAndVerify(metadata) {
    const results = [];
    const keywords = [metadata.title_english, metadata.title_romaji, metadata.title].filter(Boolean);
    
    for (const kw of keywords) {
      try {
        const url = `${this.baseUrl}/search.html?keyword=${encodeURIComponent(kw)}`;
        const { data } = await axios.get(url, { timeout: 8000 });
        const $ = cheerio.load(data);
        
        // Grab all matches for sub/dub variants
        const matches = $('ul.items li p.name a');
        if (matches.length) {
          matches.each((_, el) => {
            let seriesPath = $(el).attr('href');
            let baseSlug = seriesPath.replace('/category/', '');
            if (baseSlug.startsWith('/')) baseSlug = baseSlug.slice(1);
            
            let name = $(el).text() || '';
            let type = (name.toLowerCase().includes('dub') || baseSlug.endsWith('-dub')) ? 'dub' : 'sub';
            
            // Note: Modern GogoAnime does NOT bundle sub and dub. They are separate URLs.
            if (!results.find(r => r.type === type)) {
              results.push({
                providerId: this.id,
                providerAnimeId: baseSlug,
                type: type,
                url: `${this.baseUrl}${seriesPath}`
              });
            }
          });
          break; // Avoid returning duplicates from other keywords once we have hits
        }
      } catch (err) {
        continue;
      }
    }

    // Try detecting '-dub' suffix if we only have 'sub'
    const subResult = results.find(r => r.type === 'sub');
    if (subResult && !results.find(r => r.type === 'dub')) {
        try {
            const dubSlug = `${subResult.providerAnimeId}-dub`;
            const { data } = await axios.get(`${this.baseUrl}/category/${dubSlug}`, { timeout: 3000 });
            if (data && data.includes('anime_info_body_bg')) {
                results.push({
                    providerId: this.id,
                    providerAnimeId: dubSlug,
                    type: 'dub',
                    url: `${this.baseUrl}/category/${dubSlug}`
                });
            }
        } catch (e) {
            // dub slug does not exist or failed
        }
    }

    return results;
  }

  async fetchEpisodes(providerAnimeId, type) {
    // Note: Gogoanime computes episodes via AJAX (https://ajax.gogo-load.com/ajax/load-list-episode?ep_start=0&ep_end=999&id=...)
    // Since we don't always have the numeric anime ID immediately, 
    // a common fallback for fetching stream links is guessing the slug, 
    // e.g. baseSlug-episode-N
    // We will return a placeholder where the episode list can just be generated or actually scraped if we fetch the anime page first.
    
    // For now, let's fetch anime details page to get numeric id
    const episodes = [];
    try {
      const animeStr = (type === 'dub' && !providerAnimeId.endsWith('-dub')) ? `${providerAnimeId}-dub` : providerAnimeId;
      const { data } = await axios.get(`${this.baseUrl}/category/${animeStr}`, { timeout: 8000 });
      const $ = cheerio.load(data);
      
      let animeId = $('input#movie_id').val() || $('#movie_id').attr('value');
      let lastEp = $('#episode_page li a').last().attr('ep_end');
      
      // Look for episodes embedded directly in the page first (no AJAX needed)
      const $epsDirect = $('#episode_related a');
      if ($epsDirect.length > 0) {
         $epsDirect.each((_, el) => {
             const epHref = $(el).attr('href');
             const epSlug = epHref ? epHref.trim() : '';
             const epNumText = $(el).find('.name').text().replace('EP', '').trim();
             
             if (epSlug) {
                 episodes.push({
                     episodeNumber: parseFloat(epNumText) || 0,
                     providerEpisodeId: epSlug.startsWith('/') ? epSlug.slice(1) : epSlug,
                     type
                 });
             }
         });
         
         episodes.sort((a, b) => a.episodeNumber - b.episodeNumber);
         return episodes;
      }
      
      if (!animeId) {
          // Additional fallback format guess if no AJAX endpoint or direct embed
          console.warn(`[GogoAnimeAdapter] No movie_id or direct embed found for ${animeStr}`);
          return episodes;
      }

      const epsRes = await axios.get(`https://ajax.gogo-load.com/ajax/load-list-episode?ep_start=0&ep_end=${lastEp}&id=${animeId}`, { timeout: 8000 });
      const $eps = cheerio.load(epsRes.data);

      $eps('li a').each((_, el) => {
        const epSlug = $(el).attr('href').trim(); // /slug-episode-1
        const epNumText = $(el).find('.name').text().replace('EP', '').trim();
        
        episodes.push({
          episodeNumber: parseFloat(epNumText),
          providerEpisodeId: epSlug.startsWith('/') ? epSlug.slice(1) : epSlug,
          type
        });
      });
    } catch (err) {
       console.warn(`[GogoAnimeAdapter] Episodes fetch failed: ${err.message}`);
    }

    return episodes.reverse(); // Gogoanime returns top-to-bottom descending usually
  }

  async fetchServers(providerEpisodeId) {
    const servers = [];
    try {
      const { data } = await axios.get(`${this.baseUrl}/${providerEpisodeId}`, { timeout: 10000 });
      const $ = cheerio.load(data);
      
      $('.anime_muti_link .server-items li.server').each((_, el) => {
        const serverName = $(el).find('a').text().replace('Choose this server', '').trim().toLowerCase();
        let serverUrl = $(el).find('a').attr('data-video');
        
        let typeVal = $(el).closest('.server-items').attr('data-type') || 'SUB';
        typeVal = typeVal.toLowerCase();
        // convert hsub -> sub
        if(typeVal === 'hsub') typeVal = 'sub';
        
        if (serverUrl) {
            // ensure server URL has scheme
            if(serverUrl.startsWith('//')) serverUrl = 'https:' + serverUrl;
          servers.push({
            serverId: serverUrl,
            serverName,
            type: typeVal
          });
        }
      });
    } catch (err) {
      console.warn(`[GogoAnimeAdapter] Servers fetch failed: ${err.message}`);
    }
    return servers;
  }
}

module.exports = new GogoAnimeAdapter();
