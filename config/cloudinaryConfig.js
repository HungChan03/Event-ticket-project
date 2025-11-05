const cloudinary = require('cloudinary').v2;

// Configure Cloudinary 
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dwxv8zjnr',
  api_key: process.env.CLOUDINARY_API_KEY || '867262788719175',
  api_secret: process.env.CLOUDINARY_API_SECRET || '3QW8-9-avddkgCwSPZyzoFBHRkc',
  secure: true,
});

module.exports = cloudinary;


