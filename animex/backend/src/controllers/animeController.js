const fetch = require('node-fetch');
const PageView = require('../models/PageView');
const { cachedFetch, TTL } = require('../cache');

/*
────────────────────────────────────────────
CONFIG
────────────────────────────────────────────
*/

const API = 'https://api.jikan.moe/v4';

/*
────────────────────────────────────────────
HELPERS
────────────────────────────────────────────
*/

async function apiFetch(url) {
  const res = await fetch(url, {
    timeout: 15000
  });

  if (!res.ok) {
    throw Object.assign(
      new Error(
        `Upstream API error ${res.status}`
      ),
      {
        status: res.status
      }
    );
  }

  return res.json();
}

/*
Used for homepage/cards only
NOT for detail page
*/
function normalizeAnime(a) {
  if (!a) return null;

  return {
    id: a.mal_id || a.id,

    name:
      a.title ||
      a.name ||
      'Unknown Anime',

    poster:
      a.images?.jpg?.large_image_url ||
      a.images?.jpg?.image_url ||
      a.poster ||
      '/no-poster.svg',

    type: a.type || '',

    rating:
      a.score ||
      a.rating ||
      null,

    duration:
      a.duration || '',

    description:
      a.synopsis ||
      a.description ||
      '',

    episodes: {
      sub:
        typeof a.episodes === 'number'
          ? a.episodes
          : null,
      dub: null
    }
  };
}

/*
────────────────────────────────────────────
HOME
────────────────────────────────────────────
*/

exports.getHome = async (
  req,
  res
) => {
  try {
    const top =
      await cachedFetch(
        'home:top',
        TTL.HOME,
        () =>
          apiFetch(
            `${API}/top/anime?page=1`
          )
      );

    const season =
      await cachedFetch(
        'home:season',
        TTL.HOME,
        () =>
          apiFetch(
            `${API}/seasons/now?page=1`
          )
      );

    const topData =
      (top?.data || []).map(
        normalizeAnime
      );

    const seasonData =
      (season?.data || []).map(
        normalizeAnime
      );

    res.json({
      data: {
        spotlightAnimes:
          topData.slice(0, 10),

        trendingAnimes:
          topData.slice(0, 20),

        latestEpisodeAnimes:
          seasonData.slice(0, 24),

        topAiringAnimes:
          seasonData.slice(0, 24),

        mostPopularAnimes:
          topData.slice(0, 24),

        mostFavoriteAnimes:
          topData.slice(0, 24),

        latestCompletedAnimes:
          topData.slice(0, 24)
      }
    });
  } catch (err) {
    res.status(502).json({
      error: err.message
    });
  }
};

/*
────────────────────────────────────────────
SCHEDULE
────────────────────────────────────────────
*/

exports.getSchedule = async (
  req,
  res
) => {
  try {
    const data =
      await cachedFetch(
        'schedule',
        TTL.HOME,
        () =>
          apiFetch(
            `${API}/schedules`
          )
      );

    res.json({
      data: {
        scheduledAnimes:
          (
            data?.data || []
          ).map(normalizeAnime)
      }
    });
  } catch (err) {
    res.status(502).json({
      error: err.message
    });
  }
};

/*
────────────────────────────────────────────
SEARCH
────────────────────────────────────────────
*/

exports.searchAnime = async (
  req,
  res
) => {
  try {
    const {
      keyword = '',
      page = 1
    } = req.query;

    if (!keyword.trim()) {
      return res.json({
        data: {
          animes: [],
          totalPages: 1
        }
      });
    }

    const data =
      await cachedFetch(
        `search:${keyword}:${page}`,
        TTL.BROWSE,
        () =>
          apiFetch(
            `${API}/anime?q=${encodeURIComponent(
              keyword
            )}&page=${page}`
          )
      );

    res.json({
      data: {
        animes:
          (
            data?.data || []
          ).map(normalizeAnime),

        totalPages:
          data?.pagination
            ?.last_visible_page || 1
      }
    });
  } catch (err) {
    res.status(502).json({
      error: err.message
    });
  }
};

