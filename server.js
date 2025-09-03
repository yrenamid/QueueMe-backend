const express = require("express")
const cors = require("cors")
const bodyParser = require("body-parser")
const helmet = require("helmet")
const rateLimit = require("express-rate-limit")
const morgan = require("morgan")
const path = require('path')
const fs = require('fs')
require("dotenv").config()
// Preferred frontend base URL for QR codes and cross-origin usage. Can be overridden with BASE_URL.
const BASE_URL = process.env.BASE_URL || process.env.FRONTEND_URL || "http://localhost:8100"

// Import routes
const authRoutes = require("./routes/auth")
const businessRoutes = require("./routes/businesses")
const queueRoutes = require("./routes/queue")
const menuRoutes = require("./routes/menu")
const staffRoutes = require("./routes/staff")
const qrRoutes = require("./routes/qr")
const publicRoutes = require('./routes/public')

// Import database connection to test it
require("./database/connection")

const app = express()
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
const corsOptions = {
  origin: [
    BASE_URL,
    "http://localhost:8100",
    "http://127.0.0.1:8100",
    "http://localhost:3000",
    "http://127.0.0.1:3000"
  ],
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
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  // Allow frontend origin to fetch these assets
  res.setHeader('Access-Control-Allow-Origin', BASE_URL);
  // Encourage browsers to cache QR PNGs for one day
  res.setHeader('Cache-Control', 'public, max-age=86400');
  next();
});
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
