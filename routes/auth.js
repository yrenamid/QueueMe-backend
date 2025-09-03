const express = require("express")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const { v4: uuidv4 } = require("uuid")
// NOTE: Switched from in-memory db (../config/database) to real MySQL pool (../database/connection)
// The old in-memory functions (findUserByEmail, createUser, createBusiness, etc.) are no longer used here.
const sql = require("../database/connection")
const { authenticateToken } = require("../middleware/auth")

const router = express.Router()

// Quick email availability check (MySQL)
router.get('/check-email', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email query param is required' });
    }
    const normalized = email.trim().toLowerCase();
    // Check across users (owners + staff), businesses table (redundant but explicit), and staff_members table
    const userRows = await sql.query('SELECT id FROM users WHERE email = ? LIMIT 1', [normalized]);
    const bizRows = await sql.query('SELECT id FROM businesses WHERE email = ? LIMIT 1', [normalized]);
    const staffRows = await sql.query('SELECT id FROM staff_members WHERE email = ? LIMIT 1', [normalized]);
    const exists = !!(userRows.length || bizRows.length || staffRows.length);
    return res.json({ success: true, available: !exists, exists });
  } catch (error) {
    console.error('Email check error:', error);
    return res.status(500).json({ success: false, message: 'Failed to check email' });
  }
});

// Phone availability / existence check (public for pre-validation)
router.get('/check-phone', async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) return res.status(400).json({ success: false, message: 'Phone query param is required' });
    const normalized = phone.toString().trim();
    if (!normalized) return res.status(400).json({ success: false, message: 'Phone query param is required' });
    const rows = await sql.query('SELECT id FROM businesses WHERE phone = ? LIMIT 1', [normalized]);
    return res.json({ success: true, exists: rows.length > 0 });
  } catch (error) {
    console.error('Phone check error:', error);
    return res.status(500).json({ success: false, message: 'Failed to check phone' });
  }
});

