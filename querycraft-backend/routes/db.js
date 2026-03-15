// routes/db.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');

const dbController = require('../controllers/dbController');

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${randomUUID()}-${file.originalname}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100 MB, tune as needed
});

/**
 * POST /api/query/upload
 * field: file (form-data)
 * returns: { success: true, file: { id, originalName, path, ... } }
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'no_file' });
    const meta = await dbController.handleUpload(req.file);
    res.json(meta);
  } catch (err) {
    console.error('upload error', err);
    res.status(500).json({ error: 'upload_failed', message: err.message });
  }
});

/**
 * POST /api/query/execute
 * body JSON:
 * {
 *   sourceType: 'file'|'connection',
 *   fileId?: string,
 *   connectionString?: string,
 *   query: string,
 *   maxRows?: number
 * }
 */
router.post('/execute', async (req, res) => {
  try {
    const payload = req.body || {};
    const result = await dbController.executeQuery(payload);
    res.json(result);
  } catch (err) {
    console.error('execute error', err);
    res.status(400).json({ error: err.message || 'execute_failed' });
  }
});

module.exports = router;
