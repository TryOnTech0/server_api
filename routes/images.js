// Import required modules
const express = require('express');
const router = express.Router();

// Import S3 upload configuration
const { upload } = require('../config/s3');

// Import controller functions for handling image operations
const { 
  getAllImages,  // Get all images
  getImageById,  // Get a single image by ID
  deleteImage,   // Delete an image
  getImagePath,  // Get image file path
  addImage       // Add a new image
} = require('../controllers/imageController');

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
