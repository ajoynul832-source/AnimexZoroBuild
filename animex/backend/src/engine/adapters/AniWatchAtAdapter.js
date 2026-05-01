const ZoroCloneAdapter = require('./ZoroCloneAdapter');

class AniWatchAtAdapter extends ZoroCloneAdapter {
  constructor() {
    super('aniwatchat', 'AniWatch.co.at', 'https://aniwatch.co.at');
  }
}

module.exports = new AniWatchAtAdapter();
