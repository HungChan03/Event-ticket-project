const Ticket = require("../models/Ticket");
const Event = require("../models/Event");
const mongoose = require("mongoose");

/**
 *  /api/tickets/history
 *  Chỉ dành cho user đã đăng nhập.
 * - Tìm tất cả vé có owner = user hiện tại
 * - Populate thông tin event (tên, ngày, địa điểm, organizer)
 * - Trả về danh sách vé có QR code, trạng thái, giá, ...
 */
exports.getMyTickets = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const tickets = await Ticket.find({ owner: userId })
      .populate({ path: "event", select: "title startDate endDate venue organizer" })
      .sort({ createdAt: -1 });

    //chuẩn hóa dữ liệu vé trả về
    const history = tickets.map((t) => ({
      id: t._id,
      event: t.event,
      ticketType: t.ticketType,
      seat: t.seat,
      pricePaid: t.pricePaid,
      status: t.status,
      purchasedAt: t.purchasedAt,
      qrCode: t.qrCode || null,
      qrImageUrl: t.qrImageUrl || null,
    }));

    return res.json({ count: history.length, tickets: history });
  } catch (err) {
    return res.status(500).json({ message: "Fetch my tickets failed", error: err.message });
  }
};

/**
 *  /api/tickets/:id
 * - Dành cho user sở hữu vé đó, organizer của event, hoặc admin.
 * - Populate event để lấy thông tin người tổ chức.
 */
exports.getTicketById = async (req, res) => {
  try {
    const id = req.params.id;
    const doc = await Ticket.findById(id).populate({ path: "event", select: "title organizer" });
    if (!doc) return res.status(404).json({ message: "Ticket not found" });

    //xác định role
    const isOwner = req.user && String(doc.owner) === String(req.user._id);
    const isAdmin = req.user && req.user.role === "admin";
    let isOrganizer = false;
    if (doc.event && req.user) {
      isOrganizer = String(doc.event.organizer) === String(req.user._id) || isAdmin;
    }
    if (!isOwner && !isOrganizer && !isAdmin) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return res.json({ ticket: doc });
  } catch (err) {
    return res.status(500).json({ message: "Fetch ticket failed", error: err.message });
  }
};

/**
  * /api/tickets/:id/qr
 * - Chỉ người sở hữu, organizer hoặc admin mới được xem.
 * - Nếu `redirect=1` (mặc định) → redirect sang ảnh Cloudinary.
 * - Nếu `redirect=0` → trả JSON chứa URL QR.
 */
exports.getTicketQrImage = async (req, res) => {
  try {
    const id = req.params.id;
    const isObjectId = mongoose.Types.ObjectId.isValid(String(id));
    const doc = isObjectId
      ? await Ticket.findById(id).populate({ path: "event", select: "organizer" })
      : await Ticket.findOne({ qrCode: id }).populate({ path: "event", select: "organizer" });
    if (!doc) return res.status(404).json({ message: "Ticket not found" });

    //xác thực role
    const isOwner = req.user && String(doc.owner) === String(req.user._id);
    const isAdmin = req.user && req.user.role === "admin";
    const isOrganizer = req.user && doc.event && String(doc.event.organizer) === String(req.user._id);
    if (!isOwner && !isOrganizer && !isAdmin) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (!doc.qrImageUrl) {
      return res.status(400).json({ message: "Ticket has no QR image yet" });
    }
    if (String(req.query.redirect || "1") !== "0") {
      return res.redirect(doc.qrImageUrl);
    }
    return res.json({ qrImageUrl: doc.qrImageUrl, source: "cloudinary" });
  } catch (err) {
    return res.status(500).json({ message: "Get QR image failed", error: err.message });
  }
};

/**
 * /api/tickets/:id/cancel
 * - Chỉ chủ sở hữu vé được quyền hủy.
 * - Không thể hủy vé đã dùng hoặc đã hủy.
 */
exports.cancelMyTicket = async (req, res) => {
  try {
    const id = req.params.id;
    const doc = await Ticket.findById(id);
    if (!doc) return res.status(404).json({ message: "Ticket not found" });

    if (!req.user || String(doc.owner) !== String(req.user._id)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (doc.status === "cancelled") return res.status(409).json({ message: "Ticket already cancelled" });
    if (doc.status === "used") return res.status(409).json({ message: "Used ticket cannot be cancelled" });

    doc.status = "cancelled";
    await doc.save();
    return res.json({ message: "Ticket cancelled", ticket: doc });
  } catch (err) {
    return res.status(500).json({ message: "Cancel ticket failed", error: err.message });
  }
};

/**
 * /api/tickets/checkin
 * - Dành cho organizer hoặc admin quét vé người dùng tại sự kiện.
 * - Kiểm tra QR code hợp lệ → cập nhật vé thành "used".
 * - Trả về thông tin vé & người sở hữu để hiển thị trên màn hình check-in.
 */
exports.checkInByQr = async (req, res) => {
  try {
    const qr = String(req.body?.qrCode || req.body?.qr || "").trim();
    if (!qr) return res.status(400).json({ message: "qrCode is required" });

    const ticket = await Ticket.findOne({ qrCode: qr })
      .populate({ path: "event", select: "organizer title startDate endDate" })
      .populate({ path: "owner", select: "name email phone" });
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    const isAdmin = req.user && req.user.role === "admin";
    const isOrganizer = req.user && ticket.event && String(ticket.event.organizer) === String(req.user._id);
    if (!isAdmin && !isOrganizer) {
      return res.status(403).json({ message: "Only organizer/admin can check in" });
    }

    if (ticket.status === "used") {
      return res.status(409).json({ message: "Ticket already used", ticket });
    }
    if (ticket.status === "cancelled") {
      return res.status(409).json({ message: "Ticket is cancelled", ticket });
    }

    ticket.status = "used";
    await ticket.save();

    return res.json({
      message: "Check-in success",
      ticket: {
        id: ticket._id,
        status: ticket.status,
        event: ticket.event,
        ticketType: ticket.ticketType,
        pricePaid: ticket.pricePaid,
        qrCode: ticket.qrCode,
      },
      user: ticket.owner
        ? { id: ticket.owner._id, name: ticket.owner.name, email: ticket.owner.email, phone: ticket.owner.phone || null }
        : null,
    });
  } catch (err) {
    return res.status(500).json({ message: "Check-in failed", error: err.message });
  }
};

/**
  * /api/tickets/event/:eventId
 * - Chỉ Organizer hoặc Admin được xem.
 * - Liệt kê toàn bộ vé thuộc sự kiện đó.
 */
exports.listTicketsForEvent = async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const event = await Event.findById(eventId).select("organizer title");
    if (!event) return res.status(404).json({ message: "Event not found" });

    const isAdmin = req.user && req.user.role === "admin";
    const isOrganizer = req.user && String(event.organizer) === String(req.user._id);
    if (!isAdmin && !isOrganizer) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const tickets = await Ticket.find({ event: eventId }).populate({ path: "owner", select: "name email" });
    return res.json({ count: tickets.length, tickets });
  } catch (err) {
    return res.status(500).json({ message: "List tickets failed", error: err.message });
  }
};


