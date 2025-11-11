const https = require("https");
const crypto = require("crypto");
const Order = require("../models/Order");
const axios = require("axios");
const Event = require("../models/Event");
const Ticket = require("../models/Ticket");
const { sendOrderReceipt } = require("../utils/mailer");
const { uploadQrImageToCloudinary, generateRandomQrPayload } = require("../utils/generateQRCode");

// Env configuration with sensible defaults for MoMo UAT
const MOMO_PARTNER_CODE = process.env.MOMO_PARTNER_CODE || "MOMO";
const MOMO_ACCESS_KEY = process.env.MOMO_ACCESS_KEY || "F8BBA842ECF85";
const MOMO_SECRET_KEY = process.env.MOMO_SECRET_KEY || "K951B6PE1waDMi640xX08PD3vg6EkVlz";
const MOMO_ENDPOINT = process.env.MOMO_ENDPOINT || "test-payment.momo.vn"; // host only
const MOMO_CREATE_PATH = process.env.MOMO_CREATE_PATH || "/v2/gateway/api/create";
const BASE_URL = process.env.BASE_URL || "http://localhost:5000";
const MOMO_REDIRECT_URL = process.env.MOMO_REDIRECT_URL || `${BASE_URL}/api/v1/orders/momo/return`;
const MOMO_IPN_URL = process.env.MOMO_IPN_URL || '';

