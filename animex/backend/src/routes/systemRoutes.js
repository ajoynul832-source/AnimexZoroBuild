const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { ReliabilityScore, CachedStream, ExtractionLog, SystemAlert, ProviderMapping } = require('../engine/storage/mappingDB');

router.get('/health', async (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'ok' : 'disconnected (graceful fallback)';
  res.json({
    status: 'operational',
    database: dbStatus,
    timestamp: new Date()
  });
});

router.get('/providers', async (req, res) => {
  try {
    const scores = await ReliabilityScore.find().lean();
    const brokenMappingsCount = await ProviderMapping.countDocuments({ "providers.status": "broken" });

    res.json({
      providers: scores,
      brokenMappingsCount,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/cache', async (req, res) => {
  try {
    const totalStreams = await CachedStream.countDocuments();
    const staleStreams = await CachedStream.countDocuments({ expiresAt: { $lte: new Date() } });

    // Calculate cache hit ratio from today's logs
    const today = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const logs = await ExtractionLog.find({ createdAt: { $gte: today } }).select('cacheHit').lean();
    
    const hits = logs.filter(l => l.cacheHit).length;
    const total = logs.length;
    const hitRatio = total > 0 ? (hits / total) * 100 : 0;

    res.json({
      totalCachedStreams: totalStreams,
      staleStreamCount: staleStreams,
      cacheHitRatio24h: hitRatio.toFixed(2) + '%',
      totalRequests24h: total,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/failures', async (req, res) => {
  try {
    const activeAlerts = await SystemAlert.find({ resolved: false }).sort({ createdAt: -1 }).lean();
    
    // Aggregate failures by type for the last 24h
    const today = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const failedExtractions = await ExtractionLog.countDocuments({ result: 'failure', createdAt: { $gte: today } });
    const honest404s = await ExtractionLog.countDocuments({ result: '404', createdAt: { $gte: today } });

    // Dub and Sub specific failures
    const dubFailures = await ExtractionLog.countDocuments({ result: 'failure', category: 'dub', createdAt: { $gte: today } });
    const subFailures = await ExtractionLog.countDocuments({ result: 'failure', category: 'sub', createdAt: { $gte: today } });

    // Average extraction speed for successful requests
    const successLogs = await ExtractionLog.find({ result: 'success', cacheHit: false, createdAt: { $gte: today } }).select('durationMs').lean();
    const avgSpeed = successLogs.length > 0 
      ? successLogs.reduce((acc, curr) => acc + (curr.durationMs || 0), 0) / successLogs.length 
      : 0;

    res.json({
      failedExtractions24h: failedExtractions,
      honest404s24h: honest404s,
      dubFailures24h: dubFailures,
      subFailures24h: subFailures,
      avgExtractionSpeedMs: Math.round(avgSpeed),
      activeAlerts,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Expose audit trail
router.get('/audit', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const recentFailures = await ExtractionLog.find({ result: 'failure' })
           .sort({ createdAt: -1 })
           .limit(limit)
           .lean();
        
        res.json({ audits: recentFailures });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
