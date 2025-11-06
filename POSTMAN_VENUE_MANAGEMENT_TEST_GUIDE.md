# Venue Management API – Postman Guide

This guide explains how to exercise venue APIs for organizer, admin, and regular users. All examples assume `{{baseUrl}} = http://localhost:5000`.

---

## 1. Authentication Setup

### Organizer
1. Register
   ```http
   POST {{baseUrl}}/api/v1/auth/register
   Content-Type: application/json

   {
     "name": "Organizer User",
     "email": "organizer@example.com",
     "password": "123456",
     "phone": "+84909876543"
   }
   ```
2. Promote role (MongoDB shell)
   ```javascript
   db.users.updateOne(
     { email: "organizer@example.com" },
     { $set: { role: "organizer" } }
   );
   ```
3. Login and store `organizerToken`
   ```http
   POST {{baseUrl}}/api/v1/auth/login
   Content-Type: application/json

   {
     "email": "organizer@example.com",
     "password": "123456"
   }
   ```

---

## 2. Organizer Flow

### 2.1 Create Venue
```http
POST {{baseUrl}}/api/v1/venues
Authorization: Bearer {{organizerToken}}
Content-Type: application/json

{
  "name": "Organizer Hall",
  "address": "12A Nguyen Trai",
  "city": "Ha Noi",
  "country": "Vietnam",
  "capacity": 600,
  "description": "Organizer managed hall",
  "amenities": ["parking", "wifi"]
}
```
**Expect**: `201 Created`. Save `_id` → `{{venueId_org}}`.

### 2.2 List & Detail
```http
GET {{baseUrl}}/api/v1/venues?page=1&limit=10
Authorization: Bearer {{organizerToken}}
```
**Expect**: `200 OK`. Response list shows core fields only (`_id`, `name`, `address`, `capacity`, `status`).

```http
GET {{baseUrl}}/api/v1/venues/{{venueId_org}}
Authorization: Bearer {{organizerToken}}
```
**Expect**: `200 OK`. Detail contains full payload (description, amenities, timestamps, status…).

### 2.3 Update Capacity

#### Scenario A – Valid
```http
PUT {{baseUrl}}/api/v1/venues/{{venueId_org}}
Authorization: Bearer {{organizerToken}}
Content-Type: application/json

{
  "capacity": 550,
  "status": "active"
}
```
**Expect**: `200 OK`.

#### Scenario B – Capacity < Sold (expect 400)

1. Tạo (hoặc chọn) event dùng venue. Ví dụ tạo mới:  
   ```http
   POST {{baseUrl}}/api/v1/events
   Authorization: Bearer {{organizerToken}}
   Content-Type: application/json

   {
     "title": "Capacity Guard Test",
     "description": "Event for capacity guard scenario",
     "venue": { "venueId": "{{venueId_org}}" },
     "startDate": "2025-12-15T08:00:00.000Z",
     "endDate": "2025-12-15T11:00:00.000Z",
     "capacity": 100,
     "ticketTypes": [
       { "name": "General", "price": 50, "quantity": 80 },
       { "name": "VIP", "price": 120, "quantity": 20 }
     ]
   }
   ```
   Lưu `_id` event này → `{{eventId_guard}}`.  
2. Tăng `sold` để tổng vượt capacity mong muốn.  
   Chong chóng bằng MongoDB:
   ```javascript
   db.events.updateOne(
     { _id: ObjectId("{{eventId_guard}}") }, // thay id của event
     { $set: { "ticketTypes.0.sold": 70, "ticketTypes.1.sold": 20 } }
   );
   ```
   Tổng sold = 90.
3. Thử giảm capacity thấp hơn sold:
   ```http
   PUT {{baseUrl}}/api/v1/venues/{{venueId_org}}
   Authorization: Bearer {{organizerToken}}
   Content-Type: application/json

   {
     "capacity": 80,
     "status": "active"
   }
   ```
   **Expect**: `400 Bad Request`
   ```json
   {
     "success": false,
     "message": "Capacity cannot be less than total tickets sold across events using this venue",
     "data": { "totalTicketsSold": 90 }
   }
   ```

