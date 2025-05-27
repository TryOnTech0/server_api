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
        const fieldName = file.fieldname.toLowerCase();
        
        // For OBJ files, handle them specially
        if (fieldName === 'objfile' || (fieldName === 'file' && extension === '.obj')) {
          // For OBJ files, use a simple filename without directory
          const key = `file_${uniqueSuffix}${extension}`;
          cb(null, key);
          return;
        }

        // For other files, use directory structure
        let dir;
        if (fieldName === 'photo' || fieldName === 'image') {
          dir = 'images';
        } else if (fieldName === 'file' && ['fbx', 'glb', 'gltf', 'stl', 'dae', '3ds', 'blend'].includes(extension.slice(1))) {
          dir = '3d-models';
        } else if (fieldName === 'intarray' || fieldName === 'array') {
          dir = 'intarrays';
        } else {
          dir = 'uploads'; // Default for other files
        }
        
        const key = `${dir}/file_${uniqueSuffix}${extension}`;
        
        console.log('Generated key:', key);
        cb(null, key);
      }
    }),
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB limit for all files
      files: 1
    }
  });

// Create separate upload middleware for 3D models
const upload3D = multer({
    fileFilter,
    storage: multerS3({
      s3: s3,
      bucket: process.env.S3_BUCKET_NAME,
      contentType: multerS3.AUTO_CONTENT_TYPE,
      metadata: function (req, file, cb) {
        console.log('Setting metadata for 3D model:', file);
        cb(null, {fieldName: file.fieldname});
      },
      key: function (req, file, cb) {
        console.log('Processing 3D model:', file);
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname).toLowerCase();
        const key = `3d-models/file_${uniqueSuffix}${extension}`;
        
        console.log('Generated key:', key);
        cb(null, key);
      }
    }),
    limits: {
      fileSize: 500 * 1024 * 1024, // 500MB limit for 3D models
      files: 1
    }
  });

module.exports = {
  s3,
  upload,
  upload3D
};