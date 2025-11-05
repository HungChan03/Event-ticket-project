const nodemailer = require('nodemailer');

const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
const smtpPort = parseInt(process.env.SMTP_PORT || '587');
const smtpUser = process.env.SMTP_USER || '';
const smtpPass = process.env.SMTP_PASS || '';
const fromEmail = process.env.MAIL_FROM || smtpUser || 'no-reply@example.com';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465, // true for 465, false for other ports
    auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
  });
  return transporter;
}

async function sendMail({ to, subject, html, text }) {
  const t = getTransporter();
  const info = await t.sendMail({ from: fromEmail, to, subject, html, text });
  return info;
}

function formatCurrencyVND(n) {
  try {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(n || 0));
  } catch (e) {
    return `${n} VND`;
  }
}

async function sendOrderReceipt(order, event, recipientEmail) {
  const itemsHtml = (order.items || [])
    .map(
      (it) => `
        <tr>
          <td style="padding:6px 8px;border:1px solid #eee">${it.ticketType}</td>
          <td style="padding:6px 8px;border:1px solid #eee">${it.quantity}</td>
          <td style="padding:6px 8px;border:1px solid #eee">${formatCurrencyVND(it.price)}</td>
          <td style="padding:6px 8px;border:1px solid #eee">${formatCurrencyVND((it.price || 0) * (it.quantity || 0))}</td>
        </tr>`
    )
    .join('');

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif">
    <h2>Hóa đơn thanh toán</h2>
    <p>Xin chào ${order?.buyerInfo?.name || ''},</p>
    <p>Đơn hàng ${order._id} cho sự kiện <strong>${event?.title || ''}</strong> đã thanh toán thành công.</p>
    <table style="border-collapse:collapse;border:1px solid #eee;margin-top:12px">
      <thead>
        <tr>
          <th style="padding:6px 8px;border:1px solid #eee;text-align:left">Loại vé</th>
          <th style="padding:6px 8px;border:1px solid #eee;text-align:right">Số lượng</th>
          <th style="padding:6px 8px;border:1px solid #eee;text-align:right">Đơn giá</th>
          <th style="padding:6px 8px;border:1px solid #eee;text-align:right">Thành tiền</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="padding:6px 8px;border:1px solid #eee;text-align:right">Tạm tính</td>
          <td style="padding:6px 8px;border:1px solid #eee;text-align:right">${formatCurrencyVND(order.subtotal)}</td>
        </tr>
        <tr>
          <td colspan="3" style="padding:6px 8px;border:1px solid #eee;text-align:right">Phí</td>
          <td style="padding:6px 8px;border:1px solid #eee;text-align:right">${formatCurrencyVND(order.fees)}</td>
        </tr>
        <tr>
          <td colspan="3" style="padding:6px 8px;border:1px solid #eee;text-align:right"><strong>Tổng thanh toán</strong></td>
          <td style="padding:6px 8px;border:1px solid #eee;text-align:right"><strong>${formatCurrencyVND(order.total)}</strong></td>
        </tr>
      </tfoot>
    </table>
    <p style="margin-top:16px">Cảm ơn bạn đã mua vé!</p>
  </div>`;

  const subject = `Hóa đơn thanh toán - Đơn ${order._id}`;
  return sendMail({ to: recipientEmail, subject, html });
}

module.exports = { sendMail, sendOrderReceipt };
