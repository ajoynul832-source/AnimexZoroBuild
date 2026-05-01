const { ProviderMapping } = require('../storage/mappingDB');
const mongoose = require('mongoose');
const gogoAdapter = require('../adapters/GogoAnimeAdapter');
const hianimeAdapter = require('../adapters/HiAnimeAdapter');
const hiAnimeWsAdapter = require('../adapters/HiAnimeWsAdapter');
const hiAnimeOrgAdapter = require('../adapters/HiAnimeOrgAdapter');
const aniWatchAtAdapter = require('../adapters/AniWatchAtAdapter');
const anikaiAdapter = require('../adapters/AnikaiAdapter');
const aniwavesAdapter = require('../adapters/AniwavesAdapter');
const kissAnimeAdapter = require('../adapters/KissAnimeAdapter');
const miruroAdapter = require('../adapters/MiruroAdapter');

class UniversalResolutionEngine {
  constructor() {
    this.adapters = []; // Will hold discovery adapters
    this.registerAdapter(gogoAdapter);
    this.registerAdapter(hianimeAdapter);
    this.registerAdapter(hiAnimeWsAdapter);
    this.registerAdapter(hiAnimeOrgAdapter);
    this.registerAdapter(aniWatchAtAdapter);
    this.registerAdapter(anikaiAdapter);
    this.registerAdapter(aniwavesAdapter);
    this.registerAdapter(kissAnimeAdapter);
    this.registerAdapter(miruroAdapter);
  }

  registerAdapter(adapter) {
    this.adapters.push(adapter);
  }

  /**
   * Resolves the canonical identity of an anime and finds its mapping across all providers.
   * If a mapping exists and is fresh, returns from DB.
   * Otherwise, triggers simultaneous multi-site discovery.
   */
  async resolveAnime(jikanId, metadata) {
    let mapping = null;
    const isDbConnected = mongoose.connection.readyState === 1;

    try {
      if (isDbConnected) {
        mapping = await ProviderMapping.findOne({ jikanId });
      }
    } catch (err) {
      console.warn(`[Engine] DB read error: ${err.message}`);
    }
    
    // Auto-heal if older than 7 days or if marked broken
    const isStale = mapping && (Date.now() - new Date(mapping.lastUpdated).getTime() > 7 * 24 * 60 * 60 * 1000);
    const isBroken = mapping && mapping.providers && mapping.providers.some(p => p.status === 'broken');
    const hasLegacyGogo = mapping && mapping.providers && mapping.providers.some(p => p.providerId === 'gogoanime' && p.type === 'both');
    
    if (!mapping || isStale || isBroken || hasLegacyGogo) {
      if (isBroken) console.log(`[Engine] Auto-healing broken mappings for Anime: ${metadata.title}`);
      if (hasLegacyGogo) console.log(`[Engine] Auto-healing legacy gogoanime both-type mappings for Anime: ${metadata.title}`);
      console.log(`[Engine] Initiating discovery for Anime: ${metadata.title} (ID: ${jikanId})`);
      const discoveredProviders = await this.triggerDiscovery(metadata);
      
      const hasSub = discoveredProviders.some(p => p.type === 'sub');
      const hasDub = discoveredProviders.some(p => p.type === 'dub');

      if (!mapping && isDbConnected) {
        mapping = new ProviderMapping({
          jikanId,
          title: metadata.title,
          providers: discoveredProviders,
          hasSub,
          hasDub
        });
      } else if (mapping && isDbConnected) {
        mapping.providers = discoveredProviders;
        mapping.lastUpdated = Date.now();
        mapping.hasSub = hasSub;
        mapping.hasDub = hasDub;
      }

      try {
        if (isDbConnected && mapping) {
          await mapping.save();
        }
      } catch (err) {
        console.warn(`[Engine] DB write error: ${err.message}`);
      }

      if (!isDbConnected) {
         mapping = {
            jikanId,
            title: metadata.title,
            providers: discoveredProviders,
            hasSub,
            hasDub
         };
      }
    }
    
    return mapping;
  }

  async triggerDiscovery(metadata) {
    const promises = this.adapters.map(adapter => adapter.searchAndVerify(metadata).catch(e => []));
    const results = await Promise.all(promises);
    return results.flat();
  }
}

module.exports = new UniversalResolutionEngine();
