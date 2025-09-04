const express = require('express');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const sql = require('../database/connection');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// POST /api/admin/regenerate-qrcodes?slug=optional-slug
// Admin-only endpoint to regenerate QR PNGs for businesses.
router.post('/regenerate-qrcodes', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { slug } = req.query;
    const uploadsDir = path.join(__dirname, '..', 'uploads', 'qrcodes');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const rows = slug
      ? await sql.query('SELECT id, slug FROM businesses WHERE slug = ? LIMIT 1', [slug])
      : await sql.query('SELECT id, slug FROM businesses');

    if (!rows.length) return res.status(404).json({ success: false, message: 'No businesses found' });

    const baseApi = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
    const BASE_URL = (process.env.BASE_URL || process.env.FRONTEND_URL || 'http://localhost:8100').replace(/\/+$/, '');

    const results = [];
    for (const b of rows) {
      const filename = `${b.id}.png`;
      const filePath = path.join(uploadsDir, filename);
      const publicUrl = `${baseApi.replace(/\/+$/, '')}/uploads/qrcodes/${filename}`;
      const customerUrl = `${BASE_URL}/customer/${b.slug}`;
      try {
        await QRCode.toFile(filePath, customerUrl, { width: 256, margin: 2 });
        await sql.query('UPDATE businesses SET qr_code_url = ? WHERE id = ?', [publicUrl, b.id]);
        results.push({ id: b.id, slug: b.slug, url: publicUrl, ok: true });
      } catch (e) {
        results.push({ id: b.id, slug: b.slug, ok: false, error: e.message });
      }
    }

    return res.json({ success: true, data: results });
  } catch (error) {
    console.error('Regenerate QR error:', error);
    return res.status(500).json({ success: false, message: 'Failed to regenerate QR codes', error: error.message });
  }
});

module.exports = router;

// Temporary admin-only endpoint to import DB schema from server files
// Usage: POST /api/admin/import-schema with Authorization Bearer <admin-token>
// and header `x-import-secret: <IMPORT_SECRET>` where IMPORT_SECRET is set in env.
router.post('/import-schema', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const secret = process.env.IMPORT_SECRET || ''
    const provided = req.headers['x-import-secret'] || ''
    if (!secret || provided !== secret) {
      return res.status(403).json({ success: false, message: 'Invalid import secret' })
    }

    // Lazy require to avoid loading when not needed
    const importer = require('../database/import_schema')
    await importer.importSchema()
    return res.json({ success: true, message: 'Schema import started (check logs for details)' })
  } catch (error) {
    console.error('Import schema endpoint error:', error)
    return res.status(500).json({ success: false, message: 'Import failed', error: error.message })
  }
})

