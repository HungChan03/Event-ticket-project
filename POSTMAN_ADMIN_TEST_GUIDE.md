# Hướng dẫn Test API Admin với Postman

## 📋 Tổng quan
API Admin yêu cầu JWT authentication và chỉ cho phép user có role "admin" truy cập.

## 🔐 Authentication Flow

### 1. Đăng ký tài khoản Admin
```http
POST http://localhost:5000/api/v1/auth/register
Content-Type: application/json

{
  "name": "Admin User",
  "email": "admin@example.com",
  "password": "123456",
  "phone": "+84901234567",
  "avatarUrl": "https://example.com/avatar.jpg"
}
```

**Response:**
```json
{
  "user": {
    "name": "Admin User",
    "email": "admin@example.com",
    "role": "user",
    "phone": "+84901234567",
    "avatarUrl": "https://example.com/avatar.jpg",
    "isVerified": false,
    "_id": "68f4f74c987123ccd3f957c3",
    "createdAt": "2025-10-19T14:35:56.517Z",
    "updatedAt": "2025-10-19T14:35:56.517Z",
    "__v": 0
  }
}
```

### 2. Đăng nhập để lấy JWT Token
```http
POST http://localhost:5000/api/v1/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "123456"
}
```

**Response:**
```json
{
  "user": {
    "name": "Admin User",
    "email": "admin@example.com",
    "role": "user",
    "phone": "+84901234567",
    "avatarUrl": "https://example.com/avatar.jpg",
    "isVerified": false,
    "_id": "68f4f74c987123ccd3f957c3",
    "createdAt": "2025-10-19T14:35:56.517Z",
    "updatedAt": "2025-10-19T14:35:56.517Z",
    "__v": 0
  }
}
```

**Lưu ý:** JWT token sẽ được lưu trong cookie `token` hoặc bạn có thể lấy từ response headers.

### 3. Cập nhật role thành admin (cần thực hiện trực tiếp trong database)
```javascript
// Trong MongoDB Compass hoặc mongo shell
db.users.updateOne(
  { email: "admin@example.com" },
  { $set: { role: "admin" } }
)
```

## 🛠️ Cấu hình Postman

### Cách 1: Sử dụng Cookie (Khuyến nghị)
1. Sau khi đăng nhập thành công, Postman sẽ tự động lưu cookie `token`
2. Các request tiếp theo sẽ tự động gửi cookie này

### Cách 2: Sử dụng Authorization Header
1. Copy JWT token từ cookie hoặc response
2. Thêm header: `Authorization: Bearer <your-jwt-token>`

## 📊 Test Cases Admin API

### User Management

#### 1. Lấy danh sách users
```http
GET http://localhost:5000/api/v1/admin/users?page=1&limit=10&search=admin
Authorization: Bearer <your-jwt-token>
```

#### 2. Lấy thông tin user theo ID
```http
GET http://localhost:5000/api/v1/admin/users/68f4f74c987123ccd3f957c3
Authorization: Bearer <your-jwt-token>
```

#### 3. Tạo user mới
```http
POST http://localhost:5000/api/v1/admin/users
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "name": "New User",
  "email": "newuser@example.com",
  "password": "123456",
  "role": "user",
  "phone": "+84901234567",
  "avatarUrl": "https://example.com/avatar.jpg"
}
```

#### 4. Cập nhật thông tin user
```http
PUT http://localhost:5000/api/v1/admin/users/68f4f74c987123ccd3f957c3
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "name": "Updated User",
  "email": "updated@example.com",
  "role": "organizer",
  "phone": "+84901234568",
  "isVerified": true
}
```

#### 5. Đổi mật khẩu user
```http
PATCH http://localhost:5000/api/v1/admin/users/68f4f74c987123ccd3f957c3/password
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "newPassword": "newpassword123"
}
```