/*
────────────────────────────────────────────
A-Z LIST
────────────────────────────────────────────
*/

exports.getAzList = async (
  req,
  res
) => {
  try {
    const {
      letter = 'all',
      page = 1
    } = req.query;

    let url =
      `${API}/top/anime?page=${page}`;

    if (letter !== 'all') {
      url =
        `${API}/anime?q=${letter}&page=${page}`;
    }

    const data =
      await cachedFetch(
        `az:${letter}:${page}`,
        TTL.BROWSE,
        () => apiFetch(url)
      );

    res.json({
      data: {
        animes:
          (
            data?.data || []
          ).map(normalizeAnime),

        totalPages:
          data?.pagination
            ?.last_visible_page || 1
      }
    });
  } catch (err) {
    res.status(502).json({
      error: err.message
    });
  }
};

/*
────────────────────────────────────────────
GENRE
────────────────────────────────────────────
*/

exports.getByGenre = async (
  req,
  res
) => {
  try {
    const { genre } =
      req.params;

    const page =
      req.query.page || 1;

    const data =
      await cachedFetch(
        `genre:${genre}:${page}`,
        TTL.BROWSE,
        () =>
          apiFetch(
            `${API}/anime?q=${encodeURIComponent(
              genre
            )}&page=${page}`
          )
      );

    res.json({
      data: {
        animes:
          (
            data?.data || []
          ).map(normalizeAnime),

        totalPages:
          data?.pagination
            ?.last_visible_page || 1
      }
    });
  } catch (err) {
    res.status(502).json({
      error: err.message
    });
  }
};

/*
────────────────────────────────────────────
INFO
IMPORTANT:
Return FULL raw Jikan data
for detail/watch pages
────────────────────────────────────────────
*/

exports.getAnimeInfo = async (
req,
res
) => {
try {
const { id } =
req.params;

const [
infoRes,
charRes
] = await Promise.all([
cachedFetch(
`info:${id}`,
TTL.ANIME_INFO,
() =>
apiFetch(
`${API}/anime/${id}/full`
)
),

cachedFetch(
`characters:${id}`,
TTL.ANIME_INFO,
() =>
apiFetch(
`${API}/anime/${id}/characters`
)
)
]);

const animeData =
infoRes?.data || {};

animeData.characters =
Array.isArray(
charRes?.data
)
? charRes.data
: [];

animeData.relations =
animeData?.relations ||
animeData?.related ||
animeData?.recommendations ||
[];

res.json({
data: animeData
});
} catch (err) {
res.status(502).json({
error: err.message
});
}
};

/*

────────────────────────────────────────────
EPISODES
────────────────────────────────────────────
*/

exports.getEpisodes = async (req, res) => {
try {
const { id } = req.params;

const data = await cachedFetch(
`episodes:${id}`,
TTL.EPISODES,
() =>
apiFetch(
`${API}/anime/${id}/episodes`
)
);

const episodes = (data?.data || []).map((ep, index) => ({
// Always use sequential episode number — never raw mal_id (which is a large ID, not 1/2/3)
number: ep.number || index + 1,

title:
ep.title ||
`Episode ${index + 1}`,

// Keep the original MAL episode ID for reference, but don't use as number
mal_episode_id: ep.mal_id || ep.episode_id || null,

episodeId:
ep.episode_id ||
`ep-${index + 1}`,

isFiller: false,

thumbnail:
ep.images?.jpg?.image_url ||
''
}));

res.json({
animeId: id,
episodes
});
} catch (err) {
res.status(502).json({
error: err.message
});
}
};

/*
────────────────────────────────────────────
EPISODE NAVIGATION
────────────────────────────────────────────
*/


