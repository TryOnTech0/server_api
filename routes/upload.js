const express = require('express');
const router = express.Router();
const { upload } = require('../config/s3');
const Image = require('../models/Image');

// POST /api/upload
router.post('/', (req, res) => {
  upload.single('photo')(req, res, async (err) => {
    try {
      if (err) {
        console.error('Upload error:', err);
        return res.status(400).json({
          success: false,
          error: err.message || 'Error uploading file'
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded or invalid file type',
          details: {
            receivedFiles: !!req.files,
            receivedFile: !!req.file,
            body: req.body,
            headers: req.headers
          }
        });
      }

      const newImage = new Image({
        originalName: req.file.originalname,
        fileUrl: req.file.location,
        userId: req.body.userId || 'anonymous',
        metadata: {
          size: req.file.size,
          mimeType: req.file.mimetype
        }
      });

      await newImage.save();

      res.status(201).json({
        success: true,
        message: 'File uploaded successfully',
        data: {
          id: newImage._id,
          originalName: newImage.originalName,
          fileUrl: newImage.fileUrl,
          userId: newImage.userId,
          uploadDate: newImage.createdAt
        }
      });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });
});

module.exports = router;