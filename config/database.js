const { v4: uuidv4 } = require("uuid")

// In-memory database simulation
const db = {
  users: [],
  businesses: [],
  queue: [],
  menu: [],
  staff: [],
}

// Sample data initialization
function initializeData() {
  // Create sample business
  const sampleBusiness = {
    id: "business-1",
    name: "Sample Restaurant",
    email: "restaurant@example.com",
    phone: "+1234567890",
    address: "123 Main St, City, State",
    type: "restaurant",
    settings: {
      queueLength: 50,
      prioritySlots: 10,
      priorityExtensionTime: 15,
      operatingHours: {
        monday: { open: "09:00", close: "18:00", closed: false },
        tuesday: { open: "09:00", close: "18:00", closed: false },
        wednesday: { open: "09:00", close: "18:00", closed: false },
        thursday: { open: "09:00", close: "18:00", closed: false },
        friday: { open: "09:00", close: "18:00", closed: false },
        saturday: { open: "10:00", close: "16:00", closed: false },
        sunday: { open: "10:00", close: "16:00", closed: true },
      },
    },
    createdAt: new Date().toISOString(),
  }

  db.businesses.push(sampleBusiness)

  // Create sample admin user
  const adminUser = {
    id: "user-admin",
    email: "admin@queueme.com",
    password: "$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi", // password
    role: "admin",
    businessId: null,
    businessName: null,
    createdAt: new Date().toISOString(),
  }

  // Create sample business owner
  const businessUser = {
    id: "user-business",
    email: "owner@restaurant.com",
    password: "$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi", // password
    role: "business",
    businessId: "business-1",
    businessName: "Sample Restaurant",
    createdAt: new Date().toISOString(),
  }

  // Create sample staff user
  const staffUser = {
    id: "user-staff",
    email: "staff@restaurant.com",
    password: "$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi", // password
    role: "staff",
    businessId: "business-1",
    businessName: "Sample Restaurant",
    createdAt: new Date().toISOString(),
  }

  db.users.push(adminUser, businessUser, staffUser)

  // Create sample menu items
  const menuItems = [
    {
      id: "menu-1",
      businessId: "business-1",
      name: "Burger Deluxe",
      description: "Juicy beef burger with cheese, lettuce, and tomato",
      price: 12.99,
      category: "Main Course",
      image: "/placeholder.svg?height=200&width=200",
      available: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: "menu-2",
      businessId: "business-1",
      name: "Caesar Salad",
      description: "Fresh romaine lettuce with caesar dressing and croutons",
      price: 8.99,
      category: "Salads",
      image: "/placeholder.svg?height=200&width=200",
      available: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: "menu-3",
      businessId: "business-1",
      name: "Chocolate Cake",
      description: "Rich chocolate cake with vanilla ice cream",
      price: 6.99,
      category: "Desserts",
      image: "/placeholder.svg?height=200&width=200",
      available: false,
      createdAt: new Date().toISOString(),
    },
  ]

  db.menu.push(...menuItems)

  // Create sample staff members
  const staffMembers = [
    {
      id: "staff-1",
      businessId: "business-1",
      name: "John Manager",
      email: "john@restaurant.com",
      role: "manager",
      status: "active",
      lastActive: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    },
    {
      id: "staff-2",
      businessId: "business-1",
      name: "Jane Cashier",
      email: "jane@restaurant.com",
      role: "cashier",
      status: "active",
      lastActive: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    },
  ]

  db.staff.push(...staffMembers)

  // Create sample queue customers
  const queueCustomers = [
    {
      id: "customer-1",
      businessId: "business-1",
      customerName: "Alice Johnson",
      customerPhone: "+1234567890",
      customerEmail: "alice@example.com",
      orderItems: [
        { id: "menu-1", name: "Burger Deluxe", price: 12.99, quantity: 1 },
        { id: "menu-2", name: "Caesar Salad", price: 8.99, quantity: 1 },
      ],
      orderTotal: 21.98,
      isPriority: false,
      status: "waiting",
      paymentStatus: "pending",
      estimatedWaitTime: 15,
      joinedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
    },
    {
      id: "customer-2",
      businessId: "business-1",
      customerName: "Bob Smith",
      customerPhone: "+1987654321",
      customerEmail: "bob@example.com",
      orderItems: [{ id: "menu-1", name: "Burger Deluxe", price: 12.99, quantity: 2 }],
      orderTotal: 25.98,
      isPriority: true,
      status: "called",
      paymentStatus: "paid",
      estimatedWaitTime: 5,
      joinedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
      calledAt: new Date().toISOString(),
      calledBy: "user-staff",
    },
  ]

  db.queue.push(...queueCustomers)
}

