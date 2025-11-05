## Hướng dẫn Postman: Mua vé → Sinh QR → Xem vé → Trạng thái → Check-in

Tài liệu này hướng dẫn kiểm thử toàn bộ luồng vé trên Postman, liên kết chặt với `Event` và `User`:

- Người dùng mua vé → hệ thống sinh mã QR
- Xem các vé đã mua
- Trạng thái vé: `valid`, `cancelled`, `used`
- Check-in bằng cách quét QR (Organizer/Admin)


### 1) Tạo đơn hàng (Buyer)
Endpoint: `POST {{baseUrl}}/api/v1/orders`

Headers:
- `Authorization: Bearer {{userToken}}`
- `Content-Type: application/json`

Body (raw JSON):
```json
{
  "event": "{{eventId}}",
  "items": [
    { "ticketType": "Standard", "quantity": 2 },
    { "ticketType": "VIP", "quantity": 1 }
  ],
  "buyerInfo": {
    "name": "Nguyen Van A",
    "email": "buyer@example.com",
    "phone": "0123456789"
  }
}
```

Kỳ vọng phản hồi 201:
```json
{
  "message": "Order created",
  "orderId": "<ObjectId>",
  "total": 300000
}
```
Lưu `orderId` vào `{{orderId}}` trong Postman.

Ghi chú:
- Kiểm tra tồn (remaining) theo từng loại vé.
- Trạng thái order ban đầu `processing`, trạng thái thanh toán `pending`.

---

### 2) Tạo thanh toán MoMo cho Order đã có (Buyer)
Endpoint: `POST {{baseUrl}}/api/v1/orders/momo/pay`

Headers:
- `Authorization: Bearer {{userToken}}`
- `Content-Type: application/json`

Body:
```json
{
  "orderId": "{{orderId}}"
}
```

Kỳ vọng phản hồi 201:
```json
{
  "message": "MoMo payment created",
  "payUrl": "https://...",
  "result": { "partnerCode": "...", "requestId": "...", "orderId": "..." },
  "orderId": "{{orderId}}"
}
```

Mở `payUrl` để mô phỏng thanh toán. Ở môi trường UAT bạn có thể được redirect về `GET /api/v1/orders/momo/return`.

Phương án thay thế (tạo order nội bộ tối thiểu nếu cần):

Endpoint: `POST {{baseUrl}}/api/v1/orders/momo/create`
```json
{
  "amount": 100000,
  "orderInfo": "Pay with MoMo",
  "event": "{{eventId}}",
  "items": [{ "ticketType": "Standard", "quantity": 1 }],
  "buyerInfo": {"email": "buyer@example.com"}
}
```
Phản hồi sẽ có `localOrderId` để bạn lưu vào `{{localOrderId}}`.

---

### 3) MoMo Return & IPN (Callback hệ thống)

Khi thanh toán thành công, hệ thống cập nhật order và phát hành vé theo cả hai luồng:
- `GET {{baseUrl}}/api/v1/orders/momo/return?resultCode=0&orderId={{orderId}}&amount=...`
- `POST {{baseUrl}}/api/v1/orders/momo/ipn` với body:
```json
{
  "resultCode": 0,
  "orderId": "{{orderId}}",
  "amount": 300000,
  "message": "Successful"
}
```

Khi thành công:
- Trạng thái thanh toán của order → `paid`, trạng thái order → `completed`
- Vé được tạo với `status: "valid"`, có `qrCode` và `qrImageUrl`----------
- Tăng `ticketTypes.sold` cho Event
- Có thể gửi email hoá đơn nếu cấu hình

Lưu ý: Nếu test thủ công không dùng MoMo, bạn có thể gọi trực tiếp IPN ở trên để mô phỏng thành công.

---

### 4) Danh sách vé của tôi (Buyer)
Endpoint: `GET {{baseUrl}}/api/v1/tickets/history`-----------------

Headers:
- `Authorization: Bearer {{userToken}}`

Kỳ vọng phản hồi 200:
```json
{
  "count": 3,
  "tickets": [
    {
      "id": "<ticketId>",
      "event": {"_id": "{{eventId}}", "title": "..."},
      "ticketType": "Standard",
      "seat": null,
      "pricePaid": 100000,
      "status": "valid",
      "purchasedAt": "2025-11-05T10:00:00.000Z",
      "qrCode": "ABC123...",
      "qrImageUrl": "https://res.cloudinary.com/..."
    }
  ]
}
```

