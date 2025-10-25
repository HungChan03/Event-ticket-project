# Event Management Module

## Mô tả
Module Event Management là phần cốt lõi của hệ thống quản lý vé sự kiện, cho phép người dùng tạo, quản lý và theo dõi các sự kiện. Module này được phát triển cho Assignment lớn SDN302 - PROJECT: Quản lý mua vé sự kiện.

## Chức năng chính

### 1. Quản lý sự kiện (CRUD Operations)
- **Tạo sự kiện mới**: Organizer có thể tạo sự kiện với đầy đủ thông tin
- **Xem danh sách sự kiện**: Public API để xem các sự kiện đã được duyệt
- **Xem chi tiết sự kiện**: Chi tiết đầy đủ về sự kiện
- **Cập nhật sự kiện**: Chỉnh sửa thông tin sự kiện (khi chưa được duyệt)
- **Xóa sự kiện**: Xóa sự kiện (chỉ organizer hoặc admin)

### 2. Upload Poster
- Hỗ trợ upload file ảnh poster cho sự kiện
- Giới hạn kích thước file 5MB
- Chỉ chấp nhận file ảnh (jpg, png, gif, etc.)
- Tự động tạo tên file unique

### 3. Quản lý loại vé
- Hỗ trợ nhiều loại vé cho một sự kiện (Regular, VIP, Early Bird, etc.)
- Mỗi loại vé có giá và số lượng riêng
- Theo dõi số vé đã bán

### 4. Phân quyền và bảo mật
- **Public**: Xem danh sách và chi tiết sự kiện đã duyệt
- **Organizer**: Tạo, chỉnh sửa, xóa sự kiện của mình
- **Admin**: Quản lý toàn bộ sự kiện, duyệt/từ chối sự kiện

### 5. Thống kê và báo cáo
- Thống kê sự kiện của organizer
- Theo dõi doanh thu và số vé bán
- Phân loại theo trạng thái sự kiện

## Cấu trúc API

### Base URL
```
http://localhost:5000/api/v1/events
```

### Endpoints

#### 1. Tạo sự kiện mới
```
POST /api/events
```
**Authentication**: Required (Bearer Token)
**Content-Type**: multipart/form-data

**Body Parameters**:
- `title` (string, required): Tên sự kiện
- `description` (string, optional): Mô tả sự kiện
- `venue` (JSON string, required): Thông tin địa điểm
- `startDate` (ISO string, required): Ngày giờ bắt đầu
- `endDate` (ISO string, optional): Ngày giờ kết thúc
- `capacity` (number, optional): Sức chứa tối đa
- `categories` (JSON array, optional): Danh mục sự kiện
- `ticketTypes` (JSON array, optional): Các loại vé
- `poster` (file, optional): File ảnh poster

**Example**:
```json
{
  "title": "Tech Conference 2024",
  "description": "Annual technology conference",
  "venue": "{\"name\": \"Convention Center\", \"address\": \"123 Main St\", \"city\": \"HCMC\", \"country\": \"Vietnam\"}",
  "startDate": "2024-12-25T09:00:00.000Z",
  "endDate": "2024-12-25T17:00:00.000Z",
  "capacity": 500,
  "categories": "[\"Technology\", \"Conference\"]",
  "ticketTypes": "[{\"name\": \"Early Bird\", \"price\": 50, \"quantity\": 100}, {\"name\": \"Regular\", \"price\": 75, \"quantity\": 200}]"
}
```

#### 2. Lấy danh sách sự kiện
```
GET /api/events
```
**Authentication**: Not required
**Query Parameters**:
- `page` (number): Trang hiện tại (default: 1)
- `limit` (number): Số lượng mỗi trang (default: 10)
- `status` (string): Lọc theo trạng thái (admin only)
- `category` (string): Lọc theo danh mục
- `organizer` (string): Lọc theo organizer (admin only)
- `search` (string): Tìm kiếm theo tên/mô tả

#### 3. Lấy chi tiết sự kiện
```
GET /api/events/:id
```
**Authentication**: Not required

#### 4. Cập nhật sự kiện
```
PUT /api/events/:id
```
**Authentication**: Required (Bearer Token)
**Content-Type**: multipart/form-data
**Permissions**: Organizer (sự kiện của mình) hoặc Admin

#### 5. Xóa sự kiện
```
DELETE /api/events/:id
```
**Authentication**: Required (Bearer Token)
**Permissions**: Organizer (sự kiện của mình) hoặc Admin

