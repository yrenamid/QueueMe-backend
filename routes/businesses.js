const express = require("express")
const { authenticateToken, authorizeRoles } = require("../middleware/auth")
const sql = require("../database/connection")

const router = express.Router()

// Helper to fetch staff membership
async function userHasStaffAccess(userId, businessId) {
  const rows = await sql.query('SELECT 1 FROM staff_members WHERE user_id = ? AND business_id = ? LIMIT 1', [userId, businessId])
  return rows.length > 0
}

// GET /api/businesses (admin only)
router.get('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const rows = await sql.query('SELECT id, name, slug, email, phone, address, type, max_queue_length, reserve_slots, notify_customer, auto_wait_times, multi_step_queue, qr_code_url, qr_code_img, settings FROM businesses ORDER BY name');
    const businesses = rows.map(r => ({
      ...r,
      settings: safeParseJSON(r.settings)
    }))
    return res.json({ success: true, data: { businesses } })
  } catch (error) {
    console.error('List businesses error:', error)
    return res.status(500).json({ success: false, message: 'Failed to list businesses', error: error.message })
  }
})

// GET /api/businesses/slug/:slug  (owner, staff, or admin)
// NOTE: Placed before generic '/:id' route to avoid it being captured as id='slug'
router.get('/slug/:slug', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params
    const rows = await sql.query('SELECT * FROM businesses WHERE slug = ? LIMIT 1', [slug])
    if (!rows.length) return res.status(404).json({ success: false, message: 'Business not found' })
    const business = rows[0]
    // Access: admin OR owner OR staff member
    let allowed = false
    if (req.user.role === 'admin' || business.owner_id === req.user.id) allowed = true
    else if (req.user.role === 'staff') {
      const staffRows = await sql.query('SELECT 1 FROM staff_members WHERE user_id = ? AND business_id = ? LIMIT 1', [req.user.id, business.id])
      allowed = staffRows.length > 0
    }
    if (!allowed) return res.status(403).json({ success: false, message: 'Access denied to this business' })
    business.settings = safeParseJSON(business.settings)
    return res.json({ success: true, data: { business } })
  } catch (error) {
    console.error('Get business by slug error:', error)
    return res.status(500).json({ success: false, message: 'Failed to fetch business by slug', error: error.message })
  }
})

// GET /api/businesses/slug/:slug/qrcode  (owner, staff, or admin)
router.get('/slug/:slug/qrcode', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params;
    const rows = await sql.query('SELECT id, owner_id, slug, qr_code_url FROM businesses WHERE slug = ? LIMIT 1', [slug]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Business not found' });
    const business = rows[0];

    // Access check (admin, owner, or staff member)
    let allowed = false;
    if (req.user.role === 'admin' || business.owner_id === req.user.id) allowed = true; else if (req.user.role === 'staff') {
      const staff = await sql.query('SELECT 1 FROM staff_members WHERE user_id = ? AND business_id = ? LIMIT 1', [req.user.id, business.id]);
      allowed = staff.length > 0;
    }
    if (!allowed) return res.status(403).json({ success: false, message: 'Access denied' });

    const path = require('path');
    const fs = require('fs');
    const QRCode = require('qrcode');
    const uploadsDir = path.join(__dirname, '..', 'uploads', 'qrcodes');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    const filename = `${business.id}.png`; // still keyed by id to avoid collisions
    const filePath = path.join(uploadsDir, filename);
    const publicUrl = `${process.env.API_BASE_URL || 'http://localhost:5000'}/uploads/qrcodes/${filename}`;

    if (fs.existsSync(filePath)) {
      return res.json({ success: true, data: { url: publicUrl } });
    }

  const BASE_URL = (process.env.BASE_URL || process.env.FRONTEND_URL || 'http://localhost:8100').replace(/\/+$/, '');
  const customerUrl = `${BASE_URL}/customer/${slug}`; // canonical public landing path

    try {
      await QRCode.toFile(filePath, customerUrl, { width: 256, margin: 2 });
    } catch (e) {
      return res.status(500).json({ success: false, message: 'Failed to generate QR code', error: e.message });
    }
    if (!business.qr_code_url) {
      await sql.query('UPDATE businesses SET qr_code_url = ? WHERE id = ?', [publicUrl, business.id]);
    }
    return res.json({ success: true, data: { url: publicUrl } });
  } catch (error) {
    console.error('Business slug QR generation error:', error);
    return res.status(500).json({ success: false, message: 'QR generation failed', error: error.message });
  }
});

