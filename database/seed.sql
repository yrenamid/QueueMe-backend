-- QueueMe Database Seed Data
-- Clear all tables before seeding (order matters for foreign keys)
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE queue_customers;
TRUNCATE TABLE menu_items;
TRUNCATE TABLE staff_members;
TRUNCATE TABLE businesses;
TRUNCATE TABLE users;
SET FOREIGN_KEY_CHECKS = 1;

-- Insert sample users (password is 'password123' hashed with bcrypt)
INSERT INTO users (id, email, password_hash, role) VALUES
('u1a2b3c4-5d6e-7f8a-9b0c-1d2e3f4a5b6c', 'admin@queueme.com', '$2a$10$rOzJqQZ8kVhV7QZ8kVhV7O8kVhV7QZ8kVhV7QZ8kVhV7QZ8kVhV7Q', 'admin'),
('u2b3c4d5-6e7f-8a9b-0c1d-2e3f4a5b6c7d', 'owner@restaurant.com', '$2a$10$rOzJqQZ8kVhV7QZ8kVhV7O8kVhV7QZ8kVhV7QZ8kVhV7QZ8kVhV7Q', 'business'),
('u3c4d5e6-7f8a-9b0c-1d2e-3f4a5b6c7d8e', 'manager@restaurant.com', '$2a$10$rOzJqQZ8kVhV7QZ8kVhV7O8kVhV7QZ8kVhV7QZ8kVhV7QZ8kVhV7Q', 'staff'),
('u4d5e6f7-8a9b-0c1d-2e3f-4a5b6c7d8e9f', 'cashier@restaurant.com', '$2a$10$rOzJqQZ8kVhV7QZ8kVhV7O8kVhV7QZ8kVhV7QZ8kVhV7QZ8kVhV7Q', 'staff');

-- Insert sample businesses (with queue settings columns)
INSERT INTO businesses (id, name, email, phone, address, type, owner_id,
    max_queue_length, reserve_slots, notify_customer, auto_wait_times, multi_step_queue, settings
) VALUES
('b1e2c3d4-5f6a-7b8c-9d0e-1f2a3b4c5d6e',
    'Demo Restaurant',
    'contact@demorestaurant.com',
    '+1234567890',
    '123 Main Street, Demo City, DC 12345',
    'restaurant',
    'u2b3c4d5-6e7f-8a9b-0c1d-2e3f4a5b6c7d',
    50, 10, TRUE, TRUE, FALSE,
    '{"queueLength": 30, "prioritySlots": 10, "averageServiceTime": 8}'
),
('c2f3d4e5-6a7b-8c9d-0e1f-2a3b4c5d6e7f',
    'Coffee Corner Cafe',
    'hello@democafe.com',
    '+1987654321',
    '456 Coffee Lane, Demo City, DC 12346',
    'cafe',
    'u2b3c4d5-6e7f-8a9b-0c1d-2e3f4a5b6c7d',
    30, 5, TRUE, TRUE, FALSE,
    '{"queueLength": 20, "prioritySlots": 5, "averageServiceTime": 5}'
),
('d3a4b5c6-7d8e-9f0a-1b2c-3d4e5f6a7b8c',
    'QueueMe HQ',
    'hq@queueme.com',
    '+1122334455',
    '789 Admin Plaza, Business District, City 12345',
    'service',
    'u1a2b3c4-5d6e-7f8a-9b0c-1d2e3f4a5b6c',
    100, 20, TRUE, TRUE, TRUE,
    '{"queueLength": 100, "prioritySlots": 20, "averageServiceTime": 10}'
);

-- Insert sample staff members
INSERT INTO staff_members (id, business_id, user_id, name, email, role, status) VALUES
('s1a2b3c4-5d6e-7f8a-9b0c-1d2e3f4a5b6c', 'b1e2c3d4-5f6a-7b8c-9d0e-1f2a3b4c5d6e', 'u3c4d5e6-7f8a-9b0c-1d2e-3f4a5b6c7d8e', 'John Manager', 'manager@restaurant.com', 'manager', 'active'),
('s2b3c4d5-6e7f-8a9b-0c1d-2e3f4a5b6c7d', 'b1e2c3d4-5f6a-7b8c-9d0e-1f2a3b4c5d6e', 'u4d5e6f7-8a9b-0c1d-2e3f-4a5b6c7d8e9f', 'Sarah Cashier', 'cashier@restaurant.com', 'cashier', 'active'),
('s3c4d5e6-7f8a-9b0c-1d2e-3f4a5b6c7d8e', 'b1e2c3d4-5f6a-7b8c-9d0e-1f2a3b4c5d6e', NULL, 'Mike Server', 'mike.server@restaurant.com', 'server', 'active'),
('s4d5e6f7-8a9b-0c1d-2e3f-4a5b6c7d8e9f', 'b1e2c3d4-5f6a-7b8c-9d0e-1f2a3b4c5d6e', NULL, 'Lisa Kitchen', 'lisa.kitchen@restaurant.com', 'kitchen', 'active');

-- Insert sample menu items (unchanged)
INSERT INTO menu_items (id, business_id, name, description, price, category, image, available) VALUES
('m1a2b3c4-5d6e-7f8a-9b0c-1d2e3f4a5b6c', 'b1e2c3d4-5f6a-7b8c-9d0e-1f2a3b4c5d6e', 'Classic Burger', 'Juicy beef patty with lettuce, tomato, and our special sauce', 12.99, 'Main Course', '/placeholder.svg?height=200&width=200&text=Classic+Burger', TRUE),
('m2b3c4d5-6e7f-8a9b-0c1d-2e3f4a5b6c7d', 'b1e2c3d4-5f6a-7b8c-9d0e-1f2a3b4c5d6e', 'Chicken Caesar Salad', 'Fresh romaine lettuce with grilled chicken, parmesan, and caesar dressing', 10.99, 'Salads', '/placeholder.svg?height=200&width=200&text=Caesar+Salad', TRUE),
('m3c4d5e6-7f8a-9b0c-1d2e-3f4a5b6c7d8e', 'b1e2c3d4-5f6a-7b8c-9d0e-1f2a3b4c5d6e', 'Margherita Pizza', 'Traditional pizza with fresh mozzarella, tomatoes, and basil', 14.99, 'Main Course', '/placeholder.svg?height=200&width=200&text=Margherita+Pizza', TRUE);

-- Insert sample queue customers (unchanged)
INSERT INTO queue_customers (id, business_id, queue_number, customer_name, customer_phone, customer_email, order_items, order_total, status, is_priority, estimated_wait_time, joined_at) VALUES
('q1a2b3c4-5d6e-7f8a-9b0c-1d2e3f4a5b6c', 'b1e2c3d4-5f6a-7b8c-9d0e-1f2a3b4c5d6e', 1, 'Alice Johnson', '+1234567890', 'alice@example.com', 
'[{"id": "m1a2b3c4-5d6e-7f8a-9b0c-1d2e3f4a5b6c", "name": "Classic Burger", "price": 12.99, "quantity": 1}]', 
12.99, 'waiting', FALSE, 15, DATE_SUB(NOW(), INTERVAL 5 MINUTE));

-- Show summary
SELECT 'Users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'Businesses', COUNT(*) FROM businesses
UNION ALL
SELECT 'Staff Members', COUNT(*) FROM staff_members
UNION ALL
SELECT 'Menu Items', COUNT(*) FROM menu_items
UNION ALL
SELECT 'Queue Customers', COUNT(*) FROM queue_customers;
