/**
 * Upload Middleware - Xử lý upload file poster cho Event
 * 
 * Mục đích: Xử lý upload file ảnh poster cho event với Multer
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');

/**
 * Cấu hình Multer storage - Lưu file vào disk
 * 
 * Destination: uploads/posters/
 * Filename: poster-{timestamp}-{random}.{ext}
 */
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Đường dẫn thư mục lưu file
    const uploadPath = path.join(__dirname, '../uploads/posters');
    
    // Tạo thư mục nếu chưa tồn tại (recursive: true để tạo cả thư mục cha)
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    // Callback với đường dẫn thư mục
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Tạo tên file unique với timestamp và random number
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    
    // Tên file: poster-{timestamp}-{random}.{ext}
    // Ví dụ: poster-1699123456789-123456789.jpg
    cb(null, 'poster-' + uniqueSuffix + path.extname(file.originalname));
  }
});

/**
 * File filter - Chỉ cho phép upload file ảnh
 * 
 * Mục đích: Validate file type trước khi upload
 */
const fileFilter = (req, file, cb) => {
  // Kiểm tra mimetype có bắt đầu bằng 'image/' không
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);  // Cho phép upload
  } else {
    cb(new Error('Only image files are allowed!'), false);  // Từ chối upload
  }
};

/**
 * Cấu hình Multer
 * 
 * - storage: Lưu file vào disk (uploads/posters/)
 * - fileFilter: Chỉ chấp nhận image files
 * - limits: Giới hạn file size (5MB)
 */
const upload = multer({
  storage: storage,  // Lưu file vào disk
  fileFilter: fileFilter,  // Chỉ chấp nhận image files
  limits: {
    fileSize: 5 * 1024 * 1024  // Giới hạn 5MB (5 * 1024 * 1024 bytes)
  }
});

/**
 * Middleware upload poster - Upload single file với field name 'poster'
 * 
 * Mục đích: Xử lý upload file poster từ form data (field name: 'poster')
 */
const uploadPoster = upload.single('poster');

/**
 * Middleware upload poster với error handling
 * 
 * Mục đích: Xử lý upload file poster và trả về lỗi phù hợp nếu có
 */
const uploadPosterMiddleware = (req, res, next) => {
  uploadPoster(req, res, (err) => {
    if (err) {
      // Xử lý lỗi Multer (lỗi từ Multer library)
      if (err instanceof multer.MulterError) {
        // Lỗi file quá lớn
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'File size too large. Maximum 5MB allowed'
          });
        }
      } 
      // Lỗi file không phải image (từ fileFilter)
      else if (err.message === 'Only image files are allowed!') {
        return res.status(400).json({
          success: false,
          message: 'Only image files are allowed'
        });
      }
      
      // Lỗi khác
      return res.status(400).json({
        success: false,
        message: 'Upload error: ' + err.message
      });
    }
    
    // Không có lỗi → chuyển sang middleware/controller tiếp theo
    next();
  });
};

// Middleware xử lý lỗi upload
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum 5MB allowed'
      });
    }
  } else if (err.message === 'Only image files are allowed!') {
    return res.status(400).json({
      success: false,
      message: 'Only image files are allowed'
    });
  }
  next(err);
};

module.exports = {
  uploadPoster,
  uploadPosterMiddleware,
  handleUploadError
};
