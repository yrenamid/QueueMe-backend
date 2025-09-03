# QueueMe Database Setup Guide

This guide will help you set up the MySQL database for the QueueMe project using dbForge Studio or MySQL Workbench.

## Prerequisites

1. **MySQL Server** (8.0 or higher recommended)
2. **dbForge Studio for MySQL** or **MySQL Workbench**
3. **Node.js** (16.0 or higher)

## Quick Setup

### Option 1: Automated Setup (Recommended)

1. **Clone the project and navigate to server directory:**
   \`\`\`bash
   cd server
   \`\`\`

2. **Install dependencies:**
   \`\`\`bash
   npm install
   \`\`\`

3. **Configure environment variables:**
   \`\`\`bash
   cp .env.example .env
   \`\`\`
   
   Edit `.env` file with your MySQL credentials:
   \`\`\`env
   DB_ROOT_USER=root
   DB_ROOT_PASSWORD=locatED418walnut1
   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=queueme_db
   DB_USER=queueme_user
   DB_PASSWORD=queueme_password
   \`\`\`

4. **Run the automated setup:**
   \`\`\`bash
   npm run setup-db
   \`\`\`

### Option 2: Manual Setup with dbForge Studio

1. **Open dbForge Studio for MySQL**

2. **Connect to your MySQL server** using root credentials

3. **Create the database:**
   \`\`\`sql
   CREATE DATABASE queueme_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   \`\`\`

4. **Create database user:**
   \`\`\`sql
   CREATE USER 'queueme_user'@'localhost' IDENTIFIED BY 'queueme_password';
   CREATE USER 'queueme_user'@'%' IDENTIFIED BY 'queueme_password';
   GRANT ALL PRIVILEGES ON queueme_db.* TO 'queueme_user'@'localhost';
   GRANT ALL PRIVILEGES ON queueme_db.* TO 'queueme_user'@'%';
   FLUSH PRIVILEGES;
   \`\`\`

5. **Switch to the new database:**
   \`\`\`sql
   USE queueme_db;
   \`\`\`

6. **Execute the schema file:**
   - Open `database/schema.sql` in dbForge Studio
   - Execute the entire script

7. **Execute the seed file:**
   - Open `database/seed.sql` in dbForge Studio
   - Execute the entire script

## Database Structure

### Tables Overview

| Table | Description |
|-------|-------------|
| `users` | System users (admin, business owners, staff) |
| `businesses` | Business information and settings |
| `staff_members` | Staff members for each business |
| `menu_items` | Menu items for each business |
| `queue_customers` | Current and historical queue entries |

### Key Features

- **UUID Primary Keys**: All tables use UUID for better security and scalability
- **Foreign Key Constraints**: Proper relationships between tables
- **JSON Fields**: Flexible storage for settings and order items
- **Indexes**: Optimized for common queries
- **Timestamps**: Automatic created_at and updated_at tracking

## Test Data

The seed file includes test accounts:

| Role | Email | Password | Description |
|------|-------|----------|-------------|
| Admin | admin@queueme.com | password123 | System administrator |
| Business | owner@restaurant.com | password123 | Restaurant owner |
| Staff | manager@restaurant.com | password123 | Restaurant manager |
| Staff | cashier@restaurant.com | password123 | Restaurant cashier |

## Environment Variables

Create a `.env` file in the server directory:

\`\`\`env
# Server Configuration
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=queueme_db
DB_USER=queueme_user
DB_PASSWORD=queueme_password

# Root Database User (for setup only)
DB_ROOT_USER=root
DB_ROOT_PASSWORD=your-mysql-root-password
\`\`\`

## Running the API Server

After database setup:

\`\`\`bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
\`\`\`

The server will start on `http://localhost:5000`

## Verification

Test the setup by visiting:
- Health check: `http://localhost:5000/health`
- API documentation: `http://localhost:5000/api`

## Troubleshooting

### Common Issues

1. **Connection refused:**
   - Ensure MySQL server is running
   - Check host and port in .env file
   - Verify firewall settings

2. **Access denied:**
   - Check username and password
   - Ensure user has proper privileges
   - Try connecting with MySQL client first

3. **Database doesn't exist:**
   - Run the setup script: `npm run setup-db`
   - Or manually create database in dbForge Studio

4. **Permission errors:**
   - Ensure MySQL user has CREATE, ALTER, INSERT, SELECT privileges
   - Check if running as proper user

### dbForge Studio Tips

1. **Connection Settings:**
   - Host: localhost (or your MySQL server IP)
   - Port: 3306 (default MySQL port)
   - User: root (for initial setup)

2. **Executing Scripts:**
   - Use F5 or Execute button to run SQL scripts
   - Execute schema.sql first, then seed.sql
   - Check Messages tab for any errors

3. **Viewing Data:**
   - Use Database Explorer to browse tables
   - Right-click tables to view data
   - Use Query tab for custom queries

## Backup and Restore

### Create Backup
\`\`\`bash
mysqldump -u queueme_user -p queueme_db > queueme_backup.sql
\`\`\`

### Restore Backup
\`\`\`bash
mysql -u queueme_user -p queueme_db < queueme_backup.sql
\`\`\`

## Production Considerations

1. **Security:**
   - Change default passwords
   - Use strong JWT secret
   - Enable SSL/TLS for database connections

2. **Performance:**
   - Add appropriate indexes for your queries
   - Configure MySQL for your server specs
   - Monitor query performance

3. **Backup:**
   - Set up automated backups
   - Test restore procedures
   - Store backups securely

For additional help, refer to the API documentation or contact the development team.
