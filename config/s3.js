const { S3Client } = require('@aws-sdk/client-s3');
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');

// Configure AWS SDK v3 client
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// File filter - temporarily disabled for testing
const fileFilter = (req, file, cb) => {
  console.log('File being processed:', file);
  cb(null, true); // Accept all files for now
};

// Set up multer for S3
const upload = multer({
    fileFilter,
    storage: multerS3({
      s3: s3,
      bucket: process.env.S3_BUCKET_NAME,
      contentType: multerS3.AUTO_CONTENT_TYPE,
      metadata: function (req, file, cb) {
        console.log('Setting metadata for file:', file);
        cb(null, {fieldName: file.fieldname});
      },
      key: function (req, file, cb) {
        console.log('Processing file:', file);
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname).toLowerCase();
        const key = 'uploads/photo_' + uniqueSuffix + extension;
        console.log('Generated key:', key);
        cb(null, key);
      }
    }),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
      files: 1
    }
  });

module.exports = { upload, s3 };