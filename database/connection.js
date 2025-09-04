const mysql = require("mysql2/promise")
require("dotenv").config()

// Helper to safely read and trim environment variables
const readEnv = (key, fallback) => {
  const raw = process.env[key]
  if (typeof raw === "string") {
    const t = raw.trim()
    return t === "" ? fallback : t
  }
  return typeof fallback !== "undefined" ? fallback : undefined
}

// Database connection configuration (trim inputs to avoid accidental spaces)
// Support a single DATABASE_URL env like: mysql://user:pass@host:3306/dbname
let dbHost = readEnv("DB_HOST", "localhost")
let dbPort = Number(readEnv("DB_PORT", 3306)) || 3306
let dbUser = readEnv("DB_USER", "queueme_user")
let dbPassword = readEnv("DB_PASSWORD", "queueme_password")
let dbName = readEnv("DB_NAME", "queueme_db")

const databaseUrl = readEnv('DATABASE_URL', '')
if (databaseUrl) {
  try {
    // Ensure URL has a protocol (mysql://)
    const parsed = new URL(databaseUrl)
    if (parsed.hostname) dbHost = parsed.hostname
    if (parsed.port) dbPort = Number(parsed.port)
    if (parsed.username) dbUser = decodeURIComponent(parsed.username)
    if (parsed.password) dbPassword = decodeURIComponent(parsed.password)
    if (parsed.pathname) dbName = parsed.pathname.replace(/^\//, '')
  } catch (e) {
    console.warn('⚠️ Failed to parse DATABASE_URL, falling back to individual DB_* envs:', e.message)
  }
}

const dbConfig = {
  host: dbHost,
  port: dbPort,
  user: dbUser,
  password: dbPassword,
  database: dbName,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: "utf8mb4",
}

// Mask password for logging
const mask = (s) => (typeof s === "string" && s.length > 0 ? `${s[0]}***${s.slice(-1)}` : s)

console.log("🔎 Database configuration:", {
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  database: dbConfig.database,
  password: mask(dbConfig.password),
})

// Create connection pool
const pool = mysql.createPool(dbConfig)

// Test database connection
async function testConnection() {
  try {
    const connection = await pool.getConnection()
    console.log("✅ Database connected successfully")
    console.log(`📊 Connected to: ${dbConfig.database} on ${dbConfig.host}:${dbConfig.port}`)
    connection.release()
    return true
  } catch (error) {
    console.error("❌ Database connection failed:", error && error.message ? error.message : error)
    console.error(`🔧 Attempted to connect to ${dbConfig.host}:${dbConfig.port} — please check your DB_HOST/DB_PORT and that the database is reachable from this server`)
    return false
  }
}

// Execute query with error handling
async function executeQuery(query, params = []) {
  try {
    const [results] = await pool.execute(query, params)
    return results
  } catch (error) {
    console.error("❌ Query execution failed:", error.message)
    console.error("📝 Query:", query)
    console.error("📋 Params:", params)
    throw error
  }
}

// Get a single connection for transactions
async function getConnection() {
  try {
    return await pool.getConnection()
  } catch (error) {
    console.error("❌ Failed to get database connection:", error.message)
    throw error
  }
}

// Close all connections
async function closePool() {
  try {
    await pool.end()
    console.log("🔌 Database connection pool closed")
  } catch (error) {
    console.error("❌ Error closing database pool:", error.message)
  }
}

// Initialize connection test
testConnection()

// Database helper functions
const db = {
  // Generic query function
  query: async (sql, params = []) => {
    const start = Date.now()
    try {
      const results = await executeQuery(sql, params)
      const duration = Date.now() - start
      console.log("📊 Query executed:", {
        sql: sql.substring(0, 50) + "...",
        duration,
        rows: Array.isArray(results) ? results.length : 1,
      })
      return results
    } catch (error) {
      console.error("❌ Database query error:", error)
      throw error
    }
  },

  // Transaction helper
  transaction: async (callback) => {
    const connection = await getConnection()
    try {
      await connection.beginTransaction()
      const result = await callback(connection)
      await connection.commit()
      return result
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  },

  // User queries
  users: {
    findByEmail: async (email) => {
      const results = await db.query("SELECT * FROM users WHERE email = ?", [email])
      return results[0]
    },

    findById: async (id) => {
      const results = await db.query("SELECT * FROM users WHERE id = ?", [id])
      return results[0]
    },

    create: async (userData) => {
      const { email, password, role, business_id, business_name } = userData
      await db.query("INSERT INTO users (email, password, role, business_id, business_name) VALUES (?, ?, ?, ?, ?)", [
        email,
        password,
        role,
        business_id,
        business_name,
      ])

      // Get the created user
      const results = await db.query("SELECT * FROM users WHERE email = ?", [email])
      return results[0]
    },

    update: async (id, updateData) => {
      const fields = Object.keys(updateData)
      const values = Object.values(updateData)
      const setClause = fields.map((field) => `${field} = ?`).join(", ")

      await db.query(`UPDATE users SET ${setClause} WHERE id = ?`, [...values, id])

      // Return updated user
      const results = await db.query("SELECT * FROM users WHERE id = ?", [id])
      return results[0]
    },

    delete: async (id) => {
      const results = await db.query("SELECT * FROM users WHERE id = ?", [id])
      const user = results[0]

      await db.query("DELETE FROM users WHERE id = ?", [id])
      return user
    },
  },

  // Business queries
  businesses: {
    findAll: async () => {
      const results = await db.query("SELECT * FROM businesses ORDER BY created_at DESC")
      return results
    },

    findById: async (id) => {
      const results = await db.query("SELECT * FROM businesses WHERE id = ?", [id])
      return results[0]
    },

    create: async (businessData) => {
      const { name, email, phone, address, type, settings } = businessData
      await db.query("INSERT INTO businesses (name, email, phone, address, type, settings) VALUES (?, ?, ?, ?, ?, ?)", [
        name,
        email,
        phone,
        address,
        type,
        JSON.stringify(settings),
      ])

      // Get the created business
      const results = await db.query("SELECT * FROM businesses WHERE email = ?", [email])
      return results[0]
    },

    update: async (id, updateData) => {
      const fields = Object.keys(updateData)
      const values = Object.values(updateData).map((value) =>
        typeof value === "object" ? JSON.stringify(value) : value,
      )
      const setClause = fields.map((field) => `${field} = ?`).join(", ")

      await db.query(`UPDATE businesses SET ${setClause} WHERE id = ?`, [...values, id])

      // Return updated business
      const results = await db.query("SELECT * FROM businesses WHERE id = ?", [id])
      return results[0]
    },

    delete: async (id) => {
      const results = await db.query("SELECT * FROM businesses WHERE id = ?", [id])
      const business = results[0]

      await db.query("DELETE FROM businesses WHERE id = ?", [id])
      return business
    },
  },

  // Queue queries
  queue: {
    findByBusinessId: async (businessId) => {
      const results = await db.query("SELECT * FROM queue_customers WHERE business_id = ? ORDER BY queue_number ASC", [
        businessId,
      ])
      return results
    },

    findById: async (id) => {
      const results = await db.query("SELECT * FROM queue_customers WHERE id = ?", [id])
      return results[0]
    },

    create: async (customerData) => {
      const {
        business_id,
        customer_name,
        customer_phone,
        customer_email,
        order_items,
        order_total,
        is_priority,
        estimated_wait_time,
      } = customerData

      // Get next queue number
      const queueNumberResult = await db.query(
        "SELECT COALESCE(MAX(queue_number), 0) + 1 as next_number FROM queue_customers WHERE business_id = ?",
        [business_id],
      )
      const queue_number = queueNumberResult[0].next_number

      await db.query(
        `INSERT INTO queue_customers 
         (business_id, queue_number, customer_name, customer_phone, customer_email, 
          order_items, order_total, is_priority, estimated_wait_time) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          business_id,
          queue_number,
          customer_name,
          customer_phone,
          customer_email,
          JSON.stringify(order_items),
          order_total,
          is_priority,
          estimated_wait_time,
        ],
      )

      // Get the created customer
      const results = await db.query("SELECT * FROM queue_customers WHERE business_id = ? AND queue_number = ?", [
        business_id,
        queue_number,
      ])
      return results[0]
    },

    update: async (id, updateData) => {
      const fields = Object.keys(updateData)
      const values = Object.values(updateData).map((value) =>
        typeof value === "object" && value !== null ? JSON.stringify(value) : value,
      )
      const setClause = fields.map((field) => `${field} = ?`).join(", ")

      await db.query(`UPDATE queue_customers SET ${setClause} WHERE id = ?`, [...values, id])

      // Return updated customer
      const results = await db.query("SELECT * FROM queue_customers WHERE id = ?", [id])
      return results[0]
    },

    delete: async (id) => {
      const results = await db.query("SELECT * FROM queue_customers WHERE id = ?", [id])
      const customer = results[0]

      await db.query("DELETE FROM queue_customers WHERE id = ?", [id])
      return customer
    },
  },

  // Menu queries
  menu: {
    findByBusinessId: async (businessId) => {
      const results = await db.query("SELECT * FROM menu_items WHERE business_id = ? ORDER BY category, name", [
        businessId,
      ])
      return results
    },

    findById: async (id) => {
      const results = await db.query("SELECT * FROM menu_items WHERE id = ?", [id])
      return results[0]
    },

    create: async (itemData) => {
      const { business_id, name, description, price, category, image, available } = itemData
      await db.query(
        "INSERT INTO menu_items (business_id, name, description, price, category, image, available) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [business_id, name, description, price, category, image, available],
      )

      // Get the created item
      const results = await db.query(
        "SELECT * FROM menu_items WHERE business_id = ? AND name = ? ORDER BY created_at DESC LIMIT 1",
        [business_id, name],
      )
      return results[0]
    },

    update: async (id, updateData) => {
      const fields = Object.keys(updateData)
      const values = Object.values(updateData)
      const setClause = fields.map((field) => `${field} = ?`).join(", ")

      await db.query(`UPDATE menu_items SET ${setClause} WHERE id = ?`, [...values, id])

      // Return updated item
      const results = await db.query("SELECT * FROM menu_items WHERE id = ?", [id])
      return results[0]
    },

    delete: async (id) => {
      const results = await db.query("SELECT * FROM menu_items WHERE id = ?", [id])
      const item = results[0]

      await db.query("DELETE FROM menu_items WHERE id = ?", [id])
      return item
    },
  },

  // Staff queries
  staff: {
    findByBusinessId: async (businessId) => {
      const results = await db.query("SELECT * FROM staff_members WHERE business_id = ? ORDER BY name", [businessId])
      return results
    },

    findById: async (id) => {
      const results = await db.query("SELECT * FROM staff_members WHERE id = ?", [id])
      return results[0]
    },

    create: async (staffData) => {
      const { business_id, name, email, role, status } = staffData
      await db.query("INSERT INTO staff_members (business_id, name, email, role, status) VALUES (?, ?, ?, ?, ?)", [
        business_id,
        name,
        email,
        role,
        status || "active",
      ])

      // Get the created staff member
      const results = await db.query("SELECT * FROM staff_members WHERE email = ?", [email])
      return results[0]
    },

    update: async (id, updateData) => {
      const fields = Object.keys(updateData)
      const values = Object.values(updateData)
      const setClause = fields.map((field) => `${field} = ?`).join(", ")

      await db.query(`UPDATE staff_members SET ${setClause} WHERE id = ?`, [...values, id])

      // Return updated staff member
      const results = await db.query("SELECT * FROM staff_members WHERE id = ?", [id])
      return results[0]
    },

    delete: async (id) => {
      const results = await db.query("SELECT * FROM staff_members WHERE id = ?", [id])
      const staff = results[0]

      await db.query("DELETE FROM staff_members WHERE id = ?", [id])
      return staff
    },
  },
}

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("🔄 Shutting down database connection...")
  await closePool()
  console.log("✅ Database connection closed")
  process.exit(0)
})

module.exports = db
