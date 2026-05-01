const ZoroCloneAdapter = require('./ZoroCloneAdapter');

class AnikaiAdapter extends ZoroCloneAdapter {
  constructor() {
    super('anikai', 'Anikai.to', 'https://anikai.to');
  }
}

module.exports = new AnikaiAdapter();
