const GogoCloneAdapter = require('./GogoCloneAdapter');

class KissAnimeAdapter extends GogoCloneAdapter {
  constructor() {
    super('kissanime', 'KissAnime.com.ru', 'https://kissanime.com.ru');
  }
}

module.exports = new KissAnimeAdapter();
