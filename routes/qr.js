const express = require("express")
const QRCode = require("qrcode")
const db = require("../config/database")
const { authenticateToken, authorizeRoles } = require("../middleware/auth")

const router = express.Router()

// Generate QR code for business queue
router.get("/business/:businessId", async (req, res) => {
  try {
    const { businessId } = req.params
    const { format = "png", size = 256 } = req.query

    // Check if business exists
    const business = db.findBusinessById(businessId)
    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business not found",
      })
    }

  // Use configurable BASE_URL so QR codes work on LAN / production (falls back to FRONTEND_URL then localhost)
  const baseUrl = process.env.BASE_URL || process.env.FRONTEND_URL || (process.env.QR_BASE_URL || "http://localhost:3000")
  // Prefer business slug for a stable public landing; fall back to id when slug missing
  const targetSlug = business.slug || businessId
  // Generate QR code URL that points guests to the public customer landing page
  const queueUrl = `${baseUrl}/customerfoodpage/${targetSlug}`

    // QR code options
    const options = {
      errorCorrectionLevel: process.env.QR_ERROR_CORRECTION || "M",
      type: "image/png",
      quality: 0.92,
      margin: Number.parseInt(process.env.QR_MARGIN) || 4,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
      width: Number.parseInt(size) || Number.parseInt(process.env.QR_WIDTH) || 256,
    }

    if (format === "svg") {
      // Generate SVG QR code
      const qrSvg = await QRCode.toString(queueUrl, { ...options, type: "svg" })
      res.setHeader("Content-Type", "image/svg+xml")
      res.send(qrSvg)
    } else if (format === "json") {
      // Return QR code data as JSON
      res.json({
        success: true,
        data: {
          businessId,
          businessName: business.name,
          queueUrl,
          qrCodeUrl: `${req.protocol}://${req.get("host")}/api/qr/business/${businessId}?format=png&size=${size}`,
        },
      })
    } else {
      // Generate PNG QR code (default)
      const qrBuffer = await QRCode.toBuffer(queueUrl, options)
      res.setHeader("Content-Type", "image/png")
      res.setHeader("Content-Length", qrBuffer.length)
      res.send(qrBuffer)
    }
  } catch (error) {
    console.error("Generate QR code error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to generate QR code",
      error: error.message,
    })
  }
})

// Generate QR code for specific customer
router.get("/customer/:customerId", async (req, res) => {
  try {
    const { customerId } = req.params
    const { format = "png", size = 256 } = req.query

    // Check if customer exists
    const customer = db.findQueueCustomerById(customerId)
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found in queue",
      })
    }

  // Use the same configurable BASE_URL for customer-facing links
  const baseUrl2 = process.env.BASE_URL || process.env.FRONTEND_URL || (process.env.QR_BASE_URL || "http://localhost:3000")
  // Generate customer status URL (keeps existing scan/status path)
  const statusUrl = `${baseUrl2}/scan/${customerId}/status`

    // QR code options
    const options = {
      errorCorrectionLevel: process.env.QR_ERROR_CORRECTION || "M",
      type: "image/png",
      quality: 0.92,
      margin: Number.parseInt(process.env.QR_MARGIN) || 4,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
      width: Number.parseInt(size) || Number.parseInt(process.env.QR_WIDTH) || 256,
    }

    if (format === "svg") {
      // Generate SVG QR code
      const qrSvg = await QRCode.toString(statusUrl, { ...options, type: "svg" })
      res.setHeader("Content-Type", "image/svg+xml")
      res.send(qrSvg)
    } else if (format === "json") {
      // Return QR code data as JSON
      res.json({
        success: true,
        data: {
          customerId,
          customerName: customer.customerName,
          statusUrl,
          qrCodeUrl: `${req.protocol}://${req.get("host")}/api/qr/customer/${customerId}?format=png&size=${size}`,
        },
      })
    } else {
      // Generate PNG QR code (default)
      const qrBuffer = await QRCode.toBuffer(statusUrl, options)
      res.setHeader("Content-Type", "image/png")
      res.setHeader("Content-Length", qrBuffer.length)
      res.send(qrBuffer)
    }
  } catch (error) {
    console.error("Generate customer QR code error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to generate customer QR code",
      error: error.message,
    })
  }
})

// Generate custom QR code (admin/business only)
router.post("/generate", authenticateToken, authorizeRoles("admin", "business"), async (req, res) => {
  try {
    const { url, format = "png", size = 256, title } = req.body

    if (!url) {
      return res.status(400).json({
        success: false,
        message: "URL is required",
      })
    }

    // Validate URL format
    try {
      new URL(url)
    } catch {
      return res.status(400).json({
        success: false,
        message: "Invalid URL format",
      })
    }

    // QR code options
    const options = {
      errorCorrectionLevel: process.env.QR_ERROR_CORRECTION || "M",
      type: "image/png",
      quality: 0.92,
      margin: Number.parseInt(process.env.QR_MARGIN) || 4,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
      width: Number.parseInt(size) || Number.parseInt(process.env.QR_WIDTH) || 256,
    }

    if (format === "svg") {
      // Generate SVG QR code
      const qrSvg = await QRCode.toString(url, { ...options, type: "svg" })
      res.setHeader("Content-Type", "image/svg+xml")
      if (title) {
        res.setHeader("Content-Disposition", `inline; filename="${title}.svg"`)
      }
      res.send(qrSvg)
    } else if (format === "json") {
      // Return QR code data as JSON
      res.json({
        success: true,
        data: {
          url,
          title: title || "Custom QR Code",
          format,
          size,
        },
      })
    } else {
      // Generate PNG QR code (default)
      const qrBuffer = await QRCode.toBuffer(url, options)
      res.setHeader("Content-Type", "image/png")
      res.setHeader("Content-Length", qrBuffer.length)
      if (title) {
        res.setHeader("Content-Disposition", `inline; filename="${title}.png"`)
      }
      res.send(qrBuffer)
    }
  } catch (error) {
    console.error("Generate custom QR code error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to generate custom QR code",
      error: error.message,
    })
  }
})

// Get QR code analytics (admin/business only)
router.get("/analytics/:businessId", authenticateToken, authorizeRoles("admin", "business"), (req, res) => {
  try {
    const { businessId } = req.params

    // Check if user has access to this business
    if (req.user.role !== "admin" && req.user.businessId !== businessId) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this business",
      })
    }

    const business = db.findBusinessById(businessId)
    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business not found",
      })
    }

    // Get queue data for analytics
    const queue = db.getQueueByBusinessId(businessId)

    // Calculate QR code usage analytics
    const analytics = {
      totalScans: queue.length, // Assuming each queue entry came from QR scan
      todayScans: queue.filter((c) => {
        const today = new Date().toDateString()
        return new Date(c.joinedAt).toDateString() === today
      }).length,
      conversionRate:
        queue.length > 0 ? (queue.filter((c) => c.status === "completed").length / queue.length) * 100 : 0,
      averageTimeToJoin: 2.5, // Mock data - in real app, track time from scan to join
      qrCodeUrls: {
        png: `${req.protocol}://${req.get("host")}/api/qr/business/${businessId}?format=png`,
        svg: `${req.protocol}://${req.get("host")}/api/qr/business/${businessId}?format=svg`,
        json: `${req.protocol}://${req.get("host")}/api/qr/business/${businessId}?format=json`,
      },
    }

    res.json({
      success: true,
      data: { analytics },
    })
  } catch (error) {
    console.error("Get QR analytics error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch QR code analytics",
      error: error.message,
    })
  }
})

module.exports = router