function hmacSha256Hex(secret, data) {
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

// Increment sold counts for event ticket types based on items
async function incrementEventSold(eventId, items) {
  for (const it of items) {
    const qty = Number(it.quantity || 0);
    if (qty <= 0) continue;
    // Best-effort atomic increment for matching ticket type
    await Event.updateOne(
      { _id: eventId },
      { $inc: { 'ticketTypes.$[t].sold': qty } },
      { arrayFilters: [{ 't.name': it.ticketType }] }
    );
  }
}

// Build raw signature for create request (per MoMo docs v2 captureWallet)
function buildCreateSignature({
  accessKey,
  amount,
  extraData,
  ipnUrl,
  orderId,
  orderInfo,
  partnerCode,
  redirectUrl,
  requestId,
  requestType,
}) {
  return `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;
}

// POST /api/v1/orders
// Body: { items: [{ticketType, quantity}], event, buyerInfo }
exports.createOrder = async (req, res) => {
  try {
    if (!req.body.event) return res.status(400).json({ message: "Missing event" });
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items.length) return res.status(400).json({ message: "Items required" });

    const event = await Event.findById(req.body.event).lean();
    if (!event) return res.status(404).json({ message: "Event not found" });
    if (event.status !== "approved") return res.status(400).json({ message: "Event not approved" });

    let subtotal = 0;
    const normalized = [];
    for (const it of items) {
      const tt = event.ticketTypes.find((t) => t.name === it.ticketType);
      const qty = Number(it?.quantity || 0);
      if (!tt || qty <= 0) return res.status(400).json({ message: "Invalid ticketType or quantity" });
      const remaining = (tt.quantity || 0) - (tt.sold || 0);
      if (qty > remaining) {
        return res.status(400).json({ message: `Not enough '${tt.name}' tickets. Remaining: ${remaining}` });
      }
      subtotal += tt.price * qty;
      normalized.push({ ticketType: tt.name, price: tt.price, quantity: qty });
    }
    const fees = 0;
    const total = subtotal + fees;

    const orderDoc = await Order.create({
      buyer: req.user?._id || undefined,
      event: event._id,
      items: normalized,
      subtotal,
      fees,
      total,
      payment: { method: "momo", status: "pending" },
      status: "processing",
      buyerInfo: req.body.buyerInfo || {},
      expiresAt: new Date(Date.now() + (parseInt(process.env.ORDER_EXPIRE_MIN || "15") * 60 * 1000)),
    }).catch(() => null);

    if (!orderDoc) return res.status(500).json({ message: "Create order failed" });

    return res.status(201).json({ message: "Order created", orderId: orderDoc._id, total });
  } catch (err) {
    return res.status(500).json({ message: "Create order failed", error: err.message });
  }
};


// POST /api/v1/orders/:id/cancel
// User cancels an unpaid order they own
exports.cancelOrderForUser = async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findById(orderId).catch(() => null);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (!req.user?._id || String(order.buyer) !== String(req.user._id)) {
      return res.status(403).json({ message: "Not allowed" });
    }

    if (order.status === "cancelled") {
      return res.status(409).json({ message: "Order already cancelled" });
    }
    if (order.payment?.status === "paid") {
      return res.status(409).json({ message: "Order already paid" });
    }

    // If expired, keep semantics as cancelled
    if (order.expiresAt && Date.now() > new Date(order.expiresAt).getTime()) {
      order.status = "cancelled";
      if (order.payment?.status === "pending") order.payment.status = "failed";
      await order.save().catch(() => {});
      return res.json({ message: "Order expired and cancelled" });
    }

    order.status = "cancelled";
    if (order.payment?.status === "pending") order.payment.status = "failed";
    await order.save().catch(() => {});
    return res.json({ message: "Order cancelled" });
  } catch (err) {
    return res.status(500).json({ message: "Cancel order failed", error: err.message });
  }
};

/**
 * Tạo vé  tương ứng cho đơn hàng (order) sau khi thanh toán thành công.
 * 
 * @param {*} orderDoc - Document (object) của đơn hàng (Order) đã được lưu trong MongoDB.
 * @returns {Promise<void>} - Không trả về giá trị, chỉ thực hiện thao tác tạo vé và cập nhật order.
 */
async function issueTicketsForOrder(orderDoc) {
  if (!orderDoc || !orderDoc.items || !orderDoc.event) return;
  const existingCount = Array.isArray(orderDoc.ticketRefs) ? orderDoc.ticketRefs.length : 0;
  let shouldCreate = 0;
  orderDoc.items.forEach((it) => (shouldCreate += Number(it.quantity || 0)));
  if (existingCount >= shouldCreate) return;
  const tickets = [];
  for (const it of orderDoc.items) {
    for (let i = 0; i < it.quantity; i++) {
      const qr = generateRandomQrPayload(16);
      let qrImageUrl = null;
      try {
        qrImageUrl = await uploadQrImageToCloudinary(qr, { folder: `tickets/${orderDoc.event.toString()}` });
      } catch (_) {}
      const t = await Ticket.create({
        event: orderDoc.event,
        order: orderDoc._id,
        owner: orderDoc.buyer || undefined,
        ticketType: it.ticketType,
        pricePaid: it.price,
        qrCode: qr,
        qrImageUrl,
        status: "valid",
      });
      tickets.push(t._id);
    }
  }
  orderDoc.ticketRefs = [...(orderDoc.ticketRefs || []), ...tickets];
  await orderDoc.save();
}

// POST /api/v1/orders/momo/pay
// Body: { orderId, amount? }
exports.payOrderWithMomo = async (req, res) => {
  try {
    const orderId = req.body.orderId;
    const orderDoc = await Order.findById(orderId).catch(() => null);
    if (!orderDoc) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (orderDoc.payment?.status === "paid") {
      return res.status(409).json({ message: "Order already paid" });
    }
    if (orderDoc.expiresAt && Date.now() > new Date(orderDoc.expiresAt).getTime()) {
      // auto-cancel expired pending orders
      orderDoc.status = "cancelled";
      if (orderDoc.payment?.status === "pending") orderDoc.payment.status = "failed";
      await orderDoc.save().catch(() => {});
      return res.status(410).json({ message: "Order expired and cancelled" });
    }

    const amountStr = String(req.body.amount || orderDoc.total || "0");
    if (!amountStr || isNaN(Number(amountStr)) || Number(amountStr) <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    const requestId = `${MOMO_PARTNER_CODE}${Date.now()}`;
    const orderInfo = `Pay for order #${orderId}`;
    const extraData = ""; // optional base64 string
    const requestType = "captureWallet";
    const EFFECTIVE_IPN_URL = MOMO_IPN_URL || MOMO_REDIRECT_URL;
    const rawSignature = buildCreateSignature({
      accessKey: MOMO_ACCESS_KEY,
      amount: amountStr,
      extraData,
      ipnUrl: EFFECTIVE_IPN_URL,
      orderId: orderDoc._id.toString(),
      orderInfo,
      partnerCode: MOMO_PARTNER_CODE,
      redirectUrl: MOMO_REDIRECT_URL,
      requestId,
      requestType,
    });

    const signature = hmacSha256Hex(MOMO_SECRET_KEY, rawSignature);

    const payloadObj = {
      partnerCode: MOMO_PARTNER_CODE,
      accessKey: MOMO_ACCESS_KEY,
      requestId,
      amount: amountStr,
      orderId: orderDoc._id.toString(),
      orderInfo,
      redirectUrl: MOMO_REDIRECT_URL,
      ipnUrl: EFFECTIVE_IPN_URL,
      extraData,
      requestType,
      signature,
      lang: "vi",
    };

    const fullUrl = process.env.MOMO_FULL_CREATE_URL || `https://${MOMO_ENDPOINT}${MOMO_CREATE_PATH}`;

    try {
      const { data: json } = await axios.post(fullUrl, payloadObj, {
        headers: { "Content-Type": "application/json" },
        timeout: 15000,
      });
      orderDoc.payment.providerData = json;
      await orderDoc.save().catch(() => {});
      return res.status(201).json({
        message: "MoMo payment created",
        payUrl: json.payUrl || json.deeplink,
        result: json,
        orderId: orderDoc._id,
      });
    } catch (e) {
      return res.status(502).json({ message: "MoMo request error", error: e?.message, details: e?.response?.data });
    }
  } catch (err) {
    return res.status(500).json({ message: "Pay order with MoMo failed", error: err.message });
  }
};


