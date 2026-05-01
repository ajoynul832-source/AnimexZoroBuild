const ZoroCloneAdapter = require('./ZoroCloneAdapter');

class HiAnimeOrgAdapter extends ZoroCloneAdapter {
  constructor() {
    super('hianimeorg', 'HiAnime.org', 'https://hianime.org');
  }
}

module.exports = new HiAnimeOrgAdapter();
