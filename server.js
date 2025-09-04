const express = require("express")
const cors = require("cors")
const bodyParser = require("body-parser")
const helmet = require("helmet")
const rateLimit = require("express-rate-limit")
const morgan = require("morgan")
const path = require('path')
const fs = require('fs')
require("dotenv").config()

// Helper to read/trim env vars
const readEnv = (k, fallback) => {
  const v = process.env[k]
  if (typeof v === 'string') {
    const t = v.trim()
    return t === '' ? fallback : t
  }
  return typeof fallback !== 'undefined' ? fallback : undefined
}

// Import routes
const authRoutes = require("./routes/auth")
const businessRoutes = require("./routes/businesses")
const queueRoutes = require("./routes/queue")
const menuRoutes = require("./routes/menu")
const staffRoutes = require("./routes/staff")
const qrRoutes = require("./routes/qr")
const publicRoutes = require('./routes/public')
const adminRoutes = require('./routes/admin')
const debugRoutes = require('./routes/debug')

// Import database connection to test it
require("./database/connection")

const app = express()

// Configure trust proxy to allow correct client IP detection when behind a reverse proxy
// Useful for platforms like Railway, Vercel, Heroku, etc.
// Set TRUST_PROXY to 'false' to disable. Default is enabled (1).
const trustProxyRaw = readEnv('TRUST_PROXY', '1')
let trustProxyValue = false
if (typeof trustProxyRaw === 'string') {
  const t = trustProxyRaw.toLowerCase()
  if (t === 'false' || t === '0') trustProxyValue = false
  else trustProxyValue = 1
} else if (typeof trustProxyRaw === 'number') {
  trustProxyValue = trustProxyRaw
} else {
  trustProxyValue = 1
}
app.set('trust proxy', trustProxyValue)
console.log('🔐 Express trust proxy set to:', trustProxyValue)
const PORT = process.env.PORT || 5000

// Security middleware
app.use(helmet())

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: "Too many requests from this IP, please try again later.",
  },
})
app.use("/api/", limiter)

// CORS configuration
// Allow configuring allowed origins via ALLOWED_ORIGINS (comma-separated) or FRONTEND_URL
const configuredFrontend = readEnv('FRONTEND_URL', 'http://localhost:8100')
const defaultLocalOrigins = [
  configuredFrontend,
  'http://localhost:8100',
  'http://127.0.0.1:8100',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
]
const envOriginsRaw = readEnv('ALLOWED_ORIGINS', '')
const envOrigins = envOriginsRaw.split(',').map(s => s.trim()).filter(Boolean)
const allowedOrigins = [...new Set([...envOrigins, ...defaultLocalOrigins])]

console.log('✅ Allowed CORS origins:', allowedOrigins)

const corsOptions = {
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true)
    if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true)
    return callback(new Error('CORS policy: Origin not allowed'))
  },
  credentials: true,
  optionsSuccessStatus: 200,
}
app.use(cors(corsOptions))

// Body parsing middleware
app.use(bodyParser.json({ limit: "10mb" }))
app.use(bodyParser.urlencoded({ extended: true, limit: "10mb" }))

// Ensure uploads directories exist
const uploadsDir = path.join(__dirname, 'uploads')
const qrDir = path.join(uploadsDir, 'qrcodes')
try {
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir)
  if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir)
} catch (e) {
  console.error('Failed creating uploads directories:', e.message)
}

// Static file serving for QR codes
// Ensure uploads can be fetched cross-origin by browsers (avoid CORP 'same-origin' blocking)
const uploadsPath = path.join(__dirname, 'uploads');
app.use('/uploads', (req, res, next) => {
  // Allow cross-origin embedding/usage of static assets (images) from the frontend origin
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')

  // Set Access-Control-Allow-Origin dynamically based on the request origin when allowed
  const reqOrigin = req.headers.origin
  if (reqOrigin && allowedOrigins.indexOf(reqOrigin) !== -1) {
    res.setHeader('Access-Control-Allow-Origin', reqOrigin)
  } else if (allowedOrigins.length > 0) {
    // fallback to the first allowed origin
    res.setHeader('Access-Control-Allow-Origin', allowedOrigins[0])
  } else {
    // last resort: allow all (not ideal for production)
    res.setHeader('Access-Control-Allow-Origin', '*')
  }

  // Encourage browsers to cache QR PNGs for one day
  res.setHeader('Cache-Control', 'public, max-age=86400')
  next()
})
app.use('/uploads', express.static(uploadsPath, {
  setHeaders(res, filePath) {
    // Ensure static middleware also sets a cache header for files
    res.setHeader('Cache-Control', 'public, max-age=86400');
  }
}));

// Logging middleware
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"))
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "QueueMe API is running",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  })
})

// API Routes
app.use("/api/auth", authRoutes)
app.use("/api/businesses", businessRoutes)
app.use("/api/queue", queueRoutes)
app.use("/api/menu", menuRoutes)
app.use("/api/staff", staffRoutes)
app.use("/api/qr", qrRoutes)
app.use('/api/public', publicRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/debug', debugRoutes)

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Welcome to QueueMe API",
    version: "1.0.0",
    documentation: "/api/docs",
    health: "/health",
  })
})

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Endpoint not found",
    message: `The requested endpoint ${req.originalUrl} does not exist`,
  })
})

// Global error handler
app.use((error, req, res, next) => {
  console.error("❌ Global error handler:", error)

  res.status(error.status || 500).json({
    error: error.message || "Internal server error",
    ...(process.env.NODE_ENV !== "production" && { stack: error.stack }),
  })
})

// Start server
app.listen(PORT, () => {
  console.log(`
🚀 QueueMe API Server Started
📍 Server running on port ${PORT}
🌐 Environment: ${process.env.NODE_ENV || "development"}
🔗 Health check: http://localhost:${PORT}/health
📚 API Base URL: http://localhost:${PORT}/api
  `)
})

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🔄 SIGTERM received, shutting down gracefully...")
  process.exit(0)
})

process.on("SIGINT", () => {
  console.log("🔄 SIGINT received, shutting down gracefully...")
  process.exit(0)
})

module.exports = app
