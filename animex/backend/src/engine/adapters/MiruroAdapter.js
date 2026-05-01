const ZoroCloneAdapter = require('./ZoroCloneAdapter');

class MiruroAdapter extends ZoroCloneAdapter {
  constructor() {
    super('miruro', 'Miruro.tv', 'https://www.miruro.tv');
  }
}

module.exports = new MiruroAdapter();
