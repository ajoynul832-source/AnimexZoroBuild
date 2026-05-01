const mongoose = require('mongoose');
const { CachedStream, ProviderMapping, ReliabilityScore, ExtractionLog, SystemAlert } = require('./mappingDB');
const axios = require('axios');
const htmlExtractor = require('../extractors/HTMLExtractor');

// Analyzes extraction logs for anomalies and triggers alerts
async function detectAnomalies() {
  console.log('[BackgroundWorker] Running anomaly detection...');
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentLogs = await ExtractionLog.find({ createdAt: { $gte: oneHourAgo } }).lean();
    
    if (recentLogs.length < 10) return; // Not enough data

    const groupedByProvider = {};
    let totalFailures = 0;
    let total404s = 0;
    let subtitleFailures = 0;
    let dubFailures = 0;
    let totalExtractionTime = 0;
    let cacheHits = 0;

    recentLogs.forEach(log => {
      const pId = log.providerSelected || 'unknown';
      if (!groupedByProvider[pId]) groupedByProvider[pId] = { fails: 0, total: 0 };
      groupedByProvider[pId].total++;
      
      if (log.result === 'failure') {
        groupedByProvider[pId].fails++;
        totalFailures++;
        if (log.category === 'dub') dubFailures++;
      }
      if (log.result === '404') total404s++;
      if (log.result === 'success' && log.subtitleCount === 0) subtitleFailures++;
      if (!log.cacheHit) totalExtractionTime += (log.durationMs || 0);
      if (log.cacheHit) cacheHits++;
    });

    const createAlert = async (type, msg, providerId = null) => {
      const exists = await SystemAlert.findOne({ type, resolved: false, providerId });
      if (!exists) {
        console.error(`[ALERT] ${type}: ${msg}`);
        await SystemAlert.create({ type, message: msg, providerId });
      }
    };

    // 1. Provider failure spike (>30% failure rate)
    for (const [pId, stats] of Object.entries(groupedByProvider)) {
      if (stats.total > 10 && stats.fails / stats.total > 0.3) {
        await createAlert('provider_failure_spike', `Provider ${pId} has ${Math.round((stats.fails/stats.total)*100)}% failure rate`, pId);
        
        // Quarantine mode triggered from alerts
        await ReliabilityScore.updateOne(
           { providerId: pId },
           { $inc: { failedExtractions: 10 } } // Push it over the recovery threshold
        );
      }
    }

    // 2. Repeated 404 surge (>20% of requests)
    if (total404s / recentLogs.length > 0.2) {
      await createAlert('repeated_404_surge', `High 404 rate: ${Math.round((total404s/recentLogs.length)*100)}% of recent requests`);
    }

    // 3. Subtitle failures spike
    const successfulRequests = recentLogs.length - totalFailures - total404s;
    if (successfulRequests > 10 && subtitleFailures / successfulRequests > 0.5) {
      await createAlert('subtitle_failures_spike', `Over 50% of successful streams missing subtitles`);
    }

    // 4. Sudden dub failures
    const dubLogs = recentLogs.filter(l => l.category === 'dub');
    if (dubLogs.length > 5 && dubFailures / dubLogs.length > 0.4) {
      await createAlert('sudden_dub_failures', `Dub failure rate is abnormally high (${Math.round((dubFailures/dubLogs.length)*100)}%)`);
    }

    // 5. Major extraction slowdown
    const avgExtractionTime = successfulRequests > 0 ? totalExtractionTime / successfulRequests : 0;
    if (avgExtractionTime > 3000) {
      await createAlert('major_extraction_slowdown', `Average extraction time is ${Math.round(avgExtractionTime)}ms`);
    }

  } catch (error) {
    console.warn(`[BackgroundWorker] Anomaly detection error: ${error.message}`);
  }
}

// Run stream validation independently (e.g. every hour)
async function validateStreams() {
  console.log('[BackgroundWorker] Starting stream validation routine...');
  try {
    const expiredStreams = await CachedStream.find({ expiresAt: { $lte: new Date() } });
    if (expiredStreams.length > 0) {
      console.log(`[BackgroundWorker] Expiring ${expiredStreams.length} stale streams.`);
      await CachedStream.deleteMany({ expiresAt: { $lte: new Date() } });
    }

    // Verify a small batch of currently active streams
    const activeStreams = await CachedStream.find({ expiresAt: { $gt: new Date() } }).limit(50);
    for (const stream of activeStreams) {
      if (stream.data && stream.data.sources && stream.data.sources.length > 0) {
        let isStillValid = false;
        try {
          // Check the actual m3u8 header quietly without downloading the whole thing
          const checkRes = await axios.head(stream.data.sources[0].url, { timeout: 5000 });
          if (checkRes.status >= 200 && checkRes.status < 400) {
            isStillValid = true;
          }
        } catch (e) {
          isStillValid = false;
        }

        if (!isStillValid) {
          console.log(`[BackgroundWorker] Stream ${stream.cacheKey} invalid, deleting...`);
          await CachedStream.deleteOne({ _id: stream._id });
        }
      }
    }
  } catch (error) {
    console.warn(`[BackgroundWorker] Validation error: ${error.message}`);
  }
}

// Simple cron-like interval
function startBackgroundWorkers() {
    // Run stream validation every 30 minutes
    setInterval(validateStreams, 30 * 60 * 1000);
    
    // Run anomaly detection every 5 minutes
    setInterval(detectAnomalies, 5 * 60 * 1000);

    // Initial run delayed by a minute
    setTimeout(validateStreams, 60 * 1000);
    setTimeout(detectAnomalies, 2 * 60 * 1000);
}

exports.startBackgroundWorkers = startBackgroundWorkers;
exports.validateStreams = validateStreams;
exports.detectAnomalies = detectAnomalies;
