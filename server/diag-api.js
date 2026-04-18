const express = require('express');
const database = require('../db/database');
const router = express.Router();

// POST /api/diag/log — client sends batch of events
router.post('/log', (req, res) => {
  try {
    const events = Array.isArray(req.body?.events) ? req.body.events : null;
    if (!events) return res.status(400).json({ status: 'error', message: 'events[] required' });
    for (const ev of events.slice(0, 50)) {
      database.addDiagLog(req.userId, ev.kind || 'unknown', ev.data || null);
    }
    res.json({ status: 'ok', count: events.length });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /api/diag/logs — retrieve recent logs for the user
router.get('/logs', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 500, 1000);
    const logs = database.getDiagLogs(req.userId, limit);
    res.json({ status: 'ok', logs });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// DELETE /api/diag/logs — clear logs for the user
router.delete('/logs', (req, res) => {
  try {
    database.clearDiagLogs(req.userId);
    res.json({ status: 'ok' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

module.exports = router;