#### 6. Lấy sự kiện của organizer
```
GET /api/events/organizer/my-events
```
**Authentication**: Required (Bearer Token)
**Query Parameters**: Tương tự như GET /api/events

#### 7. Thống kê sự kiện
```
GET /api/events/organizer/stats
```
**Authentication**: Required (Bearer Token)

## Trạng thái sự kiện

- **pending**: Chờ admin duyệt (mặc định khi tạo)
- **approved**: Đã được duyệt, hiển thị public
- **rejected**: Bị từ chối
- **cancelled**: Đã hủy
- **draft**: Bản nháp (chưa implement)

## Cấu trúc dữ liệu

### Event Schema
```javascript
{
  title: String,           // Tên sự kiện
  description: String,     // Mô tả
  posterUrl: String,       // URL poster
  venue: {                 // Địa điểm
    name: String,
    address: String,
    city: String,
    country: String
  },
  startDate: Date,         // Ngày giờ bắt đầu
  endDate: Date,           // Ngày giờ kết thúc
  capacity: Number,        // Sức chứa
  categories: [String],    // Danh mục
  ticketTypes: [{          // Các loại vé
    name: String,
    price: Number,
    quantity: Number,
    sold: Number
  }],
  status: String,          // Trạng thái
  organizer: ObjectId,     // ID organizer
  createdAt: Date,
  updatedAt: Date
}
```

## Cài đặt và sử dụng

### 1. Cài đặt dependencies
```bash
npm install multer express-validator
```

### 2. Cấu hình server
Đảm bảo routes được đăng ký trong server.js:
```javascript
const eventRoutes = require('./routes/eventRoutes');
app.use('/api/events', eventRoutes);
```

### 3. Cấu trúc thư mục
```
project/
├── controllers/
│   └── eventController.js
├── middlewares/
│   └── eventValidation.js
├── routes/
│   └── eventRoutes.js
├── models/
│   └── Event.js
├── uploads/
│   └── posters/
└── Event_Management_API.postman_collection.json
```

## Testing với Postman

1. Import file `Event_Management_API.postman_collection.json` vào Postman
2. Cập nhật biến môi trường:
   - `baseUrl`: http://localhost:5000/api/v1
   - `authToken`: JWT token từ login
3. Chạy các request theo thứ tự:
   - Register/Login để lấy token
   - Create Event để tạo sự kiện
   - Test các endpoint khác

## Validation Rules

### Tạo sự kiện
- `title`: Bắt buộc, 3-100 ký tự
- `description`: Tối đa 1000 ký tự
- `venue`: Bắt buộc có name và address
- `startDate`: Bắt buộc, phải là tương lai
- `endDate`: Phải sau startDate
- `capacity`: Số nguyên không âm
- `categories`: Tối đa 5 danh mục, mỗi danh mục tối đa 50 ký tự
- `ticketTypes`: Tối đa 10 loại vé, mỗi loại có name, price ≥ 0, quantity > 0

### Upload file
- Chỉ chấp nhận file ảnh
- Kích thước tối đa 5MB
- Tự động tạo tên file unique

## Xử lý lỗi

### Validation Errors (400)
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "title",
      "message": "Title is required"
    }
  ]
}
```

### Authentication Errors (401)
```json
{
  "success": false,
  "message": "Access denied. No token provided"
}
```

### Authorization Errors (403)
```json
{
  "success": false,
  "message": "Access denied. You can only edit your own events"
}
```

### Not Found Errors (404)
```json
{
  "success": false,
  "message": "Event not found"
}
```

### Server Errors (500)
```json
{
  "success": false,
  "message": "Server error while creating event",
  "error": "Error details"
}
```

## Ghi chú phát triển

### Đã hoàn thành
- ✅ CRUD operations cho Event
- ✅ Upload poster với Multer
- ✅ Validation middleware
- ✅ Phân quyền theo role
- ✅ API documentation
- ✅ Postman collection

### Có thể mở rộng
- 🔄 Tích hợp Cloudinary cho upload
- 🔄 Cache với Redis
- 🔄 Pagination nâng cao
- 🔄 Search với Elasticsearch
- 🔄 Real-time notifications
- 🔄 Event analytics dashboard

## Tác giả
**Vu Hoang** - SDN302 Assignment - Event Management Module

## Ngày tạo
Tháng 10, 2024