// GET /api/businesses/:id  (owner, staff, or admin)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const rows = await sql.query('SELECT * FROM businesses WHERE id = ? LIMIT 1', [id])
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Business not found' })
    }
    const business = rows[0]
    let allowed = false
    if (req.user.role === 'admin' || business.owner_id === req.user.id) {
      allowed = true
    } else if (req.user.role === 'staff') {
      allowed = await userHasStaffAccess(req.user.id, id)
    }
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Access denied to this business' })
    }
    business.settings = safeParseJSON(business.settings)
    return res.json({ success: true, data: { business } })
  } catch (error) {
    console.error('Get business error:', error)
    return res.status(500).json({ success: false, message: 'Failed to fetch business', error: error.message })
  }
})

// GET /api/businesses/:id/settings
router.get('/:id/settings', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const rows = await sql.query('SELECT owner_id, settings FROM businesses WHERE id = ? LIMIT 1', [id])
    if (!rows.length) return res.status(404).json({ success: false, message: 'Business not found' })
    const business = rows[0]

    let allowed = false
    if (req.user.role === 'admin' || business.owner_id === req.user.id) allowed = true
    else if (req.user.role === 'staff') allowed = await userHasStaffAccess(req.user.id, id)
    if (!allowed) return res.status(403).json({ success: false, message: 'Access denied to this business' })

    return res.json({ success: true, data: { settings: safeParseJSON(business.settings) } })
  } catch (error) {
    console.error('Get business settings error:', error)
    return res.status(500).json({ success: false, message: 'Failed to fetch business settings', error: error.message })
  }
})

// PUT /api/businesses/:id/settings  (owner or admin)
router.put('/:id/settings', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const { settings } = req.body || {}
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, message: 'settings object required' })
    }
    const rows = await sql.query('SELECT owner_id, settings FROM businesses WHERE id = ? LIMIT 1', [id])
    if (!rows.length) return res.status(404).json({ success: false, message: 'Business not found' })
    const business = rows[0]
    if (!(req.user.role === 'admin' || business.owner_id === req.user.id)) {
      return res.status(403).json({ success: false, message: 'Only owner or admin can update settings' })
    }
    const merged = { ...(safeParseJSON(business.settings) || {}), ...settings }
    await sql.query('UPDATE businesses SET settings = ? WHERE id = ?', [JSON.stringify(merged), id])
    return res.json({ success: true, message: 'Settings updated', data: { settings: merged } })
  } catch (error) {
    console.error('Update business settings error:', error)
    return res.status(500).json({ success: false, message: 'Failed to update business settings', error: error.message })
  }
})

// GET /api/businesses/:id/qrcode  -> generate or return existing QR code PNG for business dashboard slug
router.get('/:id/qrcode', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await sql.query(
      'SELECT id, owner_id, slug FROM businesses WHERE id = ? LIMIT 1',
      [id]
    );
    if (!rows.length) return res.status(404).send("Business not found");
    const business = rows[0];

    // Access check
    let allowed = false;
    if (req.user.role === 'admin' || business.owner_id === req.user.id) allowed = true;
    else if (req.user.role === 'staff') {
      const staff = await sql.query(
        'SELECT 1 FROM staff_members WHERE user_id = ? AND business_id = ? LIMIT 1',
        [req.user.id, id]
      );
      allowed = staff.length > 0;
    }
    if (!allowed) return res.status(403).send("Access denied");

    const path = require('path');
    const fs = require('fs');
    const QRCode = require('qrcode');
    const uploadsDir = path.join(__dirname, '..', 'uploads', 'qrcodes');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const filename = `${business.id}.png`;
    const filePath = path.join(uploadsDir, filename);
  const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:8100'}/${business.slug}-dashboard`;


    if (!fs.existsSync(filePath)) {
      await QRCode.toFile(filePath, dashboardUrl, { width: 256, margin: 2 });
    }

    // Serve the image directly
    return res.sendFile(filePath);
  } catch (error) {
    console.error('Business QR generation error:', error);
    return res.status(500).send("QR generation failed");
  }
});

function safeParseJSON(val){
  if(!val) return {}
  try { return typeof val === 'object' ? val : JSON.parse(val) } catch { return {} }
}

module.exports = router
