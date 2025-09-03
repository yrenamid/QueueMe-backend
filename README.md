# QueueMe API Server

A Node.js/Express backend for the QueueMe virtual queue management system.

## Features

- **Authentication & Authorization**: JWT-based authentication with role-based access control
- **Queue Management**: Real-time queue operations for businesses
- **Menu Management**: CRUD operations for business menus
- **Staff Management**: Staff member management and activity tracking
- **QR Code Generation**: Dynamic QR code generation for queue joining
- **Business Management**: Complete business profile and settings management

## Installation

1. Clone the repository
2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

3. Create environment file:
   \`\`\`bash
   cp .env.example .env
   \`\`\`

4. Update the `.env` file with your configuration

5. Start the server:
   \`\`\`bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   \`\`\`

## API Documentation

### Base URL
\`\`\`
http://localhost:5000/api
\`\`\`

### Authentication
Most endpoints require authentication via JWT token in the Authorization header:
\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`

### User Roles
- **admin**: Full system access
- **business**: Business owner access
- **staff**: Staff member access
- **customer**: Limited access for queue operations

## API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - User login
- `GET /auth/profile` - Get user profile
- `PUT /auth/profile` - Update user profile
- `POST /auth/refresh` - Refresh JWT token
- `POST /auth/logout` - User logout

### Businesses
- `GET /businesses` - Get all businesses (admin only)
- `GET /businesses/:id` - Get business by ID
- `POST /businesses` - Create new business (admin only)
- `PUT /businesses/:id` - Update business
- `DELETE /businesses/:id` - Delete business (admin only)
- `GET /businesses/:id/settings` - Get business settings
- `PUT /businesses/:id/settings` - Update business settings
- `GET /businesses/:id/analytics` - Get business analytics

### Queue Management
- `GET /queue/business/:businessId` - Get queue for business
- `POST /queue/join` - Join queue (public)
- `GET /queue/customer/:id` - Get customer status (public)
- `GET /queue/:id` - Get customer details (staff only)
- `PUT /queue/:id` - Update customer
- `POST /queue/:id/call` - Call next customer
- `POST /queue/:id/complete` - Complete customer service
- `POST /queue/:id/extend` - Extend customer wait time
- `POST /queue/:id/payment` - Update payment status
- `DELETE /queue/:id` - Remove customer from queue
- `GET /queue/business/:businessId/stats` - Get queue statistics

### Menu Management
- `GET /menu/business/:businessId` - Get menu for business (public)
- `GET /menu/:id` - Get menu item
- `POST /menu` - Add menu item
- `PUT /menu/:id` - Update menu item
- `PATCH /menu/:id/availability` - Toggle menu item availability
- `DELETE /menu/:id` - Delete menu item
- `GET /menu/business/:businessId/categories` - Get menu categories
- `PATCH /menu/bulk` - Bulk update menu items

### Staff Management
- `GET /staff/business/:businessId` - Get staff for business
- `GET /staff/:id` - Get staff member
- `POST /staff` - Create staff member
- `PUT /staff/:id` - Update staff member
- `PATCH /staff/:id/status` - Update staff status
- `DELETE /staff/:id` - Delete staff member
- `GET /staff/:id/activity` - Get staff activity

### QR Code Generation
- `GET /qr/business/:businessId` - Generate business QR code
- `GET /qr/customer/:customerId` - Generate customer QR code
- `POST /qr/generate` - Generate custom QR code
- `GET /qr/analytics/:businessId` - Get QR code analytics

## Sample Data

The server includes sample data for testing:

### Sample Users
- **Admin**: admin@queueme.com / password
- **Business Owner**: owner@restaurant.com / password  
- **Staff**: staff@restaurant.com / password

### Sample Business
- **ID**: business-1
- **Name**: Sample Restaurant
- **Type**: restaurant

## Environment Variables