exports.getEpisodeNavigation = async (req, res) => {
  try {
    const { id, ep } = req.params;
    const current = Number(ep);

    const totalEpisodes = 24;

    const previous =
      current > 1 ? current - 1 : null;

    const next =
      current < totalEpisodes
        ? current + 1
        : null;

    return res.status(200).json({
      animeId: id,
      previous,
      current,
      next,
      totalEpisodes
    });
  } catch (error) {
    return res.status(500).json({
      message:
        'Failed to fetch episode navigation',
      error: error.message
    });
  }
};

/*
────────────────────────────────────────────
SOURCES
IMPORTANT:
Temporary demo stream
until real provider is connected
────────────────────────────────────────────
*/

// Scraper modules — bundled directly so no separate service is needed
const v2Engine = require('../engine/resolution/index');
const megaplayExtractor = require('../engine/extractors/MegaPlayExtractor');
const htmlExtractor = require('../engine/extractors/HTMLExtractor');
const { CachedStream, ReliabilityScore } = require('../engine/storage/mappingDB');

exports.getSources = async (req, res) => {
  return exports.getSourcesV2(req, res);
};

exports.getSourcesV2 = async (req, res) => {
  const startTime = Date.now();
  let logEntry = {
    animeId: Number(req.query.animeId),
    epNum: Number(req.query.epNum),
    title: req.query.title,
    category: req.query.category || 'sub',
    serverSelected: req.query.server || 'hd-1',
    cacheHit: false,
    result: 'failure'
  };

  try {
    const {
      server   = 'hd-1',
      category = 'sub',
      epNum,
      animeId,
      title
    } = req.query;

    if (!animeId || !epNum) {
      return res.status(400).json({ error: 'animeId and epNum are required' });
    }

    const { ExtractionLog } = require('../engine/storage/mappingDB');

    const finishLog = async (resultType, extractedResponse, providerId, strategy, reason, step, code, embedUrl) => {
      logEntry.result = resultType;
      logEntry.durationMs = Date.now() - startTime;
      logEntry.providerSelected = providerId;
      logEntry.extractionStrategy = strategy;
      if (extractedResponse && extractedResponse.sources) {
        logEntry.streamUrlValid = true;
        logEntry.subtitleCount = extractedResponse.tracks ? extractedResponse.tracks.length : 0;
      }
      if (reason) logEntry.failureReason = reason;
      if (step) logEntry.failedStep = step;
      if (code) logEntry.responseCode = code;
      if (embedUrl) logEntry.embedUrl = embedUrl;

      const mongoose = require('mongoose');
      if (mongoose.connection.readyState === 1) {
        try {
          await ExtractionLog.create(logEntry);
        } catch (e) {
          console.error('Failed to write ExtractionLog', e.message);
        }
      }
    };

    const cacheKey = `${animeId}-${epNum}-${category}-${server}`;
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      try {
        const cached = await CachedStream.findOne({ cacheKey });
        if (cached && new Date() < cached.expiresAt) {
            console.log(`[V2 Engine] Serving from Persistent Cache: ${cacheKey}`);
            logEntry.cacheHit = true;
            await finishLog('success', cached.data, cached.provider, 'cache');
            return res.json(cached.data);
        }
      } catch (e) {
        console.warn(`[V2 Cache Error] ${e.message}`);
      }
    }

    console.log(`[V2 Engine Sources] animeId=${animeId} epNum=${epNum} category=${category} title=${title}`);

    // Helper to save to cache
    const saveToCache = async (result, providerId) => {
        if (mongoose.connection.readyState === 1) {
          try {
              await CachedStream.findOneAndUpdate(
                 { cacheKey },
                 {
                   jikanId: Number(animeId),
                   epNum: Number(epNum),
                   category,
                   server,
                   provider: providerId,
                   data: result,
                   expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 mins TTL
                 },
                 { upsert: true, new: true }
              );

              // Update Reliability Score
              await ReliabilityScore.findOneAndUpdate(
                { providerId },
                {
                  $inc: { successfulExtractions: 1 },
                  $set: { lastChecked: new Date() }
                },
                { upsert: true }
              );
          } catch (e) {
               console.warn(`[V2 Cache Save Error] ${e.message}`);
          }
        }
    };

    const updateFailureScore = async (providerId, reason, step, code, embedUrl) => {
        try {
            await finishLog('failure', null, providerId, 'extract', reason, step, code, embedUrl);

            if (mongoose.connection.readyState === 1) {
              const score = await ReliabilityScore.findOneAndUpdate(
                { providerId },
                {
                  $inc: { failedExtractions: 1 },
                  $set: { lastChecked: new Date() }
                },
                { upsert: true, new: true }
              );

              if (score && score.failedExtractions > 5) {
                  console.warn(`[Auto-Recovery] Provider ${providerId} has too many failures, marking mappings for rediscovery...`);
                  const { ProviderMapping } = require('../engine/storage/mappingDB');
                  await ProviderMapping.updateMany(
                     { "providers.providerId": providerId, jikanId: Number(animeId) },
                     { $set: { "providers.$.status": "broken", "providers.$.lastVerified": new Date() } }
                  );
                  await ReliabilityScore.updateOne(
                     { providerId },
                     { $set: { failedExtractions: 0 } } // reset for retry
                  );
              }
            }
        } catch (e) { }
    };

    // Try V2 Megaplay direct extractor first (does not need pre-resolution)
    let v2Success = false;
    let v2HonestFailure = false;

    if (title || animeId) {
      const metadata = {
        title: title || '',
        title_english: title,
        title_romaji: title,
        jikanId: animeId
      };

      const mapping = await v2Engine.resolveAnime(animeId, metadata);
      const prefProvider = mapping ? mapping.preferredProvider : null;

      // If MegaPlay is the preferred cached provider, try it first
      if (prefProvider === 'megaplay' && animeId && epNum && !v2Success) {
         try {
            const megaplaySrc = await megaplayExtractor.extract({ animeId, epNum, category });
            if (megaplaySrc && megaplaySrc.sources && megaplaySrc.sources.length > 0) {
               const result = buildResponse(req, megaplaySrc, server, category, 'v2');
               await saveToCache(result, 'megaplay');
               await finishLog('success', result, 'megaplay', 'direct_extract');
               v2Success = true;
               return res.json(result);
            }
         } catch (err) {
            console.warn(`[V2 Engine] Cached Megaplay extraction failed: ${err.message}`);
         }
      }

      if (mapping && mapping.providers && mapping.providers.length > 0) {
        // Collect all potential providers
        let validProviders = mapping.providers.filter(p => p.status !== 'broken' && (p.type === category || p.type === 'both'));
        
        // Push preferredProvider to front
        if (prefProvider && prefProvider !== 'megaplay') {
            const pIdx = validProviders.findIndex(p => p.providerId === prefProvider);
            if (pIdx > 0) {
                const pObj = validProviders.splice(pIdx, 1)[0];
                validProviders.unshift(pObj);
            }
        }

        // Loop through all providers as a fallback chain
        for (const providerMatch of validProviders) {
            console.log(`[V2 Loop] Checking provider: ${providerMatch.providerId}`);
            if (v2Success) break;
            
            const adapter = v2Engine.adapters.find(a => a.id === providerMatch.providerId);
            if (!adapter) {
               console.log(`[V2 Loop] No adapter found for ${providerMatch.providerId}`);
               continue;
            }
            
            console.log(`[V2 Loop] Calling fetchEpisodes for ${providerMatch.providerAnimeId}`);
            const eps = await adapter.fetchEpisodes(providerMatch.providerAnimeId, providerMatch.type);
            const targetEp = eps.find(e => parseInt(e.episodeNumber) === parseInt(epNum));
            
            if (targetEp) {
                let servers = await adapter.fetchServers(targetEp.providerEpisodeId);
                
                if (servers && servers.length > 0) {
                   const originallyRequestedCategory = category === 'dub' ? 'dub' : 'sub';
                   
                   if (providerMatch.type === 'both') {
                       servers = servers.filter(s => s.type === originallyRequestedCategory || s.category === originallyRequestedCategory);
                   } else {
                       servers = servers.map(s => ({ ...s, type: originallyRequestedCategory }));
                   }
                   
                   if (servers.length > 0) {
                      const mappedServers = servers.map(s => ({ key: s.serverId || s.id, name: s.serverName, category: s.type || s.category }));
                      
                      // For Zoro/HiAnime clones
                      if (typeof adapter.getSourceUrl === 'function') {
                        try {
                          const url = await adapter.getSourceUrl(servers[0].serverId);
                          if (url) {
                            const extracted = await htmlExtractor.extract({ embedUrl: url });
                            if (extracted && extracted.sources && extracted.sources.length > 0) {
                              extracted.servers = mappedServers;
                              const result = buildResponse(req, extracted, servers[0].serverName, category, 'v2');
                              await saveToCache(result, providerMatch.providerId);
                              await finishLog('success', result, providerMatch.providerId, 'html_extract');
                              v2Success = true;
                              const mongoose = require('mongoose');
                              if (mongoose.connection.readyState === 1) await mongoose.model('ProviderMapping').updateOne({ jikanId: Number(animeId) }, { $set: { preferredProvider: providerMatch.providerId } });
                              return res.json(result);
                            }
                          }
                        } catch (e) {
                          await updateFailureScore(providerMatch.providerId, e.message, 'zoro_extract');
                        }
                      }
                      
                      // For Gogo Anime clones / iframes
                      if (!v2Success && servers[0].serverId && servers[0].serverId.startsWith('http')) {
                         try {
                           console.log(`[V2 Loop] Attempting HTMLExtractor for Gogo: ${servers[0].serverId}`);
                           const extracted = await htmlExtractor.extract({ embedUrl: servers[0].serverId });
                           if (extracted && extracted.sources && extracted.sources.length > 0) {
                               console.log(`[V2 Loop] HTMLExtractor SUCCESS`);
                               extracted.servers = mappedServers;
                               const result = buildResponse(req, extracted, servers[0].serverName, category, 'v2');
                               await saveToCache(result, providerMatch.providerId);
                               await finishLog('success', result, providerMatch.providerId, 'iframe_extract');
                               v2Success = true;
                               const mongoose = require('mongoose');
                               if (mongoose.connection.readyState === 1) await mongoose.model('ProviderMapping').updateOne({ jikanId: Number(animeId) }, { $set: { preferredProvider: providerMatch.providerId } });
                               return res.json(result);
                           } else {
                               console.log(`[V2 Loop] HTMLExtractor returned empty sources: ${JSON.stringify(extracted)}`);
                           }
                         } catch (e) {
                            console.log(`[V2 Loop] HTMLExtractor failed: ${e.message}`);
                            await updateFailureScore(providerMatch.providerId, e.message, 'gogo_extract', null, servers[0].serverId);
                         }
                      }
                   }
                }
            }
        }
      }

      // If loop finished and no success, it's a true honest failure across ALL mapping providers
      // Try MegaPlay Extract fallback: Ensure MegaPlay is NOT first priority unless preferred
      if (!v2Success && prefProvider !== 'megaplay' && animeId && epNum) {
         try {
            const megaplaySrc = await megaplayExtractor.extract({ animeId, epNum, category });
            if (megaplaySrc && megaplaySrc.sources && megaplaySrc.sources.length > 0) {
               const result = buildResponse(req, megaplaySrc, server, category, 'v2');
               await saveToCache(result, 'megaplay');
               await finishLog('success', result, 'megaplay', 'direct_extract');
               v2Success = true;
               const mongoose = require('mongoose');
               if (mongoose.connection.readyState === 1) await mongoose.model('ProviderMapping').updateOne({ jikanId: Number(animeId) }, { $set: { preferredProvider: 'megaplay' } });
               return res.json(result);
            }
         } catch (err) {
            console.warn(`[V2 Engine] Fallback Megaplay extraction failed: ${err.message}`);
            await updateFailureScore('megaplay', err.message, 'megaplay-extract');
         }
      }

      if (!v2Success) {
          v2HonestFailure = true;
      }
    }

    if (v2HonestFailure && !v2Success) {
       console.log(`[Sources] V2 honest failure reached for category=${category}`);
    }

    // ── HONEST FAILURE (No fakes allowed)
    // If we reach here, V2 could not find anything (or category doesn't exist).
    await finishLog('404', null, 'none', 'none', `Category '${category}' not available or mapping missing`);
    return res.status(404).json({ error: `Category '${category}' not available for this anime or failed to resolve.` });

  } catch (err) {
    console.error('[getSourcesV2] Unhandled error:', err.message);
    const { ExtractionLog } = require('../engine/storage/mappingDB');
    logEntry.result = 'failure';
    logEntry.failureReason = err.message;
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      await ExtractionLog.create(logEntry).catch(()=>{});
    }
    return res.status(500).json({ error: err.message });
  }
};