// GET /api/v1/orders/momo/return
// MoMo redirects user here after payment
exports.momoReturn = async (req, res) => {
  try {
    const { resultCode, message, amount, orderId, requestId, transId } = req.query || {};

    // Update local order (best-effort by providerData.orderId or linked localOrderId if you passed it as orderId)
    const orderDoc = await Order.findOne({
      $or: [
        { "payment.providerData.orderId": orderId },
        { _id: orderId }, // if client used localOrderId as orderId
      ],
    }).catch(() => null);

    if (String(resultCode) === "0") {
      if (orderDoc) {
        const alreadyPaid = orderDoc.payment?.status === "paid";
        orderDoc.payment.status = "paid";
        orderDoc.payment.paidAt = orderDoc.payment.paidAt || new Date();
        orderDoc.status = "completed";
        orderDoc.payment.providerData = { ...(orderDoc.payment.providerData || {}), ...req.query };
        await orderDoc.save().catch(() => {});
        if (!alreadyPaid) {
          await issueTicketsForOrder(orderDoc).catch(() => {});
          await incrementEventSold(orderDoc.event, orderDoc.items).catch(() => {});
          // send receipt email once
          if (!orderDoc.emailSentAt) {
            try {
              const evt = await Event.findById(orderDoc.event).lean();
              const to = orderDoc?.buyerInfo?.email || process.env.RECEIPT_TEST_TO || null;
              if (to) {
                await sendOrderReceipt(orderDoc.toObject ? orderDoc.toObject() : orderDoc, evt, to);
                orderDoc.emailSentAt = new Date();
                await orderDoc.save().catch(() => {});
              }
            } catch (_) {}
          }
        }
      }
      return res.json({ success: true, message: message || "Payment successful", amount, orderId, requestId, transId });
    }

    if (orderDoc) {
      orderDoc.payment.status = "failed";
      // User canceled on MoMo screen -> cancel order
      orderDoc.status = "cancelled";
      orderDoc.payment.providerData = { ...(orderDoc.payment.providerData || {}), ...req.query };
      await orderDoc.save().catch(() => {});
    }

    return res.status(400).json({ success: false, message: message || "Payment failed", resultCode, orderId, requestId });
  } catch (err) {
    return res.status(500).json({ message: "Handle MoMo return failed", error: err.message });
  }
};


