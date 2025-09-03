const express = require("express")
const db = require("../config/database")
const { authenticateToken, authorizeRoles, optionalAuth } = require("../middleware/auth")

const router = express.Router()

// Get queue for a business (public endpoint with optional auth)
router.get("/business/:businessId", optionalAuth, (req, res) => {
  try {
    const { businessId } = req.params
    const { status } = req.query

    let queue = db.getQueueByBusinessId(businessId)

    // Filter by status if provided
    if (status) {
      queue = queue.filter((customer) => customer.status === status)
    }

    // Sort by join time (oldest first)
    queue.sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt))

    res.json({
      success: true,
      data: { queue },
    })
  } catch (error) {
    console.error("Get queue error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch queue",
      error: error.message,
    })
  }
})

// Join queue (public endpoint)
router.post("/join", (req, res) => {
  try {
    const { businessId, customerName, customerPhone, customerEmail, orderItems, isPriority } = req.body

    // Validate required fields
    if (!businessId || !customerName) {
      return res.status(400).json({
        success: false,
        message: "Business ID and customer name are required",
      })
    }

    // Check if business exists
    const business = db.findBusinessById(businessId)
    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business not found",
      })
    }

    // Check queue capacity
    const currentQueue = db.getQueueByBusinessId(businessId).filter((c) => c.status === "waiting")
    if (currentQueue.length >= business.settings.queueLength) {
      return res.status(400).json({
        success: false,
        message: "Queue is currently full. Please try again later.",
      })
    }

    // Check priority slots if requesting priority
    if (isPriority) {
      const priorityCustomers = currentQueue.filter((c) => c.isPriority)
      if (priorityCustomers.length >= business.settings.prioritySlots) {
        return res.status(400).json({
          success: false,
          message: "Priority slots are full. Joining regular queue.",
        })
      }
    }

    // Calculate order total
    let orderTotal = 0
    if (orderItems && orderItems.length > 0) {
      orderTotal = orderItems.reduce((total, item) => total + item.price * item.quantity, 0)
    }

    // Add customer to queue
    const customer = db.addToQueue({
      businessId,
      customerName,
      customerPhone: customerPhone || "",
      customerEmail: customerEmail || "",
      orderItems: orderItems || [],
      orderTotal,
      isPriority: isPriority || false,
      paymentStatus: "pending",
    })

    res.status(201).json({
      success: true,
      message: "Successfully joined the queue",
      data: { customer },
    })
  } catch (error) {
    console.error("Join queue error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to join queue",
      error: error.message,
    })
  }
})

// Get customer status by ID (public endpoint)
router.get("/customer/:id", (req, res) => {
  try {
    const { id } = req.params
    const customer = db.findQueueCustomerById(id)

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found in queue",
      })
    }

    // Calculate current position
    const businessQueue = db
      .getQueueByBusinessId(customer.businessId)
      .filter((c) => c.status === "waiting")
      .sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt))

    const position = businessQueue.findIndex((c) => c.id === id) + 1

    res.json({
      success: true,
      data: {
        customer: {
          ...customer,
          position: position > 0 ? position : null,
          queueLength: businessQueue.length,
        },
      },
    })
  } catch (error) {
    console.error("Get customer status error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch customer status",
      error: error.message,
    })
  }
})

// Get specific customer details (staff/admin only)
router.get("/:id", authenticateToken, authorizeRoles("admin", "business", "staff"), (req, res) => {
  try {
    const { id } = req.params
    const customer = db.findQueueCustomerById(id)

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found in queue",
      })
    }

    // Check if user has access to this business
    if (req.user.role !== "admin" && req.user.businessId !== customer.businessId) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this customer",
      })
    }

    res.json({
      success: true,
      data: { customer },
    })
  } catch (error) {
    console.error("Get customer details error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch customer details",
      error: error.message,
    })
  }
})

// Update customer (staff/admin only)
router.put("/:id", authenticateToken, authorizeRoles("admin", "business", "staff"), (req, res) => {
  try {
    const { id } = req.params
    const updateData = req.body

    const customer = db.findQueueCustomerById(id)
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found in queue",
      })
    }

    // Check if user has access to this business
    if (req.user.role !== "admin" && req.user.businessId !== customer.businessId) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this customer",
      })
    }

    // Recalculate order total if order items are updated
    if (updateData.orderItems) {
      updateData.orderTotal = updateData.orderItems.reduce((total, item) => total + item.price * item.quantity, 0)
    }

    const updatedCustomer = db.updateQueueCustomer(id, updateData)

    res.json({
      success: true,
      message: "Customer updated successfully",
      data: { customer: updatedCustomer },
    })
  } catch (error) {
    console.error("Update customer error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to update customer",
      error: error.message,
    })
  }
})

