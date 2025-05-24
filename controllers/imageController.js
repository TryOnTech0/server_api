// Import the Image model for database operations
const Image = require('../models/Image');
// Import the path module for working with file paths
const path = require('path');
// AWS SDK is imported in the functions that need it to avoid loading it unnecessarily

/**
 * @desc    Get all images from the database
 * @route   GET /api/images
 * @access  Public
 * @returns {Array} JSON array of all image documents
 */
const getAllImages = async (req, res) => {
  try {
    // Query the database for all images
    const images = await Image.find();
    // Return the images as JSON
    res.json(images);
  } catch (error) {
    // Handle any errors that occur during the database query
    console.error('Error fetching images:', error);
    res.status(500).json({ 
      success: false,
      error: 'An error occurred while fetching images.' 
    });
  }
};

/**
 * @desc    Add a new image to the database and save the file
 * @route   POST /api/upload
 * @access  Public
 * @param   {Object} req - Express request object
 * @param   {Object} req.file - The uploaded file object from multer
 * @param   {Object} req.body - Request body containing additional data
 * @returns {Object} The saved image document
 */
const addImage = async (req, res) => {
  try {
    // Check if file exists
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No file uploaded' 
      });
    }

    // Extract userId and metadata from request body
    const { userId, metadata } = req.body;
    
    // Get the S3 file location and URL
    const s3File = req.file;
    const fileUrl = s3File.location; // S3 file URL
    
    // Create a new image document
    const newImage = new Image({
      originalName: s3File.originalname,  // Original filename
      fileName: s3File.key,               // S3 object key
      filePath: fileUrl,                  // Public URL of the file in S3
      userId: userId || 'anonymous',       // User ID or default to 'anonymous'
      metadata: {
        ...(metadata ? JSON.parse(metadata) : {}), // Parse metadata if it's a string
        size: s3File.size,                // File size in bytes
        mimeType: s3File.mimetype,        // File MIME type
        storage: 's3',                    // Indicate the storage location
        bucket: s3File.bucket             // S3 bucket name
      }
    });

    // Save the image to the database
    const savedImage = await newImage.save();
    
    // Send success response with the saved image data
    res.status(201).json({
      success: true,
      message: 'Image uploaded to S3 successfully',
      data: {
        id: savedImage._id,
        originalName: savedImage.originalName,
        fileName: savedImage.fileName,
        fileUrl: savedImage.filePath,     // S3 URL
        userId: savedImage.userId,
        uploadDate: savedImage.uploadDate,
        metadata: savedImage.metadata
      }
    });
  } catch (error) {
    // Log the error
    console.error('Error in addImage:', error);
    
    // Log the full error for debugging
    console.error('Error adding image:', error);
    
    // Determine the appropriate status code
    const statusCode = error.name === 'ValidationError' ? 400 : 500;
    
    // Send error response with more details
    res.status(statusCode).json({ 
      success: false, 
      message: 'Failed to upload image',
      error: process.env.NODE_ENV === 'development' 
        ? error.message 
        : 'An error occurred while uploading the image',
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
};

// Delete image from S3 and database
const deleteImage = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the image first to get the S3 key
    const image = await Image.findById(id);
    if (!image) {
      return res.status(404).json({ 
        success: false,
        message: 'Image not found' 
      });
    }

    // Delete from S3 if the file is stored there
    if (image.metadata?.storage === 's3') {
      const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
      const { s3 } = require('../config/s3');
      
      const deleteParams = {
        Bucket: image.metadata.bucket,
        Key: image.fileName // The S3 object key
      };

      try {
        await s3.send(new DeleteObjectCommand(deleteParams));
      } catch (s3Error) {
        console.error('Error deleting file from S3:', s3Error);
        // Continue with database deletion even if S3 deletion fails
      }
    }

    // Delete from database
    await Image.findByIdAndDelete(id);

    res.status(200).json({ 
      success: true,
      message: 'Image deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ 
      success: false,
      error: 'An error occurred while deleting the image' 
    });
  }
};

/**
 * @desc    Get a single image by its ID and serve it directly from S3
 * @route   GET /api/images/:id
 * @access  Public
 * @param   {Object} req - Express request object
 * @param   {string} req.params.id - The ID of the image to retrieve
 * @returns {Stream} The image file streamed from S3
 */
