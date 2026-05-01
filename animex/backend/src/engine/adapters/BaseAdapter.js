class BaseAdapter {
  constructor(id, name) {
    this.id = id;
    this.name = name;
  }

  /**
   * Search and verify if the given anime metadata maps to a valid series on this provider.
   * Expected to gracefully handle synonyms and language variants.
   * @param {Object} metadata - { title, title_english, title_romaji, jikanId, synonyms }
   * @returns {Array} - Array of { providerId, providerAnimeId, type: 'sub'|'dub', url }
   */
  async searchAndVerify(metadata) {
    throw new Error('searchAndVerify must be implemented by adapter');
  }

  /**
   * Fetch all episodes for a given valid providerAnimeId.
   * @param {String} providerAnimeId
   * @param {String} type - 'sub' or 'dub'
   * @returns {Array} - Array of { episodeNumber, providerEpisodeId, type }
   */
  async fetchEpisodes(providerAnimeId, type) {
    throw new Error('fetchEpisodes must be implemented by adapter');
  }

  /**
   * Fetch all available servers for a given episode.
   * @param {String} providerEpisodeId
   * @returns {Array} - Array of { serverName, serverId, type }
   */
  async fetchServers(providerEpisodeId) {
    throw new Error('fetchServers must be implemented by adapter');
  }
}

module.exports = BaseAdapter;
