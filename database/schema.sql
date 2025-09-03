-- QueueMe Database Schema for MySQL
-- Drop existing tables if they exist (in correct order due to foreign key constraints)
DROP TABLE IF EXISTS queue_customers;
DROP TABLE IF EXISTS menu_items;
DROP TABLE IF EXISTS staff_members;
DROP TABLE IF EXISTS businesses;
DROP TABLE IF EXISTS users;

-- Create users table
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'business', 'staff') NOT NULL DEFAULT 'business',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role (role)
);

-- Create businesses table
CREATE TABLE businesses (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    owner_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255),
    phone VARCHAR(20),
    address TEXT,
    type ENUM('restaurant', 'cafe', 'retail', 'service', 'other') DEFAULT 'restaurant',
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    -- Queue settings
    max_queue_length INT DEFAULT 50,
    reserve_slots INT DEFAULT 0,
    notify_customer BOOLEAN DEFAULT TRUE,
    auto_wait_times BOOLEAN DEFAULT TRUE,
    multi_step_queue BOOLEAN DEFAULT FALSE,
    settings JSON, -- keep JSON for future flexibility
    qr_code_url VARCHAR(500) NULL,
    qr_code_img LONGTEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_owner (owner_id),
    INDEX idx_status (status),
    INDEX idx_type (type)
);

-- Create staff_members table
CREATE TABLE staff_members (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    business_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    role ENUM('manager', 'cashier', 'server', 'kitchen', 'other') DEFAULT 'server',
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_business (business_id),
    INDEX idx_user (user_id),
    INDEX idx_status (status)
);

-- Create menu_items table
CREATE TABLE menu_items (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    business_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    category VARCHAR(100),
    image VARCHAR(500),
    available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    INDEX idx_business (business_id),
    INDEX idx_category (category),
    INDEX idx_available (available)
);

-- Create queue_customers table
CREATE TABLE queue_customers (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    business_id VARCHAR(36) NOT NULL,
    queue_number INT NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20),
    customer_email VARCHAR(255),
    order_items JSON,
    order_total DECIMAL(10, 2),
    status ENUM('waiting', 'called', 'served', 'cancelled', 'no_show') DEFAULT 'waiting',
    is_priority BOOLEAN DEFAULT FALSE,
    estimated_wait_time INT,
    actual_wait_time INT,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    called_at TIMESTAMP NULL,
    served_at TIMESTAMP NULL,
    called_by VARCHAR(36),
    served_by VARCHAR(36),
    payment_status ENUM('pending', 'paid', 'cancelled') DEFAULT 'pending',
    payment_method VARCHAR(50),
    transaction_id VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (called_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (served_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_business (business_id),
    INDEX idx_queue_number (business_id, queue_number),
    INDEX idx_status (status),
    INDEX idx_priority (is_priority),
    INDEX idx_joined_at (joined_at),
    UNIQUE KEY unique_queue_number (business_id, queue_number)
);

-- Add business_id to users table for quick reference
