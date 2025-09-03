const express = require("express")
const db = require("../config/database")
const { authenticateToken, authorizeRoles } = require("../middleware/auth")

const router = express.Router()

// Get menu for a business (public endpoint)
router.get("/business/:businessId", (req, res) => {
  try {
    const { businessId } = req.params
    const { category, available } = req.query

    let menu = db.getMenuByBusinessId(businessId)

    // Filter by category if provided
    if (category) {
      menu = menu.filter((item) => item.category.toLowerCase() === category.toLowerCase())
    }

    // Filter by availability if provided
    if (available !== undefined) {
      const isAvailable = available === "true"
      menu = menu.filter((item) => item.available === isAvailable)
    }

    // Sort by category, then by name
    menu.sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category)
      }
      return a.name.localeCompare(b.name)
    })

    res.json({
      success: true,
      data: { menu },
    })
  } catch (error) {
    console.error("Get menu error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch menu",
      error: error.message,
    })
  }
})

// Get specific menu item
router.get("/:id", (req, res) => {
  try {
    const { id } = req.params
    const menuItem = db.findMenuItemById(id)

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: "Menu item not found",
      })
    }

    res.json({
      success: true,
      data: { menuItem },
    })
  } catch (error) {
    console.error("Get menu item error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch menu item",
      error: error.message,
    })
  }
})

// Add menu item
router.post("/", authenticateToken, authorizeRoles("admin", "business"), (req, res) => {
  try {
    const { businessId, name, description, price, category, image } = req.body

    // Validate required fields
    if (!businessId || !name || !price) {
      return res.status(400).json({
        success: false,
        message: "Business ID, name, and price are required",
      })
    }

    // Check if user has access to this business
    if (req.user.role !== "admin" && req.user.businessId !== businessId) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this business",
      })
    }

    // Validate price
    const parsedPrice = Number.parseFloat(price)
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({
        success: false,
        message: "Price must be a valid positive number",
      })
    }

    const menuItem = db.addMenuItem({
      businessId,
      name: name.trim(),
      description: (description || "").trim(),
      price: parsedPrice,
      category: (category || "General").trim(),
      image: image || "/placeholder.svg?height=200&width=200",
      available: true,
    })

    res.status(201).json({
      success: true,
      message: "Menu item added successfully",
      data: { menuItem },
    })
  } catch (error) {
    console.error("Add menu item error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to add menu item",
      error: error.message,
    })
  }
})

// Update menu item
router.put("/:id", authenticateToken, authorizeRoles("admin", "business"), (req, res) => {
  try {
    const { id } = req.params
    const updateData = req.body

    const menuItem = db.findMenuItemById(id)
    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: "Menu item not found",
      })
    }

    // Check if user has access to this business
    if (req.user.role !== "admin" && req.user.businessId !== menuItem.businessId) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this menu item",
      })
    }

    // Validate and parse price if provided
    if (updateData.price !== undefined) {
      const parsedPrice = Number.parseFloat(updateData.price)
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({
          success: false,
          message: "Price must be a valid positive number",
        })
      }
      updateData.price = parsedPrice
    }

    // Trim string fields
    if (updateData.name) updateData.name = updateData.name.trim()
    if (updateData.description) updateData.description = updateData.description.trim()
    if (updateData.category) updateData.category = updateData.category.trim()

    const updatedMenuItem = db.updateMenuItem(id, updateData)

    res.json({
      success: true,
      message: "Menu item updated successfully",
      data: { menuItem: updatedMenuItem },
    })
  } catch (error) {
    console.error("Update menu item error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to update menu item",
      error: error.message,
    })
  }
})

// Toggle menu item availability
router.patch("/:id/availability", authenticateToken, authorizeRoles("admin", "business", "staff"), (req, res) => {
  try {
    const { id } = req.params
    const { available } = req.body

    const menuItem = db.findMenuItemById(id)
    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: "Menu item not found",
      })
    }

    // Check if user has access to this business
    if (req.user.role !== "admin" && req.user.businessId !== menuItem.businessId) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this menu item",
      })
    }

    const updatedMenuItem = db.updateMenuItem(id, {
      available: available !== undefined ? available : !menuItem.available,
      availabilityUpdatedAt: new Date().toISOString(),
      availabilityUpdatedBy: req.user.id,
    })

    res.json({
      success: true,
      message: `Menu item ${updatedMenuItem.available ? "enabled" : "disabled"} successfully`,
      data: { menuItem: updatedMenuItem },
    })
  } catch (error) {
    console.error("Toggle menu item availability error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to toggle menu item availability",
      error: error.message,
    })
  }
})

// Delete menu item
router.delete("/:id", authenticateToken, authorizeRoles("admin", "business"), (req, res) => {
  try {
    const { id } = req.params

    const menuItem = db.findMenuItemById(id)
    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: "Menu item not found",
      })
    }

    // Check if user has access to this business
    if (req.user.role !== "admin" && req.user.businessId !== menuItem.businessId) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this menu item",
      })
    }

    const deletedMenuItem = db.deleteMenuItem(id)

    res.json({
      success: true,
      message: "Menu item deleted successfully",
      data: { menuItem: deletedMenuItem },
    })
  } catch (error) {
    console.error("Delete menu item error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to delete menu item",
      error: error.message,
    })
  }
})

// Get menu categories for a business
router.get("/business/:businessId/categories", (req, res) => {
  try {
    const { businessId } = req.params
    const menu = db.getMenuByBusinessId(businessId)

    const categories = [...new Set(menu.map((item) => item.category))].sort()

    res.json({
      success: true,
      data: { categories },
    })
  } catch (error) {
    console.error("Get menu categories error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch menu categories",
      error: error.message,
    })
  }
})

// Bulk update menu items
router.patch("/bulk", authenticateToken, authorizeRoles("admin", "business"), (req, res) => {
  try {
    const { businessId, updates } = req.body

    if (!businessId || !updates || !Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        message: "Business ID and updates array are required",
      })
    }

    // Check if user has access to this business
    if (req.user.role !== "admin" && req.user.businessId !== businessId) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this business",
      })
    }

    const updatedItems = []
    const errors = []

    for (const update of updates) {
      try {
        const { id, ...updateData } = update

        if (!id) {
          errors.push({ error: "Menu item ID is required", update })
          continue
        }

        const menuItem = db.findMenuItemById(id)
        if (!menuItem) {
          errors.push({ error: "Menu item not found", id })
          continue
        }

        if (menuItem.businessId !== businessId) {
          errors.push({ error: "Menu item does not belong to this business", id })
          continue
        }

        // Validate price if provided
        if (updateData.price !== undefined) {
          const parsedPrice = Number.parseFloat(updateData.price)
          if (isNaN(parsedPrice) || parsedPrice < 0) {
            errors.push({ error: "Invalid price", id })
            continue
          }
          updateData.price = parsedPrice
        }

        const updatedItem = db.updateMenuItem(id, updateData)
        updatedItems.push(updatedItem)
      } catch (error) {
        errors.push({ error: error.message, update })
      }
    }

    res.json({
      success: true,
      message: `Updated ${updatedItems.length} menu items`,
      data: {
        updatedItems,
        errors: errors.length > 0 ? errors : undefined,
      },
    })
  } catch (error) {
    console.error("Bulk update menu items error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to bulk update menu items",
      error: error.message,
    })
  }
})

module.exports = router
