// Import the Image model for database operations
const Image = require('../models/Image');
// Import the file system module for file operations
const fs = require('fs');
// Import the path module for working with file paths
const path = require('path');

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
    
    // Create a new image document
    const newImage = new Image({
      originalName: req.file.originalname, // Original filename
      fileName: req.file.filename,         // Generated filename
      filePath: req.file.path,             // Full path to the file
      userId: userId || 'anonymous',        // User ID or default to 'anonymous'
      metadata: {
        ...(metadata ? JSON.parse(metadata) : {}), // Parse metadata if it's a string
        size: req.file.size,               // File size in bytes
        mimeType: req.file.mimetype        // File MIME type
      }
    });

    // Save the image to the database
    const savedImage = await newImage.save();
    
    // Send success response with the saved image data
    res.status(201).json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        id: savedImage._id,
        originalName: savedImage.originalName,
        fileName: savedImage.fileName,
        filePath: savedImage.filePath,
        userId: savedImage.userId,
        uploadDate: savedImage.uploadDate,
        metadata: savedImage.metadata
      }
    });
  } catch (error) {
    // If there's an error, delete the uploaded file
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, err => {
        if (err) console.error('Error deleting file:', err);
      });
    }
    
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

// Resim sil
const deleteImage = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedImage = await Image.findByIdAndDelete(id);

    if (!deletedImage) {
      return res.status(404).json({ message: 'Resim bulunamadı' });
    }

    // Silinen resmi dosyadan da sil
    const fs = require('fs');
    const imagePath = deletedImage.filePath;
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    res.status(200).json({ message: 'Resim başarıyla silindi' });
  } catch (error) {
    res.status(500).json({ error: 'Silme işlemi sırasında bir hata oluştu' });
  }
};

/**
 * @desc    Get a single image by its ID
 * @route   GET /api/images/:id
 * @access  Public
 * @param   {Object} req - Express request object
 * @param   {string} req.params.id - The ID of the image to retrieve
 * @returns {Object} The requested image document
 */
const getImageById = async (req, res) => {
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
    
    // Return the found image
    res.json({
      success: true,
      data: image
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