#### 6. Xóa user
```http
DELETE http://localhost:5000/api/v1/admin/users/68f4f74c987123ccd3f957c3
Authorization: Bearer <your-jwt-token>
```

#### 7. Thống kê users
```http
GET http://localhost:5000/api/v1/admin/users/stats
Authorization: Bearer <your-jwt-token>
```

### Event Management

#### 8. Lấy danh sách events
```http
GET http://localhost:5000/api/v1/admin/events?page=1&limit=10&status=approved
Authorization: Bearer <your-jwt-token>
```

#### 9. Tạo event mới
```http
POST http://localhost:5000/api/v1/admin/events
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "title": "Test Event",
  "description": "This is a test event",
  "posterUrl": "https://example.com/poster.jpg",
  "venue": "Test Venue",
  "startDate": "2025-12-01T10:00:00.000Z",
  "endDate": "2025-12-01T18:00:00.000Z",
  "capacity": 100,
  "categories": ["Music", "Entertainment"],
  "ticketTypes": [
    {
      "name": "VIP",
      "price": 500000,
      "quantity": 20
    },
    {
      "name": "Standard",
      "price": 200000,
      "quantity": 80
    }
  ],
  "organizer": "68f4f74c987123ccd3f957c3"
}
```

#### 10. Duyệt event
```http
PATCH http://localhost:5000/api/v1/admin/events/68f4f74c987123ccd3f957c3/approve
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "adminNote": "Event đã được duyệt"
}
```

#### 11. Từ chối event
```http
PATCH http://localhost:5000/api/v1/admin/events/68f4f74c987123ccd3f957c3/reject
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "reason": "Event không phù hợp với tiêu chuẩn"
}
```

#### 12. Thống kê events
```http
GET http://localhost:5000/api/v1/admin/events/stats
Authorization: Bearer <your-jwt-token>
```

### Ticket Management

#### 13. Lấy danh sách vé tổng quan
```http
GET http://localhost:5000/api/v1/admin/tickets?page=1&limit=10&status=valid
Authorization: Bearer <your-jwt-token>
```

**Query Parameters:**
- `page`: Số trang (mặc định: 1)
- `limit`: Số vé mỗi trang (mặc định: 10)
- `eventId`: Filter theo sự kiện
- `status`: Filter theo trạng thái (valid, used, cancelled, refunded)
- `ticketType`: Filter theo loại vé
- `ownerId`: Filter theo người sở hữu
- `search`: Tìm kiếm theo QR code

#### 14. Lấy thông tin chi tiết một vé
```http
GET http://localhost:5000/api/v1/admin/tickets/68f4f74c987123ccd3f957c3
Authorization: Bearer <your-jwt-token>
```

#### 15. Lấy danh sách vé theo sự kiện
```http
GET http://localhost:5000/api/v1/admin/events/68f4f74c987123ccd3f957c3/tickets?page=1&limit=10&status=valid
Authorization: Bearer <your-jwt-token>
```

**Query Parameters:**
- `page`: Số trang (mặc định: 1)
- `limit`: Số vé mỗi trang (mặc định: 10)
- `status`: Filter theo trạng thái
- `ticketType`: Filter theo loại vé

#### 16. Thống kê vé tổng quan
```http
GET http://localhost:5000/api/v1/admin/tickets/stats
Authorization: Bearer <your-jwt-token>
```

**Response bao gồm:**
- Tổng số vé theo từng trạng thái
- Thống kê theo loại vé và doanh thu
- Top 10 sự kiện có nhiều vé nhất
- Thống kê theo tháng
- Vé gần đây nhất
- Tổng doanh thu

#### 17. Thống kê vé theo sự kiện cụ thể
```http
GET http://localhost:5000/api/v1/admin/events/68f4f74c987123ccd3f957c3/tickets/stats
Authorization: Bearer <your-jwt-token>
```

**Response bao gồm:**
- Thông tin sự kiện
- Số vé theo từng trạng thái
- Thống kê theo loại vé trong sự kiện
- Tổng doanh thu của sự kiện
- Tỷ lệ sử dụng capacity

