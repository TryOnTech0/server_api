// Import required modules
const express = require('express'); // Web framework
const router = express.Router(); // Create a new router instance
const multer = require('multer'); // Middleware for handling file uploads
const path = require('path'); // For working with file paths
const fs = require('fs'); // For file system operations

// Import controller functions for handling image operations
const { 
  getAllImages,  // Get all images
  getImageById,  // Get a single image by ID
  deleteImage,   // Delete an image
  getImagePath,  // Get image file path
  addImage       // Add a new image
} = require('../controllers/imageController');

/**
 * Configure multer storage for file uploads
 * Defines where and how uploaded files should be stored
 */
const storage = multer.diskStorage({
  // Define the destination directory for uploaded files
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads');
    // Create the uploads directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      // recursive: true creates parent directories if they don't exist
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    // Return the upload directory path
    cb(null, uploadDir);
  },
  // Define how uploaded files should be named
  filename: function (req, file, cb) {
    // Create a unique suffix using current timestamp and random number
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // Get the file extension from the original filename
    const extension = path.extname(file.originalname);
    // Combine prefix, unique suffix, and extension for the new filename
    cb(null, 'photo_' + uniqueSuffix + extension);
  }
});

/**
 * Configure multer middleware with storage options and file validation
 */
const upload = multer({
  storage: storage, // Use the storage configuration defined above
  // Set file size limit (10MB)
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB in bytes
  },
  // Validate file types
  fileFilter: function (req, file, cb) {
    // Define allowed MIME types
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      // Accept the file
      cb(null, true);
    } else {
      // Reject the file with an error
      cb(new Error('Only .jpeg, .jpg and .png format allowed!'));
    }
  }
});

/**
 * @route   POST /api/images
 * @desc    Upload a new image
 * @access  Public
 * @param   {file} photo - The image file to upload
 */
router.post('/', upload.single('photo'), addImage);

/**
 * @route   GET /api/images
 * @desc    Get all images
 * @access  Public
 * @returns {Array} List of all images
 */
router.get('/', getAllImages);

/**
 * @route   GET /api/images/:id
 * @desc    Get a specific image by ID
 * @access  Public
 * @param   {string} id - The ID of the image to retrieve
 * @returns {Object} Image details
 */
router.get('/:id', getImageById);

/**
 * @route   DELETE /api/images/:id
 * @desc    Delete an image by ID
 * @access  Public
 * @param   {string} id - The ID of the image to delete
 * @returns {Object} Success/error message
 */
router.delete('/:id', deleteImage);

/**
 * @route   GET /api/images/:id/path
 * @desc    Get the file path of an image (primarily for scanner use)
 * @access  Public
 * @param   {string} id - The ID of the image
 * @returns {Object} Contains the file path and metadata
 */
router.get('/:id/path', getImagePath);

module.exports = router;