### 2.4 Delete Guard
1. Tạo event pending sử dụng venue nếu chưa có. Ví dụ:
   ```http
   POST {{baseUrl}}/api/v1/events
   Authorization: Bearer {{organizerToken}}
   Content-Type: application/json

   {
     "title": "Deletion Guard Event",
     "description": "Pending event to test delete guard",
     "venue": { "venueId": "{{venueId_org}}" },
     "startDate": "2025-12-20T09:00:00.000Z",
     "endDate": "2025-12-20T12:00:00.000Z",
     "capacity": 200,
     "categories": ["testing"],
     "ticketTypes": [
       { "name": "Standard", "price": 30, "quantity": 150 },
       { "name": "VIP", "price": 80, "quantity": 50 }
     ]
   }
   ```
2. Thử xóa:
   ```http
   DELETE {{baseUrl}}/api/v1/venues/{{venueId_org}}
   Authorization: Bearer {{organizerToken}}
   ```
   **Expect**: `400 Bad Request` kèm thông tin event chặn.
3. Xóa hoặc hủy toàn bộ event đang pending/approved/ongoing (ví dụ `DELETE {{baseUrl}}/api/v1/events/{{eventId_guard}}` hoặc cập nhật status thành `cancelled`). Khi không còn event “active”, gọi lại:
   ```http
   DELETE {{baseUrl}}/api/v1/venues/{{venueId_org}}
   Authorization: Bearer {{organizerToken}}
   ```
   **Expect**: `200 OK`.

---

## 3. Admin Flow

### Admin
1. Register
   ```http
   POST {{baseUrl}}/api/v1/auth/register
   Content-Type: application/json

   {
     "name": "Admin User",
     "email": "admin@example.com",
     "password": "123456",
     "phone": "+84901234567"
   }
   ```
2. Promote role
   ```javascript
   db.users.updateOne(
     { email: "admin@example.com" },
     { $set: { role: "admin" } }
   );
   ```
3. Login and store `adminToken`
   ```http
   POST {{baseUrl}}/api/v1/auth/login
   Content-Type: application/json

   {
     "email": "admin@example.com",
     "password": "123456"
   }
   ```

> In Postman you can auto-save the token in Tests:  
> ```js
> const json = pm.response.json();
> if (json?.token) {
>   pm.environment.set('organizerToken', json.token); // or adminToken
> }
> ```


### 3.1 Create Venue
```http
POST {{baseUrl}}/api/v1/admin/venues
Authorization: Bearer {{adminToken}}
Content-Type: application/json

{
  "name": "Admin Convention Center",
  "address": "45 Nguyen Trai",
  "city": "Ho Chi Minh City",
  "country": "Vietnam",
  "capacity": 1200,
  "description": "Central hub",
  "status": "active",
  "amenities": ["parking", "wifi", "vip lounge"]
}
```
**Expect**: `201 Created`. Save `_id` → `{{venueId_admin}}`.

### 3.2 List & Detail
```http
GET {{baseUrl}}/api/v1/admin/venues?page=1&limit=10&status=active
Authorization: Bearer {{adminToken}}
```
```http
GET {{baseUrl}}/api/v1/admin/venues/{{venueId_admin}}
Authorization: Bearer {{adminToken}}
```
**Expect**: `200 OK`. Hiện chi tiết, decriptions,..

### 3.3 Update Venue
```http
PUT {{baseUrl}}/api/v1/admin/venues/{{venueId_admin}}
Authorization: Bearer {{adminToken}}
Content-Type: application/json

{
  "capacity": 1100,
  "status": "inactive",
  "description": "Temporarily closed for renovation"
}
```
**Expect**: `200 OK`. Guard capacity hoạt động tương tự organizer.

### 3.4 Delete Venue
1. Tạo (hoặc chọn) event pending sử dụng venue nếu chưa có:
   ```http
   POST {{baseUrl}}/api/v1/events
   Authorization: Bearer {{organizerToken}} // hoặc adminToken nếu gọi hộ organizer
   Content-Type: application/json

   {
     "title": "Admin Guard Event",
     "description": "Pending event for admin delete guard",
     "venue": { "venueId": "{{venueId_admin}}" },
     "startDate": "2025-12-22T09:00:00.000Z",
     "endDate": "2025-12-22T12:00:00.000Z",
     "capacity": 250,
     "ticketTypes": [
       { "name": "Standard", "price": 40, "quantity": 200 },
       { "name": "VIP", "price": 90, "quantity": 50 }
     ]
   }
   ```
   Lưu `_id` → `{{adminEventId_guard}}`.