exports.getMyOrders = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const page = Math.max(1, parseInt(req.query.page || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || "20")));
    const skip = (page - 1) * limit;
    const [docs, total] = await Promise.all([
      Order.find({ buyer: userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Order.countDocuments({ buyer: userId }),
    ]);
    const now = Date.now();
    const items = docs.map((o) => ({
      ...o,
      expired: !!(o.expiresAt && now > new Date(o.expiresAt).getTime()),
    }));
    return res.json({ items, total, page, limit });
  } catch (err) {
    return res.status(500).json({ message: "Get orders failed", error: err.message });
  }
};

exports.getMyOrderById = async (req, res) => {
  try {
    const id = req.params.id;
    const orderDoc = await Order.findById(id).lean();
    if (!orderDoc) return res.status(404).json({ message: "Order not found" });
    if (String(orderDoc.buyer) !== String(req.user?._id)) return res.status(403).json({ message: "Not allowed" });
    const expired = !!(orderDoc.expiresAt && Date.now() > new Date(orderDoc.expiresAt).getTime());
    return res.json({ ...orderDoc, expired });
  } catch (err) {
    return res.status(500).json({ message: "Get order failed", error: err.message });
  }
};

exports.updateOrderForUser = async (req, res) => {
  try {
    const id = req.params.id;
    const order = await Order.findById(id).catch(() => null);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (String(order.buyer) !== String(req.user?._id)) return res.status(403).json({ message: "Not allowed" });
    if (order.status === "cancelled" || order.status === "completed") return res.status(409).json({ message: "Order is not editable" });
    if (order.payment?.status === "paid") return res.status(409).json({ message: "Order already paid" });
    if (order.expiresAt && Date.now() > new Date(order.expiresAt).getTime()) return res.status(410).json({ message: "Order expired" });

    let updatedItems = order.items;
    let subtotal = order.subtotal;
    const itemsInput = Array.isArray(req.body.items) ? req.body.items : null;
    if (itemsInput) {
      const event = await Event.findById(order.event).lean();
      if (!event) return res.status(400).json({ message: "Event not found" });
      let newSubtotal = 0;
      const normalized = [];
      for (const it of itemsInput) {
        const tt = event.ticketTypes.find((t) => t.name === it.ticketType);
        const qty = Number(it?.quantity || 0);
        if (!tt || qty <= 0) return res.status(400).json({ message: "Invalid ticketType or quantity" });
        const remaining = (tt.quantity || 0) - (tt.sold || 0);
        if (qty > remaining) return res.status(400).json({ message: `Not enough '${tt.name}' tickets. Remaining: ${remaining}` });
        newSubtotal += tt.price * qty;
        normalized.push({ ticketType: tt.name, price: tt.price, quantity: qty });
      }
      updatedItems = normalized;
      subtotal = newSubtotal;
    }

    const buyerInfo = req.body.buyerInfo ? { ...order.buyerInfo, ...req.body.buyerInfo } : order.buyerInfo;
    const fees = order.fees || 0;
    const total = subtotal + fees;

    order.items = updatedItems;
    order.subtotal = subtotal;
    order.total = total;
    order.buyerInfo = buyerInfo;

    await order.save().catch(() => {});
    return res.json({ message: "Order updated", order });
  } catch (err) {
    return res.status(500).json({ message: "Update order failed", error: err.message });
  }
};