const getImageById = async (req, res) => {
  try {
    console.log('\n=== GET IMAGE BY ID ===');
    console.log('Image ID:', req.params.id);
    
    // Find the image by ID
    const image = await Image.findById(req.params.id);
    
    // Log the found image (without sensitive data)
    console.log('Found image:', {
      _id: image?._id,
      fileUrl: image?.fileUrl,
      filePath: image?.filePath,
      metadata: image?.metadata
    });
    
    // If image not found, return 404
    if (!image) {
      console.log('Image not found in database');
      return res.status(404).json({ 
        success: false,
        error: 'Image not found.' 
      });
    }
    
    // If the image has a fileUrl that points to S3
    if (image.fileUrl && image.fileUrl.includes('amazonaws.com')) {
      console.log('Attempting to fetch from S3...');
      console.log('S3 URL:', image.fileUrl);
      
      try {
        // Extract the key from the fileUrl (removing the bucket URL part)
        const url = new URL(image.fileUrl);
        const key = url.pathname.substring(1); // Remove the leading '/'
        console.log('Extracted S3 key:', key);
        
        const { GetObjectCommand } = require('@aws-sdk/client-s3');
        const { s3 } = require('../config/s3');
        
        const params = {
          Bucket: process.env.S3_BUCKET_NAME,
          Key: key
        };
        
        console.log('S3 GetObject params:', JSON.stringify(params, null, 2));
        
        // Get the file from S3
        const { Body, ContentType } = await s3.send(new GetObjectCommand(params));
        
        // Set the appropriate content type
        res.set('Content-Type', ContentType || 'application/octet-stream');
        
        // Stream the file back to the client
        return Body.pipe(res);
      } catch (s3Error) {
        console.error('Error fetching file from S3:', s3Error);
        // Fall through to try other methods
      }
    }
    
    // If image has filePath (legacy or direct URL)
    if (image.filePath) {
      // If it's a full URL, redirect to it
      if (image.filePath.startsWith('http')) {
        return res.redirect(image.filePath);
      }
      // If it's a local path, try to serve it
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, '..', image.filePath);
      
      if (fs.existsSync(filePath)) {
        return res.sendFile(filePath);
      }
    }
    
    // If no valid storage method found
    return res.status(404).json({
      success: false,
      error: 'Image not available in storage'
    });
  } catch (error) {
    console.error('Error fetching image:', error);
    
    // Handle invalid ObjectId format
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid image ID format.'
      });
    }
    
    // Handle other errors
    res.status(500).json({
      success: false,
      error: 'An error occurred while fetching the image.'
    });
  }
};

/**
 * @desc    Get the file path of an image (primarily for scanner use)
 * @route   GET /api/images/:id/path
 * @access  Public
 * @param   {Object} req - Express request object
 * @param   {string} req.params.id - The ID of the image
 * @returns {Object} Contains the file path and metadata
 */
const getImagePath = async (req, res) => {
  try {
    // Find the image by ID
    const image = await Image.findById(req.params.id);
    
    // If image not found, return 404
    if (!image) {
      return res.status(404).json({ 
        success: false,
        error: 'Image not found.' 
      });
    }

    // Construct the full file path
    const imagePath = path.join(__dirname, '..', image.filePath);
    
    // Check if the file exists on disk
    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ 
        success: false,
        error: 'File not found on server.' 
      });
    }

    // Return the file path and metadata
    res.json({
      success: true,
      imagePath: image.filePath, // Return relative path for security
      publicUrl: `/uploads/${path.basename(image.filePath)}`, // Public URL to access the file
      metadata: image.metadata || {},
      fileName: image.fileName
    });
  } catch (error) {
    console.error('Error getting image path:', error);
    
    // Handle invalid ObjectId format
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid image ID format.'
      });
    }
    
    // Handle other errors
    res.status(500).json({
      success: false,
      error: 'An error occurred while retrieving the image path.'
    });
  }
};

// Export all controller functions
module.exports = {
  getAllImages,  // GET /api/images
  addImage,      // POST /api/images
  deleteImage,   // DELETE /api/images/:id
  getImageById,  // GET /api/images/:id
  getImagePath   // GET /api/images/:id/path
};
