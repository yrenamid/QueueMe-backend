const express = require("express")
const bcrypt = require("bcryptjs")
const db = require("../config/database")
const { authenticateToken, authorizeRoles } = require("../middleware/auth")

const router = express.Router()

// Get all staff members for a business
router.get("/business/:businessId", authenticateToken, authorizeRoles("admin", "business"), (req, res) => {
  try {
    const { businessId } = req.params
    const { status, role } = req.query

    // Check if user has access to this business
    if (req.user.role !== "admin" && req.user.businessId !== businessId) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this business",
      })
    }

    let staff = db.getStaffByBusinessId(businessId)

    // Filter by status if provided
    if (status) {
      staff = staff.filter((member) => member.status === status)
    }

    // Filter by role if provided
    if (role) {
      staff = staff.filter((member) => member.role === role)
    }

    // Sort by name
    staff.sort((a, b) => a.name.localeCompare(b.name))

    res.json({
      success: true,
      data: { staff },
    })
  } catch (error) {
    console.error("Get staff members error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch staff members",
      error: error.message,
    })
  }
})

// Get specific staff member
router.get("/:id", authenticateToken, authorizeRoles("admin", "business"), (req, res) => {
  try {
    const { id } = req.params
    const staffMember = db.findStaffById(id)

    if (!staffMember) {
      return res.status(404).json({
        success: false,
        message: "Staff member not found",
      })
    }

    // Check if user has access to this business
    if (req.user.role !== "admin" && req.user.businessId !== staffMember.businessId) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this staff member",
      })
    }

    res.json({
      success: true,
      data: { staffMember },
    })
  } catch (error) {
    console.error("Get staff member error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch staff member",
      error: error.message,
    })
  }
})

// Create new staff member
router.post("/", authenticateToken, authorizeRoles("admin", "business"), async (req, res) => {
  try {
    const { businessId, name, email, role, password } = req.body

    // Validate required fields
    if (!businessId || !name || !email || !role) {
      return res.status(400).json({
        success: false,
        message: "Business ID, name, email, and role are required",
      })
    }

    // Check if user has access to this business
    if (req.user.role !== "admin" && req.user.businessId !== businessId) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this business",
      })
    }

    // Validate role
    if (!["manager", "staff", "cashier"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role. Must be: manager, staff, or cashier",
      })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      })
    }

    // Check if email already exists
    const existingUser = db.findUserByEmail(email)
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists",
      })
    }

    // Create staff member
    const staffMember = db.createStaff({
      businessId,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      role,
      status: "active",
      lastActive: new Date().toISOString(),
    })

    // Create user account if password is provided
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters long",
        })
      }

      const saltRounds = 10
      const hashedPassword = await bcrypt.hash(password, saltRounds)

      const business = db.findBusinessById(businessId)
      db.createUser({
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        role: "staff",
        businessId,
        businessName: business?.name || "Unknown Business",
      })
    }

    res.status(201).json({
      success: true,
      message: "Staff member created successfully",
      data: { staffMember },
    })
  } catch (error) {
    console.error("Create staff member error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to create staff member",
      error: error.message,
    })
  }
})

// Update staff member
router.put("/:id", authenticateToken, authorizeRoles("admin", "business"), (req, res) => {
  try {
    const { id } = req.params
    const updateData = req.body

    const staffMember = db.findStaffById(id)
    if (!staffMember) {
      return res.status(404).json({
        success: false,
        message: "Staff member not found",
      })
    }

    // Check if user has access to this business
    if (req.user.role !== "admin" && req.user.businessId !== staffMember.businessId) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this staff member",
      })
    }

    // Validate role if provided
    if (updateData.role && !["manager", "staff", "cashier"].includes(updateData.role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role. Must be: manager, staff, or cashier",
      })
    }

    // Validate status if provided
    if (updateData.status && !["active", "inactive", "suspended"].includes(updateData.status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be: active, inactive, or suspended",
      })
    }

    // Validate email format if provided
    if (updateData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(updateData.email)) {
        return res.status(400).json({
          success: false,
          message: "Invalid email format",
        })
      }

      // Check if email already exists (excluding current staff member)
      const existingUser = db.findUserByEmail(updateData.email)
      if (existingUser && existingUser.email !== staffMember.email) {
        return res.status(409).json({
          success: false,
          message: "User with this email already exists",
        })
      }

      updateData.email = updateData.email.toLowerCase().trim()
    }

    // Trim string fields
    if (updateData.name) updateData.name = updateData.name.trim()

    const updatedStaffMember = db.updateStaff(id, updateData)

    res.json({
      success: true,
      message: "Staff member updated successfully",
      data: { staffMember: updatedStaffMember },
    })
  } catch (error) {
    console.error("Update staff member error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to update staff member",
      error: error.message,
    })
  }
})

