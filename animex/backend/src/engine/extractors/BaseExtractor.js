class BaseExtractor {
  constructor(id, name) {
    this.id = id;
    this.name = name;
  }

  /**
   * Extract video sources and subtitle tracks from a given payload/server.
   * @param {Object} params - Context required for extraction (episodeId, server url, epNum, etc)
   * @returns {Object} - { sources: [{url, isM3U8, quality}], tracks: [{file, label, kind, default}], provider }
   */
  async extract(params) {
    throw new Error('extract must be implemented by extractor');
  }

  normaliseSources(sources) {
    if (!sources || !Array.isArray(sources)) return [];
    return sources.map(s => ({
      url: s.file || s.url || '',
      isM3U8: (s.file || s.url || '').includes('.m3u8'),
      quality: s.label || s.quality || 'auto'
    }));
  }

  normaliseTracks(tracks) {
    if (!tracks || !Array.isArray(tracks)) return [];
    return tracks.map(t => ({
      file: t.file || t.url || '',
      kind: t.kind || 'captions',
      label: t.label || 'English',
      default: t.default || false
    }));
  }
}

module.exports = BaseExtractor;