// Call next customer
router.post("/:id/call", authenticateToken, authorizeRoles("admin", "business", "staff"), (req, res) => {
  try {
    const { id } = req.params

    const customer = db.findQueueCustomerById(id)
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found in queue",
      })
    }

    // Check if user has access to this business
    if (req.user.role !== "admin" && req.user.businessId !== customer.businessId) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this customer",
      })
    }

    const updatedCustomer = db.updateQueueCustomer(id, {
      status: "called",
      calledAt: new Date().toISOString(),
      calledBy: req.user.id,
    })

    res.json({
      success: true,
      message: "Customer called successfully",
      data: { customer: updatedCustomer },
    })
  } catch (error) {
    console.error("Call customer error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to call customer",
      error: error.message,
    })
  }
})

// Complete customer service
router.post("/:id/complete", authenticateToken, authorizeRoles("admin", "business", "staff"), (req, res) => {
  try {
    const { id } = req.params

    const customer = db.findQueueCustomerById(id)
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found in queue",
      })
    }

    // Check if user has access to this business
    if (req.user.role !== "admin" && req.user.businessId !== customer.businessId) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this customer",
      })
    }

    const updatedCustomer = db.updateQueueCustomer(id, {
      status: "completed",
      completedAt: new Date().toISOString(),
      completedBy: req.user.id,
    })

    res.json({
      success: true,
      message: "Customer service completed",
      data: { customer: updatedCustomer },
    })
  } catch (error) {
    console.error("Complete customer error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to complete customer service",
      error: error.message,
    })
  }
})

// Extend customer wait time
router.post("/:id/extend", authenticateToken, authorizeRoles("admin", "business", "staff"), (req, res) => {
  try {
    const { id } = req.params
    const { minutes } = req.body

    if (!minutes || minutes < 1 || minutes > 120) {
      return res.status(400).json({
        success: false,
        message: "Minutes must be between 1 and 120",
      })
    }

    const customer = db.findQueueCustomerById(id)
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found in queue",
      })
    }

    // Check if user has access to this business
    if (req.user.role !== "admin" && req.user.businessId !== customer.businessId) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this customer",
      })
    }

    const updatedCustomer = db.updateQueueCustomer(id, {
      estimatedWaitTime: (customer.estimatedWaitTime || 0) + minutes,
      extendedAt: new Date().toISOString(),
      extendedBy: minutes,
      extendedByUser: req.user.id,
    })

    res.json({
      success: true,
      message: `Customer wait time extended by ${minutes} minutes`,
      data: { customer: updatedCustomer },
    })
  } catch (error) {
    console.error("Extend customer time error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to extend customer wait time",
      error: error.message,
    })
  }
})

// Update payment status
router.post("/:id/payment", authenticateToken, authorizeRoles("admin", "business", "staff"), (req, res) => {
  try {
    const { id } = req.params
    const { paymentStatus, notes } = req.body

    if (!["pending", "paid", "cancelled"].includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment status. Must be: pending, paid, or cancelled",
      })
    }

    const customer = db.findQueueCustomerById(id)
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found in queue",
      })
    }

    // Check if user has access to this business
    if (req.user.role !== "admin" && req.user.businessId !== customer.businessId) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this customer",
      })
    }

    const updatedCustomer = db.updateQueueCustomer(id, {
      paymentStatus,
      paymentUpdatedAt: new Date().toISOString(),
      paymentUpdatedBy: req.user.id,
      paymentNotes: notes || "",
    })

    res.json({
      success: true,
      message: "Payment status updated successfully",
      data: { customer: updatedCustomer },
    })
  } catch (error) {
    console.error("Update payment status error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to update payment status",
      error: error.message,
    })
  }
})

// Remove customer from queue
router.delete("/:id", authenticateToken, authorizeRoles("admin", "business", "staff"), (req, res) => {
  try {
    const { id } = req.params

    const customer = db.findQueueCustomerById(id)
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found in queue",
      })
    }

    // Check if user has access to this business
    if (req.user.role !== "admin" && req.user.businessId !== customer.businessId) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this customer",
      })
    }

    const removedCustomer = db.removeFromQueue(id)

    res.json({
      success: true,
      message: "Customer removed from queue",
      data: { customer: removedCustomer },
    })
  } catch (error) {
    console.error("Remove customer error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to remove customer from queue",
      error: error.message,
    })
  }
})

// Get queue statistics for a business
router.get("/business/:businessId/stats", authenticateToken, (req, res) => {
  try {
    const { businessId } = req.params

    // Check if user has access to this business
    if (req.user.role !== "admin" && req.user.businessId !== businessId) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this business",
      })
    }

    const queue = db.getQueueByBusinessId(businessId)

    const stats = {
      total: queue.length,
      waiting: queue.filter((c) => c.status === "waiting").length,
      called: queue.filter((c) => c.status === "called").length,
      completed: queue.filter((c) => c.status === "completed").length,
      priority: queue.filter((c) => c.isPriority).length,
      averageWaitTime:
        queue.length > 0 ? queue.reduce((sum, c) => sum + (c.estimatedWaitTime || 0), 0) / queue.length : 0,
      totalRevenue: queue.filter((c) => c.paymentStatus === "paid").reduce((sum, c) => sum + (c.orderTotal || 0), 0),
    }

    res.json({
      success: true,
      data: { stats },
    })
  } catch (error) {
    console.error("Get queue stats error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch queue statistics",
      error: error.message,
    })
  }
})

module.exports = router