See `.env.example` for all available configuration options. You can set `BASE_URL` (e.g. your LAN IP http://192.168.x.x:8100 or production domain) to control the URL encoded in customer QR codes. If omitted it falls back to `FRONTEND_URL`, then `http://localhost:8100`.

## Development

### Running Tests
\`\`\`bash
npm test
\`\`\`

### Code Structure
\`\`\`
server/
├── config/
│   └── database.js          # In-memory database simulation
├── middleware/
│   └── auth.js              # Authentication middleware
├── routes/
│   ├── auth.js              # Authentication routes
│   ├── businesses.js        # Business management routes
│   ├── queue.js             # Queue management routes
│   ├── menu.js              # Menu management routes
│   ├── staff.js             # Staff management routes
│   └── qr.js                # QR code generation routes
├── .env.example             # Environment variables template
├── package.json             # Dependencies and scripts
├── server.js                # Main server file
└── README.md                # This file
\`\`\`

## Production Deployment

1. Set `NODE_ENV=production` in your environment
2. Use a process manager like PM2:
   \`\`\`bash
   npm install -g pm2
   pm2 start server.js --name queueme-api
   \`\`\`
3. Set up a reverse proxy (nginx) for SSL termination
4. Replace the in-memory database with a real database (MongoDB/PostgreSQL)

## License

MIT License
\`\`\`

Now, here's the comprehensive Postman testing guide:

# QueueMe API - Postman Testing Guide

## Setup

1. **Base URL**: `http://localhost:5000/api`
2. **Create a new Postman Collection**: "QueueMe API"
3. **Set Collection Variables**:
   - `baseUrl`: `http://localhost:5000/api`
   - `token`: (will be set after login)

## 1. Authentication Endpoints

### 1.1 Register New User
- **Method**: POST
- **URL**: `{{baseUrl}}/auth/register`
- **Body** (JSON):
\`\`\`json
{
  "email": "newuser@example.com",
  "password": "password123",
  "role": "business",
  "businessName": "My New Restaurant",
  "businessType": "restaurant"
}
\`\`\`

### 1.2 Login User
- **Method**: POST
- **URL**: `{{baseUrl}}/auth/login`
- **Body** (JSON):
\`\`\`json
{
  "email": "admin@queueme.com",
  "password": "password"
}
\`\`\`
- **Test Script** (to save token):
\`\`\`javascript
if (pm.response.code === 200) {
    const response = pm.response.json();
    pm.collectionVariables.set("token", response.data.token);
}
\`\`\`

### 1.3 Get User Profile
- **Method**: GET
- **URL**: `{{baseUrl}}/auth/profile`
- **Headers**: `Authorization: Bearer {{token}}`

### 1.4 Update Profile
- **Method**: PUT
- **URL**: `{{baseUrl}}/auth/profile`
- **Headers**: `Authorization: Bearer {{token}}`
- **Body** (JSON):
\`\`\`json
{
  "businessName": "Updated Restaurant Name",
  "currentPassword": "password",
  "newPassword": "newpassword123"
}
\`\`\`

## 2. Business Management

### 2.1 Get All Businesses (Admin Only)
- **Method**: GET
- **URL**: `{{baseUrl}}/businesses`
- **Headers**: `Authorization: Bearer {{token}}`

### 2.2 Get Business by ID
- **Method**: GET
- **URL**: `{{baseUrl}}/businesses/business-1`
- **Headers**: `Authorization: Bearer {{token}}`

### 2.3 Create New Business (Admin Only)
- **Method**: POST
- **URL**: `{{baseUrl}}/businesses`
- **Headers**: `Authorization: Bearer {{token}}`
- **Body** (JSON):
\`\`\`json
{
  "name": "New Coffee Shop",
  "email": "coffee@example.com",
  "phone": "+1234567890",
  "address": "456 Coffee St, City, State",
  "type": "cafe"
}
\`\`\`

### 2.4 Update Business
- **Method**: PUT
- **URL**: `{{baseUrl}}/businesses/business-1`
- **Headers**: `Authorization: Bearer {{token}}`
- **Body** (JSON):
\`\`\`json
{
  "name": "Updated Restaurant Name",
  "phone": "+1987654321",
  "address": "789 New Address St"
}
\`\`\`

### 2.5 Get Business Settings
- **Method**: GET
- **URL**: `{{baseUrl}}/businesses/business-1/settings`
- **Headers**: `Authorization: Bearer {{token}}`

### 2.6 Update Business Settings
- **Method**: PUT
- **URL**: `{{baseUrl}}/businesses/business-1/settings`
- **Headers**: `Authorization: Bearer {{token}}`
- **Body** (JSON):
\`\`\`json
{
  "settings": {
    "queueLength": 75,
    "prioritySlots": 15,
    "priorityExtensionTime": 20,
    "operatingHours": {
      "monday": { "open": "08:00", "close": "20:00", "closed": false }
    }
  }
}
\`\`\`

## 3. Queue Management

### 3.1 Get Queue for Business (Public)
- **Method**: GET
- **URL**: `{{baseUrl}}/queue/business/business-1`
- **Query Params**: `status=waiting` (optional)

### 3.2 Join Queue (Public)
- **Method**: POST
- **URL**: `{{baseUrl}}/queue/join`
- **Body** (JSON):
\`\`\`json
{
  "businessId": "business-1",
  "customerName": "John Doe",
  "customerPhone": "+1234567890",
  "customerEmail": "john@example.com",
  "orderItems": [
    {
      "id": "menu-1",
      "name": "Burger Deluxe",
      "price": 12.99,
      "quantity": 1
    }
  ],
  "isPriority": false
}
\`\`\`

### 3.3 Get Customer Status (Public)
- **Method**: GET
- **URL**: `{{baseUrl}}/queue/customer/customer-1`

### 3.4 Update Customer (Staff Only)
- **Method**: PUT
- **URL**: `{{baseUrl}}/queue/customer-1`
- **Headers**: `Authorization: Bearer {{token}}`
- **Body** (JSON):
\`\`\`json
{
  "customerName": "Updated Name",
  "estimatedWaitTime": 20,
  "orderItems": [
    {
      "id": "menu-1",
      "name": "Burger Deluxe",
      "price": 12.99,
      "quantity": 2
    }
  ]
}
\`\`\`

### 3.5 Call Next Customer
- **Method**: POST
- **URL**: `{{baseUrl}}/queue/customer-1/call`
- **Headers**: `Authorization: Bearer {{token}}`

### 3.6 Complete Customer Service
- **Method**: POST
- **URL**: `{{baseUrl}}/queue/customer-1/complete`
- **Headers**: `Authorization: Bearer {{token}}`

### 3.7 Extend Customer Wait Time
- **Method**: POST
- **URL**: `{{baseUrl}}/queue/customer-1/extend`
- **Headers**: `Authorization: Bearer {{token}}`
- **Body** (JSON):
\`\`\`json
{
  "minutes": 15
}
\`\`\`

### 3.8 Update Payment Status
- **Method**: POST
- **URL**: `{{baseUrl}}/queue/customer-1/payment`
- **Headers**: `Authorization: Bearer {{token}}`
- **Body** (JSON):
\`\`\`json
{
  "paymentStatus": "paid",
  "notes": "Payment completed via card"
}
\`\`\`

## 4. Menu Management

### 4.1 Get Menu for Business (Public)
- **Method**: GET
- **URL**: `{{baseUrl}}/menu/business/business-1`
- **Query Params**: `category=Main Course&available=true` (optional)

### 4.2 Add Menu Item
- **Method**: POST
- **URL**: `{{baseUrl}}/menu`
- **Headers**: `Authorization: Bearer {{token}}`
- **Body** (JSON):
\`\`\`json
{
  "businessId": "business-1",
  "name": "Grilled Chicken",
  "description": "Tender grilled chicken breast with herbs",
  "price": 15.99,
  "category": "Main Course",
  "image": "/placeholder.svg?height=200&width=200"
}
\`\`\`

### 4.3 Update Menu Item
- **Method**: PUT
- **URL**: `{{baseUrl}}/menu/menu-1`
- **Headers**: `Authorization: Bearer {{token}}`
- **Body** (JSON):
\`\`\`json
{
  "name": "Premium Burger Deluxe",
  "price": 14.99,
  "description": "Updated description with premium ingredients"
}
\`\`\`

### 4.4 Toggle Menu Item Availability
- **Method**: PATCH
- **URL**: `{{baseUrl}}/menu/menu-1/availability`
- **Headers**: `Authorization: Bearer {{token}}`
- **Body** (JSON):
\`\`\`json
{
  "available": false
}
\`\`\`

### 4.5 Get Menu Categories
- **Method**: GET
- **URL**: `{{baseUrl}}/menu/business/business-1/categories`

### 4.6 Bulk Update Menu Items
- **Method**: PATCH
- **URL**: `{{baseUrl}}/menu/bulk`
- **Headers**: `Authorization: Bearer {{token}}`
- **Body** (JSON):
\`\`\`json
{
  "businessId": "business-1",
  "updates": [
    {
      "id": "menu-1",
      "price": 13.99,
      "available": true
    },
    {
      "id": "menu-2",
      "price": 9.99
    }
  ]
}
\`\`\`

## 5. Staff Management

### 5.1 Get Staff for Business
- **Method**: GET
- **URL**: `{{baseUrl}}/staff/business/business-1`
- **Headers**: `Authorization: Bearer {{token}}`
- **Query Params**: `status=active&role=manager` (optional)

### 5.2 Create Staff Member
- **Method**: POST
- **URL**: `{{baseUrl}}/staff`
- **Headers**: `Authorization: Bearer {{token}}`
- **Body** (JSON):
\`\`\`json
{
  "businessId": "business-1",
  "name": "New Staff Member",
  "email": "newstaff@restaurant.com",
  "role": "staff",
  "password": "staffpassword123"
}
\`\`\`

### 5.3 Update Staff Member
- **Method**: PUT
- **URL**: `{{baseUrl}}/staff/staff-1`
- **Headers**: `Authorization: Bearer {{token}}`
- **Body** (JSON):
\`\`\`json
{
  "name": "Updated Staff Name",
  "role": "manager",
  "email": "updated@restaurant.com"
}
\`\`\`

### 5.4 Update Staff Status
- **Method**: PATCH
- **URL**: `{{baseUrl}}/staff/staff-1/status`
- **Headers**: `Authorization: Bearer {{token}}`
- **Body** (JSON):
\`\`\`json
{
  "status": "inactive"
}
\`\`\`

### 5.5 Get Staff Activity
- **Method**: GET
- **URL**: `{{baseUrl}}/staff/staff-1/activity`
- **Headers**: `Authorization: Bearer {{token}}`
- **Query Params**: `startDate=2024-01-01&endDate=2024-01-31` (optional)

## 6. QR Code Generation

### 6.1 Generate Business QR Code (PNG)
- **Method**: GET
- **URL**: `{{baseUrl}}/qr/business/business-1`
- **Query Params**: `format=png&size=256`

### 6.2 Generate Business QR Code (JSON)
- **Method**: GET
- **URL**: `{{baseUrl}}/qr/business/business-1`
- **Query Params**: `format=json`

### 6.3 Generate Customer QR Code
- **Method**: GET
- **URL**: `{{baseUrl}}/qr/customer/customer-1`
- **Query Params**: `format=png&size=256`

### 6.4 Generate Custom QR Code
- **Method**: POST
- **URL**: `{{baseUrl}}/qr/generate`
- **Headers**: `Authorization: Bearer {{token}}`
- **Body** (JSON):
\`\`\`json
{
  "url": "https://example.com/custom-page",
  "format": "png",
  "size": 512,
  "title": "Custom QR Code"
}
\`\`\`

### 6.5 Get QR Analytics
- **Method**: GET
- **URL**: `{{baseUrl}}/qr/analytics/business-1`
- **Headers**: `Authorization: Bearer {{token}}`

## Testing Tips

1. **Start with Authentication**: Always login first to get the token
2. **Use Environment Variables**: Set up `{{baseUrl}}` and `{{token}}` variables
3. **Test Different Roles**: Login with different user types (admin, business, staff)
4. **Check Response Status**: Verify HTTP status codes (200, 201, 400, 401, 403, 404)
5. **Validate Response Structure**: Check that responses match expected JSON structure
6. **Test Error Cases**: Try invalid data, missing fields, unauthorized access
7. **Sequential Testing**: Some endpoints depend on data created by others

## Sample Test Sequence

1. Login as admin → Get token
2. Create a new business
3. Login as business owner → Get new token
4. Add menu items
5. Create staff members
6. Join queue (no auth needed)
7. Login as staff → Get staff token
8. Manage queue (call, complete customers)
9. Generate QR codes
10. Check analytics

This comprehensive guide covers all the API endpoints with proper request bodies and testing scenarios.
