# Order & Payment Test Guide

Module này hướng dẫn test nhanh quy trình mua vé, thanh toán MoMo, hủy đơn, kiểm tra tồn kho và email biên nhận bằng Postman.

## Chuẩn bị
- Server chạy tại: `http://localhost:5000`
- Base API: `http://localhost:5000/api/v1`
- Có sẵn 1 Event đã `approved` (ghi lại `EVENT_ID`).
- Đăng ký/đăng nhập lấy Bearer token (vai trò user). Header dùng chung:
  - `Authorization: Bearer <USER_TOKEN>`
  - `Content-Type: application/json`
- (Tuỳ chọn) .env cho email biên nhận:
  - `SMTP_HOST=smtp.gmail.com`
  - `SMTP_PORT=587`
  - `SMTP_USER=<gmail>`
  - `SMTP_PASS=<app_password_16_chars>`
  - `MAIL_FROM=<gmail>` hoặc `Event Ticket <gmail>`
  - `RECEIPT_TEST_TO=<email_fallback>`
- (Tuỳ chọn) Thời hạn đơn: `ORDER_EXPIRE_MIN=1` để test hết hạn nhanh.

---

## 1) Tạo Order
- Endpoint: `POST /api/v1/orders`
- Body ví dụ:
```json
{
  "event": "<EVENT_ID>",
  "items": [
    { "ticketType": "Standard", "quantity": 2 }
  ],
  "buyerInfo": { "name": "Nguyen Van A", "email": "abc@gmail.com" }
}
```
- Response 201:
```json
{
  "message": "Order created",
  "orderId": "<ORDER_ID>",
  "total": 2000
}
```

Lưu `orderId` để dùng cho bước thanh toán/hủy.

Ghi chú:
- Server đã kiểm tra tồn kho và tính `total` dựa theo `ticketTypes` của Event.
- Mỗi order có `expiresAt = now + ORDER_EXPIRE_MIN (mặc định 15 phút)`.

---

## 2) Lấy link thanh toán MoMo
- Endpoint: `POST /api/v1/orders/momo/pay`
- Body:
```json
{ "orderId": "<ORDER_ID>" }
```
- Response 201:
```json
{
  "message": "MoMo payment created",
  "payUrl": "https://test-payment.momo.vn/v2/gateway/pay?...",
  "result": { "resultCode": 0, "payUrl": "...", "deeplink": "...", "qrCodeUrl": "..." },
  "orderId": "<ORDER_ID>"
}
```
- Mở `payUrl` trên trình duyệt để quét QR bằng app MoMo. Bạn có thể nhấn Hủy trong app MoMo để test hủy giao dịch.

Lưu ý:
- Nếu đơn đã quá hạn: trả 410 `Order expired and cancelled`.
- Nếu đơn đã thanh toán/cancelled: trả 409.

---

## 3) Kết quả thanh toán
- Thành công: hệ thống sẽ
  - Đánh dấu `payment.status = paid`, `order.status = completed`, set `paidAt`.
  - Phát hành vé (`ticketRefs`).
  - Tăng `sold` cho loại vé tương ứng.
  - Gửi email biên nhận đến `buyerInfo.email` hoặc `RECEIPT_TEST_TO` (nếu thiếu), tránh gửi trùng bằng `emailSentAt`.
- Thất bại hoặc người dùng bấm Hủy trong MoMo:
  - `payment.status = failed`, `order.status = cancelled`.

---

## 4) Hủy đơn thủ công (User)
- Endpoint: `POST /api/v1/orders/:id/cancel`
- Ví dụ: `POST /api/v1/orders/<ORDER_ID>/cancel`
- Yêu cầu: Bearer token của chủ sở hữu order.
- Điều kiện thành công: order chưa `paid` và chưa `cancelled`.
- Nếu order đã hết hạn: API cũng trả "Order expired and cancelled".

---

## 5) Kiểm tra tồn kho Event
- Endpoint: `GET /api/v1/events/:id`
- Ví dụ: `GET /api/v1/events/<EVENT_ID>`
- Response có bổ sung field tính toán:
  - `data.ticketTypes[*].remaining = quantity - sold`
  - `data.totals = { capacity, sold, remaining }`

Sau khi thanh toán thành công 2 vé VIP, bạn sẽ thấy `VIP.sold` tăng lên và `remaining` giảm tương ứng.

---

## 6) Test tự hết hạn
- Đặt `ORDER_EXPIRE_MIN=1` trong .env, restart server.
- Tạo order → đợi >1 phút.
- Gọi `POST /api/v1/orders/momo/pay` với `orderId` vừa tạo → nhận 410 `Order expired and cancelled`.

---

## 7) Gợi ý kiểm tra nhanh (cURL)
```bash
# 1) Create order
curl -X POST http://localhost:5000/api/v1/orders \
  -H "Authorization: Bearer <USER_TOKEN>" -H "Content-Type: application/json" \
  -d '{
    "event":"<EVENT_ID>",
    "items":[{"ticketType":"Standard","quantity":2}],
    "buyerInfo":{"name":"Buyer A","email":"lycuu9@gmail.com"}
  }'

# 2) Pay
curl -X POST http://localhost:5000/api/v1/orders/momo/pay \
  -H "Authorization: Bearer <USER_TOKEN>" -H "Content-Type: application/json" \
  -d '{"orderId":"<ORDER_ID>"}'

# 3) Cancel (optional)
curl -X POST http://localhost:5000/api/v1/orders/<ORDER_ID>/cancel \
  -H "Authorization: Bearer <USER_TOKEN>"

# 4) Check event
curl http://localhost:5000/api/v1/events/<EVENT_ID>
```

---

## Troubleshooting
- 409 Already paid/cancelled: tạo order mới hoặc kiểm tra trạng thái hiện tại.
- 410 Expired: tăng `ORDER_EXPIRE_MIN` hoặc tạo lại order.
- Không thấy email: kiểm tra .env SMTP, App Password Gmail, thư mục Spam, và log server.
- Event chưa approved: không tạo được order hợp lệ.

---

## Ghi chú
- Admin cancel nâng cao (khôi phục tồn kho, hủy vé) có thể bổ sung endpoint riêng.
- IPN đã xử lý success; nếu không dùng IPN, redirect return đã đủ cập nhật và phát hành vé.