function isProxyAllowed(urlStr) {
  const allowList = [
    'gogocdn.net', 'gogocdn.stream', 'vibeplayer.site', 'gogoanime.by',
    'anitaku.to', 'anitaku.pe', 'megacloud.tv', 'megacloud.club',
    'rapid-cloud.co', 'vidstreaming.io', 'filemoon.sx', 'filemoon.in',
    'streamtape.com', 'doodstream.com', 'hianime.dk', 'hianime.to',
    'hianime.sx', 'aniwaves.ru', 'kissanime.com.ru', 'anikai.to',
    'cdn.gogocdn.net', 'cdn2.gogocdn.net', 'cdn3.gogocdn.net',
    'file.takutakucdn.store', 'takutakucdn.store'
  ];
  try {
     const host = new URL(urlStr).hostname;
     return allowList.some(h => host === h || host.endsWith('.' + h));
  } catch { return false; }
}

function buildResponse(req, result, server, category, tier) {
  const proxyBaseUrl = `/backend-api/proxy/m3u8?url=`;

  const proxiedSources = (result.sources || []).map(s => {
    if (s.url && s.url.includes('.m3u8') && isProxyAllowed(s.url)) {
      return { ...s, url: proxyBaseUrl + encodeURIComponent(s.url) };
    }
    return s;
  });

  return {
    sources:  proxiedSources,
    tracks:   result.tracks   || [],
    intro:    result.intro    || null,
    outro:    result.outro    || null,
    servers:  result.servers  || [],
    provider: result.provider || null,
    tier,
    data: {
      sources:       proxiedSources,
      tracks:        result.tracks   || [],
      intro:         result.intro    || null,
      outro:         result.outro    || null,
      servers:       result.servers  || [],
      currentServer: server,
      category,
    },
  };
}