2. Thử xóa:
   ```http
   DELETE {{baseUrl}}/api/v1/admin/venues/{{venueId_admin}}
   Authorization: Bearer {{adminToken}}
   ```
   **Expect**: `400 Bad Request` nếu vẫn còn event pending/approved/ongoing.
3. Xóa hoặc đổi trạng thái toàn bộ event “active” (ví dụ `DELETE /api/v1/events/{{adminEventId_guard}}` hoặc cập nhật status sang `cancelled`). Sau đó gọi lại DELETE:
   ```http
   DELETE {{baseUrl}}/api/v1/admin/venues/{{venueId_admin}}
   Authorization: Bearer {{adminToken}}
   ```
   **Expect**: `200 OK`.
4. Kiểm tra event cũ:
   ```http
   GET {{baseUrl}}/api/v1/events/{{adminEventId_guard}}
   Authorization: Bearer {{adminToken}}
   ```
   Đảm bảo `venueStatus` của event đã chuyển thành `"removed"`.

---

## 4. Regular User / Guest
- Đăng ký user:
  ```http
  POST {{baseUrl}}/api/v1/auth/register
  Content-Type: application/json

  {
    "name": "Regular User",
    "email": "user@example.com",
    "password": "123456",
    "phone": "+84907775544"
  }
  ```
- Đăng nhập lấy token (lưu `userToken`):
  ```http
  POST {{baseUrl}}/api/v1/auth/login
  Content-Type: application/json

  {
    "email": "user@example.com",
    "password": "123456"
  }
  ```
- `POST/PUT/DELETE /api/v1/venues` với token user → `403 Forbidden`.
- Không token → `401 Unauthorized`.
- `POST /api/v1/admin/venues` với token user → `403 Forbidden`.
- `GET /api/v1/venues` không token → `200 OK` (read-only).
- `POST/PUT/DELETE /api/v1/venues` với token user → `403 Forbidden`.
- Không token → `401 Unauthorized`.
- `POST /api/v1/admin/venues` với token user → `403 Forbidden`.
- `GET /api/v1/venues` không token → `200 OK` (read-only).

---

## 5. Troubleshooting
- `401 Unauthorized`: token thiếu hoặc hết hạn.
- `403 Forbidden`: chưa nâng role đúng (không phải organizer/admin).
- `400 Capacity cannot be less than total tickets sold...`: đang giảm capacity dưới số vé đã bán.
- `400 Cannot delete venue while events are pending, approved, or ongoing`: còn event “active” tham chiếu venue.

---

## 6. Endpoint Summary

| Role              | Method | Endpoint                        | Description                                 |
|------------------|--------|---------------------------------|---------------------------------------------|
| Organizer/Admin   | POST   | `/api/v1/venues`                | Create venue                                |
| Organizer/Admin   | GET    | `/api/v1/venues`                | List venues (public view)                   |
| Organizer/Admin   | GET    | `/api/v1/venues/:id`            | Venue detail                                |
| Organizer/Admin   | PUT    | `/api/v1/venues/:id`            | Update venue                                |
| Organizer/Admin   | DELETE | `/api/v1/venues/:id`            | Delete venue (guard active events)          |
| Admin             | GET    | `/api/v1/admin/venues`          | List all venues                             |
| Admin             | GET    | `/api/v1/admin/venues/:id`      | Venue detail                                |
| Admin             | POST   | `/api/v1/admin/venues`          | Create venue (global)                       |
| Admin             | PUT    | `/api/v1/admin/venues/:id`      | Update any venue                            |
| Admin             | DELETE | `/api/v1/admin/venues/:id`      | Delete venue (updates events to `removed`)  |

Thực hiện lần lượt các bước trên trong Postman để xác nhận toàn bộ luồng venue hoạt động đúng chuẩn hệ thống.***
