const crypto = require("crypto");
const QRCode = require("qrcode");
const cloudinary = require("../config/cloudinaryConfig");

/**
 * Func payload ngẫu nhiên nhúng vào qrcode
 * @param {*} numBytes - 16bytes mặc định
 * @returns chuỗi hex ngẫu nhiên
 */
function generateRandomQrPayload(numBytes = 16) {
  const bytes = Number.isInteger(numBytes) && numBytes > 0 ? numBytes : 16;
  return crypto.randomBytes(bytes).toString("hex");
}

/**
 * Func QR code dưới dạng Data URL
 * @param {*} data - dữ liệu muốn encode vào QR code
 * @param {*} options - cấu hình thêm cho QR code
 * @returns Data URL dạng "data:image/png;base64,..." để hiển thị ảnh
 */
async function generateQrDataUrl(data, options = {}) {
  const width = options.width || 300;
  const errorCorrectionLevel = options.errorCorrectionLevel || "medium"; // ~ M
  const margin = options.margin ?? 0;
  const dataUrl = await QRCode.toDataURL(String(data || ""), {
    width,
    errorCorrectionLevel,
    margin,
    type: "image/png",
    color: options.color || undefined,
  });
  return dataUrl;
}

module.exports = {
  generateRandomQrPayload,
  generateQrDataUrl,
/**
 * Hàm sinh QR và upload lên Cloudinary
 * @param {*} payload - dữ liệu sẽ encode vào QR 
 * @param {*} options - cấu hình thêm (width, folder, v.v.)
 * @returns secure_url - link ảnh QR code sau khi upload lên Cloudinary
 */
  async uploadQrImageToCloudinary(payload, options = {}) {
    const dataUrl = await generateQrDataUrl(payload, {
      width: options.width || 300,
      errorCorrectionLevel: options.errorCorrectionLevel || "medium",
      margin: options.margin ?? 0,
      color: options.color,
    });
    const folder = options.folder || "tickets";
    const publicId = options.public_id || payload;
    const { secure_url } = await cloudinary.uploader.upload(dataUrl, {
      folder,
      public_id: publicId,
      overwrite: true,
      resource_type: "image",
      type: "upload",
    });
    return secure_url;
  },
};