/*
────────────────────────────────────────────
CATEGORY HELPERS
────────────────────────────────────────────
*/

async function browseTop(
  res,
  cacheKey,
  page = 1
) {
  try {
    const data =
      await cachedFetch(
        cacheKey,
        TTL.BROWSE,
        () =>
          apiFetch(
            `${API}/top/anime?page=${page}`
          )
      );

    res.json({
      data: {
        animes:
          (
            data?.data || []
          ).map(normalizeAnime),

        totalPages:
          data?.pagination
            ?.last_visible_page || 1
      }
    });
  } catch (err) {
    res.status(502).json({
      error: err.message
    });
  }
}

exports.getTopAiring = (
  req,
  res
) =>
  browseTop(
    res,
    `top:${req.query.page || 1}`,
    req.query.page || 1
  );

exports.getMostPopular = (
  req,
  res
) =>
  browseTop(
    res,
    `popular:${req.query.page || 1}`,
    req.query.page || 1
  );

exports.getMostFavorite = (
  req,
  res
) =>
  browseTop(
    res,
    `favorite:${req.query.page || 1}`,
    req.query.page || 1
  );

exports.getMovies = (
  req,
  res
) =>
  browseTop(
    res,
    `movies:${req.query.page || 1}`,
    req.query.page || 1
  );