Chọn một vé và lưu `id` vào `{{ticketId}}`, `qrCode` vào `{{qrCode}}`.

---

### 5) Xem chi tiết vé (Buyer/Organizer/Admin)
Endpoint: `GET {{baseUrl}}/api/v1/tickets/{{ticketId}}`------------------

Headers:
- `Authorization: Bearer {{userToken}}` (chủ sở hữu) hoặc `{{organizerToken}}` (organizer/admin của event)

Kỳ vọng phản hồi 200:
```json
{
  "ticket": {
    "_id": "{{ticketId}}",
    "event": {"_id": "{{eventId}}", "title": "...", "organizer": "<userId>"},
    "owner": "<buyerId>",
    "order": "<orderId>",
    "ticketType": "Standard",
    "pricePaid": 100000,
    "status": "valid",
    "qrCode": "{{qrCode}}",
    "qrImageUrl": "https://res.cloudinary.com/..."
  }
}
```

---

### 6) Lấy ảnh QR (Buyer/Organizer/Admin)
Endpoint: `GET {{baseUrl}}/api/v1/tickets/{{ticketId}}/qr?redirect=0`----------------

Headers:
- `Authorization: Bearer {{userToken}}` hoặc `{{organizerToken}}`

Kỳ vọng phản hồi 200 (khi `redirect=0`):
```json
{
  "qrImageUrl": "https://res.cloudinary.com/...",
  "source": "cloudinary"
}
```

Lưu ý: Nếu không truyền `redirect=0`, endpoint sẽ redirect trực tiếp đến URL ảnh QR.

---

### 7) Hủy vé của tôi (Buyer)
Endpoint: `POST {{baseUrl}}/api/v1/tickets/{{ticketId}}/cancel`----------------

Headers:
- `Authorization: Bearer {{userToken}}`

Kỳ vọng phản hồi 200:
```json
{ "message": "Ticket cancelled", "ticket": { "_id": "{{ticketId}}", "status": "cancelled" } }
```

Các trường hợp xung đột:
- Đã huỷ trước đó → 409
- Đã sử dụng → 409

---

### 8) Organizer: Danh sách vé theo sự kiện
Endpoint: `GET {{baseUrl}}/api/v1/tickets/event/{{eventId}}`---------------

Headers:
- `Authorization: Bearer {{organizerToken}}`

Kỳ vọng phản hồi 200:
```json
{
  "count": 3,
  "tickets": [
    { "_id": "<ticketId>", "owner": { "name": "Nguyen Van A", "email": "buyer@example.com" }, "status": "valid" }
  ]
}
```

---

### 9) Organizer/Admin: Check-in bằng QR
Endpoint: `POST {{baseUrl}}/api/v1/tickets/checkin`----------------

Headers:
- `Authorization: Bearer {{organizerToken}}`
- `Content-Type: application/json`

Body:
```json
{ "qrCode": "{{qrCode}}" }
```

Kỳ vọng phản hồi 200:
```json
{
  "message": "Check-in success",
  "ticket": {
    "id": "{{ticketId}}",
    "status": "used",
    "event": { "title": "..." },
    "ticketType": "Standard",
    "pricePaid": 100000,
    "qrCode": "{{qrCode}}"
  },
  "user": { "id": "<buyerId>", "name": "Nguyen Van A", "email": "buyer@example.com", "phone": null }
}
```

Các trường hợp xung đột:
- Vé `used` → 409, message `Ticket already used`
- Vé `cancelled` → 409, message `Ticket is cancelled`
- Không phải organizer/admin → 403

---

Ghi chú:
- Đã thanh toán → 409
- Order pending đã hết hạn → trả về `Order expired and cancelled`

---

### Lỗi thường gặp
- 401 Unauthorized: Thiếu/sai token `Authorization`.
- 403 Forbidden: Không đủ quyền (không phải owner/organizer/admin tương ứng).
- 404 Not found: Sai `eventId`, `ticketId`, hoặc `orderId`.
- 409 Conflict: Xung đột nghiệp vụ (đã paid/used/cancelled, không đủ số lượng vé còn lại).
- 400 Bad request: Thiếu trường bắt buộc hoặc payload không hợp lệ.