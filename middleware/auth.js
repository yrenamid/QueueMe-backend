const jwt = require("jsonwebtoken")
const sql = require("../database/connection")

// Middleware to authenticate JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1] // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access token is required",
    })
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: "Invalid or expired token",
      })
    }

    // Fetch user from MySQL
    sql.query('SELECT id, email, role FROM users WHERE id = ? LIMIT 1', [decoded.userId])
      .then(rows => {
        if (!rows.length) {
          return res.status(404).json({ success: false, message: 'User not found' })
        }
        req.user = rows[0]
        next()
      })
      .catch(err => {
        console.error('Auth lookup error:', err)
        return res.status(500).json({ success: false, message: 'Auth lookup failed' })
      })
  })
}

// Optional authentication middleware (doesn't fail if no token)
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    req.user = null
    return next()
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      req.user = null
    } else {
      sql.query('SELECT id, email, role FROM users WHERE id = ? LIMIT 1', [decoded.userId])
        .then(rows => { req.user = rows[0] || null; next() })
        .catch(() => { req.user = null; next() })
      return
    }
    next()
  })
}

// Middleware to authorize specific roles
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      })
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Insufficient permissions",
      })
    }

    next()
  }
}

// Middleware to check if user owns the business or is admin
const checkBusinessAccess = (req, res, next) => {
  const { businessId } = req.params
  const user = req.user

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    })
  }

  if (user.role === "admin" || user.businessId === businessId) {
    return next()
  }

  return res.status(403).json({
    success: false,
    message: "Access denied to this business",
  })
}

module.exports = {
  authenticateToken,
  optionalAuth,
  authorizeRoles,
  checkBusinessAccess,
}
