const express = require('express');
const router = express.Router();
const { upload } = require('../config/s3');
const Image = require('../models/Image');

// POST /api/upload
router.post('/', upload.single('photo'), async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded or invalid file type'
      });
    }

    // Create new image document
    const newImage = new Image({
      originalName: req.file.originalname,
      fileUrl: req.file.location, // This comes from S3
      userId: req.body.userId || 'anonymous',
      metadata: {
        size: req.file.size,
        mimeType: req.file.mimetype
      }
    });

    // Save to database
    await newImage.save();

    // Return success response
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
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload file'
    });
  }
});

module.exports = router;