// Database helper functions
const dbHelpers = {
  // User functions
  findUserByEmail: (email) => {
    if (!email) return undefined;
    const target = email.trim().toLowerCase();
    return db.users.find((user) => (user.email || "").toLowerCase() === target);
  },
  findUserById: (id) => db.users.find((user) => user.id === id),
  createUser: (userData) => {
    const newUser = {
      id: uuidv4(),
      ...userData,
      createdAt: new Date().toISOString(),
    }
    db.users.push(newUser)
    return newUser
  },
  updateUser: (id, updateData) => {
    const userIndex = db.users.findIndex((user) => user.id === id)
    if (userIndex !== -1) {
      db.users[userIndex] = { ...db.users[userIndex], ...updateData }
      return db.users[userIndex]
    }
    return null
  },

  // Business functions
  getAllBusinesses: () => db.businesses,
  findBusinessById: (id) => db.businesses.find((business) => business.id === id),
  createBusiness: (businessData) => {
    const newBusiness = {
      id: uuidv4(),
      ...businessData,
      createdAt: new Date().toISOString(),
    }
    db.businesses.push(newBusiness)
    return newBusiness
  },
  updateBusiness: (id, updateData) => {
    const businessIndex = db.businesses.findIndex((business) => business.id === id)
    if (businessIndex !== -1) {
      db.businesses[businessIndex] = { ...db.businesses[businessIndex], ...updateData }
      return db.businesses[businessIndex]
    }
    return null
  },
  deleteBusiness: (id) => {
    const businessIndex = db.businesses.findIndex((business) => business.id === id)
    if (businessIndex !== -1) {
      return db.businesses.splice(businessIndex, 1)[0]
    }
    return null
  },

  // Queue functions
  getQueueByBusinessId: (businessId) => db.queue.filter((customer) => customer.businessId === businessId),
  findQueueCustomerById: (id) => db.queue.find((customer) => customer.id === id),
  addToQueue: (customerData) => {
    const newCustomer = {
      id: uuidv4(),
      ...customerData,
      status: "waiting",
      joinedAt: new Date().toISOString(),
    }
    db.queue.push(newCustomer)
    return newCustomer
  },
  updateQueueCustomer: (id, updateData) => {
    const customerIndex = db.queue.findIndex((customer) => customer.id === id)
    if (customerIndex !== -1) {
      db.queue[customerIndex] = { ...db.queue[customerIndex], ...updateData }
      return db.queue[customerIndex]
    }
    return null
  },
  removeFromQueue: (id) => {
    const customerIndex = db.queue.findIndex((customer) => customer.id === id)
    if (customerIndex !== -1) {
      return db.queue.splice(customerIndex, 1)[0]
    }
    return null
  },

  // Menu functions
  getMenuByBusinessId: (businessId) => db.menu.filter((item) => item.businessId === businessId),
  findMenuItemById: (id) => db.menu.find((item) => item.id === id),
  addMenuItem: (itemData) => {
    const newItem = {
      id: uuidv4(),
      ...itemData,
      createdAt: new Date().toISOString(),
    }
    db.menu.push(newItem)
    return newItem
  },
  updateMenuItem: (id, updateData) => {
    const itemIndex = db.menu.findIndex((item) => item.id === id)
    if (itemIndex !== -1) {
      db.menu[itemIndex] = { ...db.menu[itemIndex], ...updateData }
      return db.menu[itemIndex]
    }
    return null
  },
  deleteMenuItem: (id) => {
    const itemIndex = db.menu.findIndex((item) => item.id === id)
    if (itemIndex !== -1) {
      return db.menu.splice(itemIndex, 1)[0]
    }
    return null
  },

  // Staff functions
  getStaffByBusinessId: (businessId) => db.staff.filter((member) => member.businessId === businessId),
  findStaffById: (id) => db.staff.find((member) => member.id === id),
  createStaff: (staffData) => {
    const newStaff = {
      id: uuidv4(),
      ...staffData,
      createdAt: new Date().toISOString(),
    }
    db.staff.push(newStaff)
    return newStaff
  },
  updateStaff: (id, updateData) => {
    const staffIndex = db.staff.findIndex((member) => member.id === id)
    if (staffIndex !== -1) {
      db.staff[staffIndex] = { ...db.staff[staffIndex], ...updateData }
      return db.staff[staffIndex]
    }
    return null
  },
  deleteStaff: (id) => {
    const staffIndex = db.staff.findIndex((member) => member.id === id)
    if (staffIndex !== -1) {
      return db.staff.splice(staffIndex, 1)[0]
    }
    return null
  },
}

// Initialize sample data
initializeData()

module.exports = dbHelpers
