const mongoose = require('mongoose');

const providerMappingSchema = new mongoose.Schema({
  jikanId: { type: Number, required: true, index: true },
  malId: { type: Number },
  anilistId: { type: Number },
  canonicalTitles: [{ type: String }],
  title: { type: String, required: true },
  preferredProvider: { type: String }, // Used to remember the last successful provider for this anime
  providers: [{
    providerId: { type: String, required: true }, // 'gogoanime', 'hianime'
    providerAnimeId: { type: String, required: true },
    type: { type: String, enum: ['sub', 'dub', 'both', 'raw'], default: 'sub' },
    url: String,
    status: { type: String, enum: ['working', 'broken', 'pending'], default: 'working' },
    lastVerified: { type: Date, default: Date.now },
    extractionStrategy: { type: String }
  }],
  hasSub: { type: Boolean, default: false },
  hasDub: { type: Boolean, default: false },
  lastUpdated: { type: Date, default: Date.now }
});

const episodeMappingSchema = new mongoose.Schema({
  jikanId: { type: Number, required: true, index: true },
  episodeNumber: { type: Number, required: true },
  provider: { type: String, required: true },
  providerEpisodeId: { type: String, required: true },
  type: { type: String, enum: ['sub', 'dub', 'both'] },
  serverMappings: [{
    serverId: String,
    serverName: String,
    category: String
  }],
  subtitleMetadata: [{
    lang: String,
    url: String
  }]
});
episodeMappingSchema.index({ jikanId: 1, episodeNumber: 1, provider: 1, type: 1 }, { unique: true });

const reliabilityScoreSchema = new mongoose.Schema({
  providerId: { type: String, required: true, unique: true },
  successfulExtractions: { type: Number, default: 0 },
  failedExtractions: { type: Number, default: 0 },
  averageExtractionTimeMs: { type: Number, default: 0 },
  uptimePercentage: { type: Number, default: 100 },
  hasSubtitles: { type: Boolean, default: false },
  hasDub: { type: Boolean, default: false },
  lastChecked: { type: Date, default: Date.now }
});

const cachedStreamSchema = new mongoose.Schema({
  cacheKey: { type: String, required: true, unique: true },
  jikanId: { type: Number, required: true, index: true },
  epNum: { type: Number, required: true },
  category: { type: String, required: true },
  server: { type: String, required: true },
  provider: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true },
  expiresAt: { type: Date, required: true, index: { expires: '24h' } }, // Simple TTL
  createdAt: { type: Date, default: Date.now }
});

const extractionLogSchema = new mongoose.Schema({
  animeId: { type: Number, index: true },
  epNum: { type: Number },
  title: { type: String },
  category: { type: String },
  providerSelected: { type: String },
  serverSelected: { type: String },
  extractionStrategy: { type: String },
  cacheHit: { type: Boolean },
  durationMs: { type: Number },
  result: { type: String, enum: ['success', '404', 'failure'] },
  subtitleCount: { type: Number, default: 0 },
  streamUrlValid: { type: Boolean },
  failureReason: { type: String },
  failedStep: { type: String },
  responseCode: { type: Number },
  embedUrl: { type: String },
  createdAt: { type: Date, default: Date.now, index: { expires: '7d' } }
});

const systemAlertSchema = new mongoose.Schema({
  type: { type: String, required: true }, // 'provider_failure_spike', 'repeated_404_surge', etc.
  providerId: { type: String },
  message: { type: String, required: true },
  resolved: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

exports.ProviderMapping = mongoose.model('ProviderMapping', providerMappingSchema);
exports.EpisodeMapping = mongoose.model('EpisodeMapping', episodeMappingSchema);
exports.ReliabilityScore = mongoose.model('ReliabilityScore', reliabilityScoreSchema);
exports.CachedStream = mongoose.model('CachedStream', cachedStreamSchema);
exports.ExtractionLog = mongoose.model('ExtractionLog', extractionLogSchema);
exports.SystemAlert = mongoose.model('SystemAlert', systemAlertSchema);