exports.getTvSeries = (
  req,
  res
) =>
  browseTop(
    res,
    `tv:${req.query.page || 1}`,
    req.query.page || 1
  );

exports.getNewSeason = (
  req,
  res
) =>
  browseTop(
    res,
    `new:${req.query.page || 1}`,
    req.query.page || 1
  );

exports.getCompleted = (
  req,
  res
) =>
  browseTop(
    res,
    `completed:${req.query.page || 1}`,
    req.query.page || 1
  );

exports.getOngoing = (
  req,
  res
) =>
  browseTop(
    res,
    `ongoing:${req.query.page || 1}`,
    req.query.page || 1
  );

/*
────────────────────────────────────────────
STATS
────────────────────────────────────────────
*/

exports.getStats = async (
  req,
  res
) => {
  try {
    const mongoose = require('mongoose');
    let stats = null;
    if (mongoose.connection.readyState === 1) {
      stats = await PageView.findOne({ pageId: req.params.pageId }).lean();
    }

    res.json(
      stats || {
        pageId: req.params.pageId,
        totalViews: 0,
        likeCount: 0,
        dislikeCount: 0
      }
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.incrementView = async (
  req,
  res
) => {
  try {
    const { pageId } = req.params;
    const { animeId } = req.body;

    const mongoose = require('mongoose');
    let stats = null;
    if (mongoose.connection.readyState === 1) {
      stats = await PageView.findOneAndUpdate(
        { pageId },
        {
          $inc: { totalViews: 1 },
          $setOnInsert: { animeId: animeId || pageId }
        },
        { upsert: true, new: true }
      );
    } else {
      stats = { pageId, totalViews: 1, likeCount: 0, dislikeCount: 0 };
    }

    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.setReaction = async (
  req,
  res
) => {
  try {
    const { pageId } = req.params;
    const { reaction, animeId } = req.body;

    if (!['like', 'dislike'].includes(reaction)) {
      return res.status(400).json({ error: 'reaction must be like or dislike' });
    }

    const field = reaction === 'like' ? 'likeCount' : 'dislikeCount';

    const mongoose = require('mongoose');
    let stats = null;
    if (mongoose.connection.readyState === 1) {
      stats = await PageView.findOneAndUpdate(
        { pageId },
        {
          $inc: { [field]: 1 },
          $setOnInsert: { animeId: animeId || pageId }
        },
        { upsert: true, new: true }
      );
    } else {
      stats = {
        pageId,
        totalViews: 0,
        likeCount: reaction === 'like' ? 1 : 0,
        dislikeCount: reaction === 'dislike' ? 1 : 0
      };
    }

    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/*
────────────────────────────────────────────
CACHE
────────────────────────────────────────────
*/

exports.getCacheStats = (
  req,
  res
) => {
  const {
    cache
  } = require('../cache');

  res.json(
    cache.stats()
  );
};

exports.clearCache = (
  req,
  res
) => {
  const {
    cache
  } = require('../cache');

  cache.clear();

  res.json({
    message:
      'Cache cleared'
  });
};

/*
────────────────────────────────────────────
LATEST SUBBED / DUBBED / CHINESE
Ported from Zoro: latest/subbed.php, dubbed.php, chinese.php
────────────────────────────────────────────
*/

exports.getLatestSubbed = (req, res) =>
  browseTop(res, `latest-sub:${req.query.page || 1}`, req.query.page || 1);

exports.getLatestDubbed = (req, res) =>
  browseTop(res, `latest-dub:${req.query.page || 1}`, req.query.page || 1);

exports.getLatestChinese = (req, res) =>
  browseTop(res, `latest-cn:${req.query.page || 1}`, req.query.page || 1);

/*
────────────────────────────────────────────
SUB-CATEGORY
Ported from Zoro: sub-category/id.php
────────────────────────────────────────────
*/

exports.getSubCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const page = req.query.page || 1;
    const data = await cachedFetch(
      `subcat:${id}:${page}`,
      TTL.BROWSE,
      () => apiFetch(`${API}/anime?q=${encodeURIComponent(id)}&page=${page}`)
    );
    res.json({
      data: {
        animes: (data?.data || []).map(normalizeAnime),
        totalPages: data?.pagination?.last_visible_page || 1
      }
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
};

/*
────────────────────────────────────────────
SITEMAP
Ported from Zoro: sitemap.php + sitemaps/*.php
────────────────────────────────────────────
*/

exports.getSitemap = async (req, res) => {
  try {
    const data = await cachedFetch(
      'sitemap:top',
      TTL.BROWSE,
      () => apiFetch(`${API}/top/anime?page=1&limit=50`)
    );
    const animes = data?.data || [];
    const baseUrl = process.env.SITE_URL || 'https://animex-dhhs.onrender.com';
    const urls = animes.map(a =>
      `  <url><loc>${baseUrl}/anime/${a.mal_id}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`
    ).join('\n');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${baseUrl}/home</loc><changefreq>daily</changefreq><priority>1.0</priority></url>\n${urls}\n</urlset>`;
    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/*
────────────────────────────────────────────
TOP 10 WIDGET  (today/week/month/yearly tabs)
Uses Jikan /top/anime with different filters
────────────────────────────────────────────
*/

async function buildTop100() {
  // Fetch 4 pages from Jikan = up to 100 anime
  const pages = await Promise.all(
    [1, 2, 3, 4].map(p =>
      cachedFetch(`top100:p${p}`, TTL.BROWSE, () => apiFetch(`${API}/top/anime?page=${p}`))
        .catch(() => ({ data: [] }))
    )
  );
  const all = pages.flatMap(d => d?.data || []);
  return all.slice(0, 100).map((a, i) => ({
    id: a.mal_id,
    name: a.title || a.title_english || 'Unknown',
    poster: a.images?.jpg?.large_image_url || a.images?.jpg?.image_url || '/no-poster.svg',
    type: a.type || '',
    score: a.score || null,
    rank: i + 1,
    episodes: { sub: typeof a.episodes === 'number' ? a.episodes : null, dub: null }
  }));
}

exports.getTop10 = async (req, res) => {
  try {
    const list = await buildTop100();
    // Widget shows top 10; full page uses all 100 split by tabs
    const top10 = list.slice(0, 10);
    res.json({ data: { top10Animes: { today: list, week: list, month: list, yearly: list } } });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
};

/*
────────────────────────────────────────────
TOP 100 FULL PAGE  (/api/anime/top100?page=1)
────────────────────────────────────────────
*/

exports.getTop100 = async (req, res) => {
  try {
    const page = Math.max(1, Math.min(4, Number(req.query.page) || 1));
    const data = await cachedFetch(
      `top100:${page}`,
      TTL.BROWSE,
      () => apiFetch(`${API}/top/anime?page=${page}`)
    );
    const animes = (data?.data || []).map((a, i) => ({
      id: a.mal_id,
      name: a.title || a.title_english || 'Unknown',
      poster: a.images?.jpg?.large_image_url || a.images?.jpg?.image_url || '/no-poster.svg',
      type: a.type || '',
      score: a.score || null,
      rank: (page - 1) * 25 + i + 1,
      episodes: { sub: typeof a.episodes === 'number' ? a.episodes : null, dub: null }
    }));
    res.json({ data: { animes, totalPages: 4, currentPage: page } });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
};
