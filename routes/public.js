const express = require('express');
const path = require('path');
const fs = require('fs');
const sql = require('../database/connection');

const router = express.Router();

// Public (unauthenticated) QR endpoint by business slug
// GET /api/public/businesses/:slug/qrcode  -> { success, data: { url } }
router.get('/businesses/:slug/qrcode', async (req, res) => {
  try {
    const { slug } = req.params;
    if (!slug) return res.status(400).json({ success: false, message: 'Slug is required' });
    const rows = await sql.query('SELECT id, slug, qr_code_url FROM businesses WHERE slug = ? LIMIT 1', [slug]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Business not found' });
    const business = rows[0];

    const uploadsDir = path.join(__dirname, '..', 'uploads', 'qrcodes');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    const filename = `${business.id}.png`;
    const filePath = path.join(uploadsDir, filename);
  const baseApi = process.env.API_BASE_URL || 'http://localhost:5000';
  const publicUrl = `${baseApi}/uploads/qrcodes/${filename}`;

    if (fs.existsSync(filePath)) {
      // If stored value is missing or not an absolute URL, patch DB asynchronously
      if (!business.qr_code_url || !/^https?:\/\//i.test(business.qr_code_url)) {
        try { await sql.query('UPDATE businesses SET qr_code_url = ? WHERE id = ?', [publicUrl, business.id]); } catch {}
      }
      return res.json({ success: true, data: { url: publicUrl } });
    }

    // Generate the QR pointing to the public customer landing page
    const QRCode = require('qrcode');
    // Public customer landing page - unified route
  const BASE_URL = (process.env.BASE_URL || process.env.FRONTEND_URL || 'http://localhost:8100').replace(/\/+$/, '');
  const customerUrl = `${BASE_URL}/customer/${slug}`; // canonical public landing path
    try {
      await QRCode.toFile(filePath, customerUrl, { width: 256, margin: 2 });
    } catch (e) {
      return res.status(500).json({ success: false, message: 'Failed to generate QR code', error: e.message });
    }
    // Store url if not already
    if (!business.qr_code_url) {
      try { await sql.query('UPDATE businesses SET qr_code_url = ? WHERE id = ?', [publicUrl, business.id]); } catch { /* ignore */ }
    }
    return res.json({ success: true, data: { url: publicUrl } });
  } catch (error) {
    console.error('Public slug QR error:', error);
    return res.status(500).json({ success: false, message: 'QR generation failed', error: error.message });
  }
});

// Public business details by slug (no auth)
// GET /api/public/businesses/:slug -> { success: true, data: { business: { id, name, slug, type, address, phone } } }
router.get('/businesses/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    if (!slug) return res.status(400).json({ success: false, message: 'Slug is required' });
    const rows = await sql.query('SELECT id, name, slug, type, address, phone, qr_code_url FROM businesses WHERE slug = ? LIMIT 1', [slug]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Business not found' });
    const b = rows[0];
    return res.json({ success: true, data: { business: { id: b.id, name: b.name, slug: b.slug, type: b.type, address: b.address, phone: b.phone, qr_code_url: b.qr_code_url } } });
  } catch (error) {
    console.error('Public business fetch error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch business', error: error.message });
  }
});

module.exports = router;