// Register new user (extended for business + staff + settings)
router.post("/register", async (req, res) => {
  try {
    const {
      email,
      password,
      role = 'business',
      businessName,
      businessType,
      address,
      phone,
      staffName,
      staffEmail,
      staffPassword,
      staffRole,
      maxQueueLength,
      reserveSlots,
      notifyCustomer,
      autoWaitTimes,
      multiStepQueue,
    } = req.body;

    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!normalizedEmail || !password || !businessName) {
      return res.status(400).json({ success: false, message: 'Required fields missing' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    // Email uniqueness across all relevant tables (owner/business/staff)
    const existingUser = await sql.query('SELECT id FROM users WHERE email = ? LIMIT 1', [normalizedEmail]);
    const existingBiz = await sql.query('SELECT id FROM businesses WHERE email = ? LIMIT 1', [normalizedEmail]);
    const existingStaff = await sql.query('SELECT id FROM staff_members WHERE email = ? LIMIT 1', [normalizedEmail]);
    if (existingUser.length || existingBiz.length || existingStaff.length) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    // Phone uniqueness (if provided and non-empty)
    const normalizedPhone = (phone || '').trim();
    if (normalizedPhone) {
      const phoneRows = await sql.query('SELECT id FROM businesses WHERE phone = ? LIMIT 1', [normalizedPhone]);
      if (phoneRows.length) {
        return res.status(409).json({ success: false, message: 'Phone number already registered with another business' });
      }
    }

    // Require at least one staff member (beyond owner) during registration
    if (!(staffName && staffEmail && staffPassword)) {
      return res.status(400).json({ success: false, message: 'At least one staff member (name, email, password) is required' });
    }

    const userId = uuidv4();
    const businessId = uuidv4();
    const baseSlug = (businessName || 'business').trim().toLowerCase()
      .replace(/[^a-z0-9\s-]/g,'')
      .replace(/\s+/g,'-')
      .replace(/-+/g,'-')
      .replace(/^-|-$/g,'')
      .substring(0, 60) || 'business';

    // Ensure slug uniqueness
    let slug = baseSlug;
    let slugAttempt = 1;
    while (true) {
      const slugRows = await sql.query('SELECT id FROM businesses WHERE slug = ? LIMIT 1', [slug]);
      if (!slugRows.length) break;
      slugAttempt += 1;
      if (slugAttempt > 50) { // fallback randomness after many collisions
        slug = `${baseSlug}-${(Math.random().toString(36).slice(2,8))}`;
      } else {
        slug = `${baseSlug}-${slugAttempt}`;
      }
    }
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert owner user
    await sql.query('INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)', [
      userId,
      normalizedEmail,
      passwordHash,
      role === 'admin' ? 'admin' : 'business'
    ]);

    // Prepare queue settings defaults
    const qMax = parseInt(maxQueueLength) || 50;
    const qReserve = parseInt(reserveSlots) || 0;
    const qNotify = notifyCustomer !== undefined ? !!notifyCustomer : true;
    const qAuto = autoWaitTimes !== undefined ? !!autoWaitTimes : true;
    const qMulti = multiStepQueue !== undefined ? !!multiStepQueue : false;

    // Placeholder QR values (generated after insert in this flow)
  let generatedQrImg = null; // base64 (for immediate front-end display)
  let generatedQrUrl = null; // public PNG URL

    // Temporary business insert (without QR yet)
    await sql.query(`INSERT INTO businesses (
      id, owner_id, name, slug, email, phone, address, type,
      max_queue_length, reserve_slots, notify_customer, auto_wait_times, multi_step_queue, settings, qr_code_url, qr_code_img
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` , [
      businessId,
      userId,
      businessName || 'New Business',
      slug,
      normalizedEmail,
      phone || '',
      address || '',
      (businessType || 'restaurant'),
      qMax,
      qReserve,
      qNotify,
      qAuto,
      qMulti,
      JSON.stringify({ createdVia: 'api', version: 1 }),
      null,
      null
    ]);

    // Required initial staff creation
    let staffMember = null;
    {
      const staffNorm = staffEmail.trim().toLowerCase();
      // Check duplication explicitly across businesses & staff_members as required
      const dupBiz = await sql.query('SELECT id FROM businesses WHERE email = ? LIMIT 1', [staffNorm]);
      const dupStaff = await sql.query('SELECT id FROM staff_members WHERE email = ? LIMIT 1', [staffNorm]);
      const dupUser = await sql.query('SELECT id FROM users WHERE email = ? LIMIT 1', [staffNorm]);
      if (dupBiz.length || dupStaff.length || dupUser.length) {
        return res.status(400).json({ success: false, message: 'Email already registered' });
      }
      const allowedStaffRoles = ['owner','manager','cashier'];
      const staffRoleNormalized = (staffRole || 'manager').toLowerCase();
      const finalStaffRole = allowedStaffRoles.includes(staffRoleNormalized) ? staffRoleNormalized : 'manager';
      const staffUserId = uuidv4();
      const staffHash = await bcrypt.hash(staffPassword, 10);
      await sql.query('INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)', [
        staffUserId,
        staffNorm,
        staffHash,
        'staff'
      ]);
      const staffMemberId = uuidv4();
      await sql.query('INSERT INTO staff_members (id, business_id, user_id, name, email, role) VALUES (?, ?, ?, ?, ?, ?)', [
        staffMemberId,
        businessId,
        staffUserId,
        staffName,
        staffNorm,
        finalStaffRole
      ]);
      staffMember = { id: staffMemberId, name: staffName, email: staffNorm, role: finalStaffRole };
    }

    // Generate QR Code data (not persisted as no columns for it yet)
    // Generate & persist PNG QR (public) pointing to customer landing page
    const path = require('path');
    const fs = require('fs');
    const QRCode = require('qrcode');
    const uploadsDir = path.join(__dirname, '..', 'uploads', 'qrcodes');
    try { if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true }); } catch {}
    const qrPngFilename = `${businessId}.png`;
    const qrFilePath = path.join(uploadsDir, qrPngFilename);
    const publicQrUrl = `${process.env.API_BASE_URL || 'http://localhost:5000'}/uploads/qrcodes/${qrPngFilename}`;
  const BASE_URL = (process.env.BASE_URL || process.env.FRONTEND_URL || 'http://localhost:8100').replace(/\/+$/, '');
  const customerLanding = `${BASE_URL}/customer/${slug}`; // canonical public customer landing path (legacy /customerfoodpage redirect supported)
    try {
      if (!fs.existsSync(qrFilePath)) {
        await QRCode.toFile(qrFilePath, customerLanding, { width: 256, margin: 2 });
      }
      // Also provide base64 for immediate display if front-end wants it
      try { generatedQrImg = await QRCode.toDataURL(customerLanding, { width: 256, margin: 2 }); } catch {}
      generatedQrUrl = publicQrUrl;
      await sql.query('UPDATE businesses SET qr_code_url = ?, qr_code_img = ? WHERE id = ?', [publicQrUrl, generatedQrImg, businessId]);
    } catch (e) {
      console.error('QR code generation failed:', e.message);
    }

    // JWT token
    const token = jwt.sign({ userId, email: normalizedEmail, role: (role === 'admin' ? 'admin' : 'business') }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

  const businessRow = await sql.query('SELECT * FROM businesses WHERE id = ?', [businessId]);
  const staffRows = await sql.query('SELECT id, name, email, role FROM staff_members WHERE business_id = ?', [businessId]);

    return res.status(201).json({
      success: true,
      message: 'Business registered successfully',
      data: {
        user: {
          id: userId,
          email: normalizedEmail,
          role: (role === 'admin' ? 'admin' : 'business'),
          businessId,
          businessName: businessName || 'New Business',
          slug
        },
        staff: staffRows,
        business: {
          id: businessRow[0].id,
          name: businessRow[0].name,
          slug: businessRow[0].slug,
          qr_code_url: generatedQrUrl,
          qr_code_img: generatedQrImg,
          // Backwards-compatible camelCase aliases for existing frontend code
          qrCodeUrl: generatedQrUrl,
          qrCodeImg: generatedQrImg,
          phone: businessRow[0].phone,
          address: businessRow[0].address,
          type: businessRow[0].type
        },
        token
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ success: false, message: 'Registration failed', error: error.message });
  }
});


// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!normalizedEmail || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }
    const users = await sql.query('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
    if (!users.length) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    const user = users[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    // Fetch business association (owner or staff)
    let businessId = null;
    let businessName = null;
    let slug = null;
    if (user.role === 'business' || user.role === 'admin') {
      const biz = await sql.query('SELECT id, name, slug FROM businesses WHERE owner_id = ? LIMIT 1', [user.id]);
      if (biz.length) { businessId = biz[0].id; businessName = biz[0].name; slug = biz[0].slug; }
    } else if (user.role === 'staff') {
      const staffBiz = await sql.query('SELECT b.id, b.name, b.slug FROM staff_members s JOIN businesses b ON b.id = s.business_id WHERE s.user_id = ? LIMIT 1', [user.id]);
      if (staffBiz.length) { businessId = staffBiz[0].id; businessName = staffBiz[0].name; slug = staffBiz[0].slug; }
    }

    const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    return res.json({
      success: true,
      message: 'Login successful',
      data: {
  user: { id: user.id, email: user.email, role: user.role, businessId, businessName, slug },
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Login failed', error: error.message });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const baseUser = req.user; // from middleware (id,email,role)
    let businessId = null;
    let businessName = null;
    let slug = null;
    if (baseUser.role === 'business' || baseUser.role === 'admin') {
      const biz = await sql.query('SELECT id,name,slug FROM businesses WHERE owner_id = ? LIMIT 1', [baseUser.id]);
      if (biz.length) { businessId = biz[0].id; businessName = biz[0].name; slug = biz[0].slug; }
    } else if (baseUser.role === 'staff') {
      const staffBiz = await sql.query('SELECT b.id,b.name,b.slug FROM staff_members s JOIN businesses b ON b.id = s.business_id WHERE s.user_id = ? LIMIT 1', [baseUser.id]);
      if (staffBiz.length) { businessId = staffBiz[0].id; businessName = staffBiz[0].name; slug = staffBiz[0].slug; }
    }
    return res.json({
      success: true,
      data: {
        user: {
          id: baseUser.id,
          email: baseUser.email,
          role: baseUser.role,
          businessId,
          businessName,
          slug
        }
      }
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch profile', error: error.message });
  }
});

// Update user profile
router.put("/profile", authenticateToken, async (req, res) => {
  try {
    const { businessName, currentPassword, newPassword } = req.body
    const user = req.user

    const updateData = {}

    // Update business name if provided
    if (businessName && businessName !== user.businessName) {
      updateData.businessName = businessName

      // Also update the business record if user owns a business
      if (user.businessId) {
        db.updateBusiness(user.businessId, { name: businessName })
      }
    }

    // Update password if provided
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: "Current password is required to set new password",
        })
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password)
      if (!isCurrentPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Current password is incorrect",
        })
      }

      // Validate new password
      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: "New password must be at least 6 characters long",
        })
      }

      // Hash new password
      const saltRounds = 10
      updateData.password = await bcrypt.hash(newPassword, saltRounds)
    }

    // Update user if there are changes
    if (Object.keys(updateData).length > 0) {
      const updatedUser = db.updateUser(user.id, updateData)
      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        })
      }
    }

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          businessId: user.businessId,
          businessName: updateData.businessName || user.businessName,
          createdAt: user.createdAt,
        },
      },
    })
  } catch (error) {
    console.error("Profile update error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to update profile",
      error: error.message,
    })
  }
})

// Refresh token
router.post("/refresh", authenticateToken, (req, res) => {
  try {
    const user = req.user

    // Generate new JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
    )

    res.json({
      success: true,
      message: "Token refreshed successfully",
      data: { token },
    })
  } catch (error) {
    console.error("Token refresh error:", error)
    res.status(500).json({
      success: false,
      message: "Token refresh failed",
      error: error.message,
    })
  }
})

// Logout (client-side token removal, but we can log it)
router.post("/logout", authenticateToken, (req, res) => {
  try {
    // In a real application, you might want to blacklist the token
    // For now, we'll just log the logout event
    console.log(`User ${req.user.email} logged out at ${new Date().toISOString()}`)

    res.json({
      success: true,
      message: "Logged out successfully",
    })
  } catch (error) {
    console.error("Logout error:", error)
    res.status(500).json({
      success: false,
      message: "Logout failed",
      error: error.message,
    })
  }
})

module.exports = router
