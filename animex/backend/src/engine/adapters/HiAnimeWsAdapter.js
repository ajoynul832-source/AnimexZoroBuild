const ZoroCloneAdapter = require('./ZoroCloneAdapter');

class HiAnimeWsAdapter extends ZoroCloneAdapter {
  constructor() {
    super('hianimews', 'HiAnime.ws', 'https://hianime.ws');
  }
}

module.exports = new HiAnimeWsAdapter();