#### 18. Cập nhật trạng thái vé
```http
PATCH http://localhost:5000/api/v1/admin/tickets/68f4f74c987123ccd3f957c3/status
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "status": "cancelled",
  "reason": "Khách hàng yêu cầu hủy vé"
}
```

**Status hợp lệ:**
- `valid`: Vé hợp lệ
- `used`: Vé đã sử dụng
- `cancelled`: Vé đã hủy
- `refunded`: Vé đã hoàn tiền

**Response Example:**
```json
{
  "success": true,
  "message": "Cập nhật trạng thái vé thành công",
  "data": {
    "_id": "68f4f74c987123ccd3f957c3",
    "event": {
      "_id": "68f4f74c987123ccd3f957c4",
      "title": "Test Event"
    },
    "owner": {
      "_id": "68f4f74c987123ccd3f957c5",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "ticketType": "VIP",
    "pricePaid": 500000,
    "status": "cancelled",
    "qrCode": "QR123456789",
    "adminNote": "Khách hàng yêu cầu hủy vé",
    "purchasedAt": "2025-10-19T14:35:56.517Z",
    "createdAt": "2025-10-19T14:35:56.517Z",
    "updatedAt": "2025-10-19T14:35:56.517Z"
  }
}
```

## 📊 Sample Responses

### Ticket Stats Response
```json
{
  "success": true,
  "data": {
    "totalTickets": 150,
    "validTickets": 120,
    "usedTickets": 25,
    "cancelledTickets": 3,
    "refundedTickets": 2,
    "ticketsByStatus": [
      { "_id": "valid", "count": 120 },
      { "_id": "used", "count": 25 },
      { "_id": "cancelled", "count": 3 },
      { "_id": "refunded", "count": 2 }
    ],
    "ticketsByType": [
      { "_id": "VIP", "count": 30, "totalRevenue": 15000000 },
      { "_id": "Standard", "count": 120, "totalRevenue": 24000000 }
    ],
    "ticketsByEvent": [
      {
        "_id": "68f4f74c987123ccd3f957c4",
        "eventTitle": "Music Festival 2025",
        "count": 50,
        "totalRevenue": 10000000
      }
    ],
    "ticketsByMonth": [
      {
        "_id": { "year": 2025, "month": 10 },
        "count": 45,
        "totalRevenue": 9000000
      }
    ],
    "recentTickets": [
      {
        "_id": "68f4f74c987123ccd3f957c3",
        "event": { "title": "Test Event" },
        "owner": { "name": "John Doe", "email": "john@example.com" },
        "ticketType": "VIP",
        "pricePaid": 500000,
        "status": "valid",
        "purchasedAt": "2025-10-19T14:35:56.517Z"
      }
    ],
    "totalRevenue": 39000000
  }
}
```

### Event Ticket Stats Response
```json
{
  "success": true,
  "data": {
    "event": {
      "_id": "68f4f74c987123ccd3f957c4",
      "title": "Music Festival 2025",
      "capacity": 100,
      "startDate": "2025-12-01T10:00:00.000Z",
      "endDate": "2025-12-01T18:00:00.000Z",
      "venue": "Stadium ABC"
    },
    "totalTickets": 75,
    "validTickets": 60,
    "usedTickets": 12,
    "cancelledTickets": 2,
    "refundedTickets": 1,
    "ticketsByType": [
      { "_id": "VIP", "count": 20, "totalRevenue": 10000000 },
      { "_id": "Standard", "count": 55, "totalRevenue": 11000000 }
    ],
    "ticketsByStatus": [
      { "_id": "valid", "count": 60 },
      { "_id": "used", "count": 12 },
      { "_id": "cancelled", "count": 2 },
      { "_id": "refunded", "count": 1 }
    ],
    "totalRevenue": 21000000,
    "capacityUtilization": 75.0
  }
}
```

