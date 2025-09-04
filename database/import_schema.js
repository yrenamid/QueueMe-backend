const fs = require('fs').promises
const path = require('path')
const mysql = require('mysql2/promise')
require('dotenv').config()

// Helper to read/trim env vars
const readEnv = (k, fallback) => {
  const v = process.env[k]
  if (typeof v === 'string') {
    const t = v.trim()
    return t === '' ? fallback : t
  }
  return typeof fallback !== 'undefined' ? fallback : undefined
}

async function getConnectionConfig() {
  // Support DATABASE_URL or individual envs
  const databaseUrl = readEnv('DATABASE_URL', '')
  if (databaseUrl) {
    try {
      const parsed = new URL(databaseUrl)
      return {
        host: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : 3306,
        user: decodeURIComponent(parsed.username || ''),
        password: decodeURIComponent(parsed.password || ''),
        database: parsed.pathname ? parsed.pathname.replace(/^\//, '') : undefined,
        multipleStatements: true,
      }
    } catch (e) {
      console.warn('Failed to parse DATABASE_URL, falling back to DB_* envs')
    }
  }

  return {
    host: readEnv('DB_HOST', 'localhost'),
    port: Number(readEnv('DB_PORT', 3306)) || 3306,
    user: readEnv('DB_USER', 'root'),
    password: readEnv('DB_PASSWORD', ''),
    database: readEnv('DB_NAME', ''),
    multipleStatements: true,
  }
}

async function importSchema() {
  try {
    const cfg = await getConnectionConfig()
    console.log('Connecting to DB:', { host: cfg.host, port: cfg.port, database: cfg.database, user: cfg.user })
    const conn = await mysql.createConnection(cfg)

    const schemaPath = path.join(__dirname, 'schema.sql')
    const sql = await fs.readFile(schemaPath, 'utf8')
    // Split on semicolons (simple) and execute statements one by one
    const statements = sql.split(';').map(s => s.trim()).filter(Boolean)
    for (const stmt of statements) {
      console.log('Executing statement...')
      await conn.query(stmt)
    }

    console.log('✅ Schema import finished')
    await conn.end()
  } catch (err) {
    console.error('❌ Schema import failed:', err && err.message ? err.message : err)
    process.exitCode = 1
  }
}

if (require.main === module) {
  importSchema()
}

module.exports = { importSchema }
