const mongoose = require('mongoose');

const watchProgressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    animeId: {
      type: String,
      required: true,
    },
    animeTitle: {
      type: String,
      default: '',
    },
    animeImage: {
      type: String,
      default: '',
    },
    animeType: {
      type: String,
      default: '',
    },
    episodeId: {
      type: String,
      default: '',
    },
    episodeNumber: {
      type: Number,
      default: 1,
    },
    dubOrSub: {
      type: String,
      enum: ['sub', 'dub', ''],
      default: 'sub',
    },
    currentTime: {
      type: Number,   // seconds into the episode
      default: 0,
    },
    duration: {
      type: Number,   // total episode duration in seconds
      default: 0,
    },
    completed: {
      type: Boolean,
      default: false,
    },
    watchedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// One progress record per user+anime combination
watchProgressSchema.index({ userId: 1, animeId: 1 }, { unique: true });

module.exports = mongoose.model('WatchProgress', watchProgressSchema);