## 🚫 Test Cases Lỗi

### 1. Truy cập không có token
```http
GET http://localhost:5000/api/v1/admin/users
```
**Expected Response:** `401 Unauthorized`

### 2. Truy cập với token của user thường
```http
GET http://localhost:5000/api/v1/admin/users
Authorization: Bearer <user-jwt-token>
```
**Expected Response:** `403 Forbidden - Bạn không có quyền truy cập vào trang admin`

### 3. Token không hợp lệ
```http
GET http://localhost:5000/api/v1/admin/users
Authorization: Bearer invalid-token
```
**Expected Response:** `401 Unauthorized`

## 📝 Postman Collection Setup

### Environment Variables
Tạo environment trong Postman với các biến:
- `base_url`: `http://localhost:5000/api/v1`
- `admin_token`: JWT token của admin (cập nhật sau khi đăng nhập)

### Pre-request Script
Thêm script này vào Pre-request Script của collection:
```javascript
// Tự động lấy token từ cookie
if (pm.cookies.has('token')) {
    pm.environment.set('admin_token', pm.cookies.get('token'));
}
```

### Tests Script
Thêm script này vào Tests của mỗi request:
```javascript
// Kiểm tra response status
pm.test("Status code is successful", function () {
    pm.expect(pm.response.code).to.be.oneOf([200, 201]);
});

// Kiểm tra response có success field
pm.test("Response has success field", function () {
    const jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('success');
});
```

## 🔧 Troubleshooting

### Lỗi 401 Unauthorized
- Kiểm tra JWT token có hợp lệ không
- Kiểm tra token có hết hạn không (mặc định 7 ngày)
- Đăng nhập lại để lấy token mới

### Lỗi 403 Forbidden
- Kiểm tra user có role "admin" không
- Cập nhật role trong database: `db.users.updateOne({email: "admin@example.com"}, {$set: {role: "admin"}})`

### Lỗi 500 Internal Server Error
- Kiểm tra server có đang chạy không
- Kiểm tra logs của server
- Kiểm tra kết nối database

## 📚 API Endpoints Summary

### User Management
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/admin/users` | Lấy danh sách users | Admin |
| GET | `/admin/users/stats` | Thống kê users | Admin |
| GET | `/admin/users/:id` | Lấy thông tin user | Admin |
| POST | `/admin/users` | Tạo user mới | Admin |
| PUT | `/admin/users/:id` | Cập nhật user | Admin |
| PATCH | `/admin/users/:id/password` | Đổi mật khẩu | Admin |
| DELETE | `/admin/users/:id` | Xóa user | Admin |

### Event Management
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/admin/events` | Lấy danh sách events | Admin |
| GET | `/admin/events/stats` | Thống kê events | Admin |
| GET | `/admin/events/:id` | Lấy thông tin event | Admin |
| POST | `/admin/events` | Tạo event mới | Admin |
| PUT | `/admin/events/:id` | Cập nhật event | Admin |
| PATCH | `/admin/events/:id/approve` | Duyệt event | Admin |
| PATCH | `/admin/events/:id/reject` | Từ chối event | Admin |
| PATCH | `/admin/events/:id/cancel` | Hủy event | Admin |
| DELETE | `/admin/events/:id` | Xóa event | Admin |

### Ticket Management
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/admin/tickets` | Lấy danh sách vé | Admin |
| GET | `/admin/tickets/stats` | Thống kê vé tổng quan | Admin |
| GET | `/admin/tickets/:id` | Lấy thông tin vé | Admin |
| GET | `/admin/events/:eventId/tickets` | Lấy vé theo sự kiện | Admin |
| GET | `/admin/events/:eventId/tickets/stats` | Thống kê vé theo sự kiện | Admin |
| PATCH | `/admin/tickets/:id/status` | Cập nhật trạng thái vé | Admin |
