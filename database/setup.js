const mysql = require("mysql2/promise")
const fs = require("fs").promises
const path = require("path")
require("dotenv").config()

// Root database configuration (for creating database and user)
const rootConfig = {
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_ROOT_USER || "root",
  password: process.env.DB_ROOT_PASSWORD || "",
  multipleStatements: true,
}

// Database configuration
const dbName = process.env.DB_NAME || "queueme_db"
const dbUser = process.env.DB_USER || "queueme_user"
const dbPassword = process.env.DB_PASSWORD || "queueme_password"

async function setupDatabase() {
  let connection

  try {
    console.log("🚀 Starting QueueMe Database Setup...")
    console.log("=".repeat(50))

    // Connect as root user
    console.log("🔌 Connecting to MySQL as root...")
    connection = await mysql.createConnection(rootConfig)
    console.log("✅ Connected to MySQL successfully")

    // Create database
    console.log(`📊 Creating database: ${dbName}`)
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    )
    console.log("✅ Database created successfully")

    // Create user and grant privileges
    console.log(`👤 Creating user: ${dbUser}`)
  await connection.query(`CREATE USER IF NOT EXISTS '${dbUser}'@'localhost' IDENTIFIED BY '${dbPassword}'`)
  await connection.query(`CREATE USER IF NOT EXISTS '${dbUser}'@'%' IDENTIFIED BY '${dbPassword}'`)
    console.log("✅ User created successfully")

    console.log("🔐 Granting privileges...")
  await connection.query(`GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${dbUser}'@'localhost'`)
  await connection.query(`GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${dbUser}'@'%'`)
  await connection.query("FLUSH PRIVILEGES")
    console.log("✅ Privileges granted successfully")

  // Switch to the new database
  await connection.query(`USE \`${dbName}\``)

    // Read and execute schema file
    console.log("📋 Creating database schema...")
    const schemaPath = path.join(__dirname, "schema.sql")
    const schemaSQL = await fs.readFile(schemaPath, "utf8")

    // Split schema into individual statements and execute
    const statements = schemaSQL.split(";").filter((stmt) => stmt.trim().length > 0)
    for (const statement of statements) {
      if (statement.trim()) {
        await connection.query(statement)
      }
    }
    console.log("✅ Schema created successfully")

    // Read and execute seed file
    console.log("🌱 Inserting seed data...")
    const seedPath = path.join(__dirname, "seed.sql")
    const seedSQL = await fs.readFile(seedPath, "utf8")

    // Split seed data into individual statements and execute
    const seedStatements = seedSQL.split(";").filter((stmt) => stmt.trim().length > 0)
    for (const statement of seedStatements) {
      if (statement.trim()) {
        await connection.query(statement)
      }
    }
    console.log("✅ Seed data inserted successfully")

    // Verify setup
    console.log("🔍 Verifying database setup...")
  const [tables] = await connection.query("SHOW TABLES")
    console.log(`📊 Created ${tables.length} tables:`)
    tables.forEach((table) => {
      console.log(`   - ${Object.values(table)[0]}`)
    })

    // Show user counts
  const [userCount] = await connection.query("SELECT COUNT(*) as count FROM users")
  const [businessCount] = await connection.query("SELECT COUNT(*) as count FROM businesses")
  const [menuCount] = await connection.query("SELECT COUNT(*) as count FROM menu_items")
  const [queueCount] = await connection.query("SELECT COUNT(*) as count FROM queue_customers")

    console.log("\n📈 Data Summary:")
    console.log(`   - Users: ${userCount[0].count}`)
    console.log(`   - Businesses: ${businessCount[0].count}`)
    console.log(`   - Menu Items: ${menuCount[0].count}`)
    console.log(`   - Queue Customers: ${queueCount[0].count}`)

    console.log("\n🎉 Database setup completed successfully!")
    console.log("=".repeat(50))
    console.log("\n📝 Test Accounts:")
    console.log("   Admin: admin@queueme.com / password123")
    console.log("   Business Owner: owner@restaurant.com / password123")
    console.log("   Manager: manager@restaurant.com / password123")
    console.log("   Cashier: cashier@restaurant.com / password123")
    console.log("\n🚀 You can now start the API server with: npm run dev")
  } catch (error) {
    console.error("❌ Database setup failed:", error.message)
    console.error("\n🔧 Troubleshooting:")
    console.error("   1. Make sure MySQL is running")
    console.error("   2. Check your root credentials in .env file")
    console.error("   3. Ensure MySQL root user has CREATE privileges")
    console.error("   4. Verify MySQL is accessible on the specified host/port")
    process.exit(1)
  } finally {
    if (connection) {
      await connection.end()
      console.log("🔌 Database connection closed")
    }
  }
}

// Run setup if called directly
if (require.main === module) {
  setupDatabase()
}

module.exports = { setupDatabase }