// Update staff member status
router.patch("/:id/status", authenticateToken, authorizeRoles("admin", "business"), (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body

    if (!["active", "inactive", "suspended"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be: active, inactive, or suspended",
      })
    }

    const staffMember = db.findStaffById(id)
    if (!staffMember) {
      return res.status(404).json({
        success: false,
        message: "Staff member not found",
      })
    }

    // Check if user has access to this business
    if (req.user.role !== "admin" && req.user.businessId !== staffMember.businessId) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this staff member",
      })
    }

    const updatedStaffMember = db.updateStaff(id, {
      status,
      statusUpdatedAt: new Date().toISOString(),
      statusUpdatedBy: req.user.id,
    })

    res.json({
      success: true,
      message: `Staff member status updated to ${status}`,
      data: { staffMember: updatedStaffMember },
    })
  } catch (error) {
    console.error("Update staff member status error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to update staff member status",
      error: error.message,
    })
  }
})

// Delete staff member
router.delete("/:id", authenticateToken, authorizeRoles("admin", "business"), (req, res) => {
  try {
    const { id } = req.params

    const staffMember = db.findStaffById(id)
    if (!staffMember) {
      return res.status(404).json({
        success: false,
        message: "Staff member not found",
      })
    }

    // Check if user has access to this business
    if (req.user.role !== "admin" && req.user.businessId !== staffMember.businessId) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this staff member",
      })
    }

    const deletedStaffMember = db.deleteStaff(id)

    // Also remove the user account if it exists
    const user = db.findUserByEmail(staffMember.email)
    if (user && user.role === "staff") {
      // In a real application, you might want to deactivate instead of delete
      console.log(`Would deactivate user account for ${staffMember.email}`)
    }

    res.json({
      success: true,
      message: "Staff member deleted successfully",
      data: { staffMember: deletedStaffMember },
    })
  } catch (error) {
    console.error("Delete staff member error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to delete staff member",
      error: error.message,
    })
  }
})

// Get staff member activity/performance
router.get("/:id/activity", authenticateToken, authorizeRoles("admin", "business"), (req, res) => {
  try {
    const { id } = req.params
    const { startDate, endDate } = req.query

    const staffMember = db.findStaffById(id)
    if (!staffMember) {
      return res.status(404).json({
        success: false,
        message: "Staff member not found",
      })
    }

    // Check if user has access to this business
    if (req.user.role !== "admin" && req.user.businessId !== staffMember.businessId) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this staff member",
      })
    }

    // Get queue activities by this staff member
    const queue = db.getQueueByBusinessId(staffMember.businessId)

    let activities = queue.filter(
      (customer) =>
        customer.calledBy === id ||
        customer.completedBy === id ||
        customer.extendedByUser === id ||
        customer.paymentUpdatedBy === id,
    )

    // Filter by date range if provided
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : new Date(0)
      const end = endDate ? new Date(endDate) : new Date()

      activities = activities.filter((customer) => {
        const customerDate = new Date(customer.joinedAt)
        return customerDate >= start && customerDate <= end
      })
    }

    // Calculate activity stats
    const stats = {
      totalCustomersHandled: activities.length,
      customersCompleted: activities.filter((c) => c.completedBy === id).length,
      customersCalled: activities.filter((c) => c.calledBy === id).length,
      timeExtensions: activities.filter((c) => c.extendedByUser === id).length,
      paymentUpdates: activities.filter((c) => c.paymentUpdatedBy === id).length,
    }

    res.json({
      success: true,
      data: {
        staffMember,
        activities,
        stats,
      },
    })
  } catch (error) {
    console.error("Get staff member activity error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch staff member activity",
      error: error.message,
    })
  }
})

module.exports = router
