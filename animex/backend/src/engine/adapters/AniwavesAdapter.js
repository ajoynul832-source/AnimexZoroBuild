const ZoroCloneAdapter = require('./ZoroCloneAdapter');

class AniwavesAdapter extends ZoroCloneAdapter {
  constructor() {
    super('aniwaves', 'Aniwaves.ru', 'https://aniwaves.ru');
  }
}

module.exports = new AniwavesAdapter();
