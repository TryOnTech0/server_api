// Import the Image model for database operations
const Image = require('../models/Image');
// Import the path and filesystem modules for working with file paths
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
// AWS SDK is imported in the functions that need it to avoid loading it unnecessarily
const { promisify } = require('util');
const stream = require('stream');
const pipeline = promisify(stream.pipeline);

// Helper function to determine storage type from URL
const getStorageType = (url) => {
  if (!url) return 'local';
  return url.includes('amazonaws.com') ? 's3' : 'local';
};

// Helper to ensure uploads directory exists
const ensureUploadsDir = async () => {
  const uploadsDir = path.join(__dirname, '../uploads');
  try {
    await fs.access(uploadsDir);
  } catch (error) {
    await fs.mkdir(uploadsDir, { recursive: true });
  }
  return uploadsDir;
};

/**
 * @desc    Get all images from the database
 * @route   GET /api/images
 * @access  Public
 * @returns {Array} JSON array of all image documents
 */
const getAllImages = async (req, res) => {
  try {
    const { search, page = 1, limit = 10 } = req.query;
    const query = {};
    
    // Add search filter if provided
    if (search) {
      query.$text = { $search: search };
    }
    
    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: { createdAt: -1 },
      select: '-__v -_id -metadata._id'
    };
    
    // Query the database for images with pagination
    const images = await Image.paginate(query, options);
    
    res.json({
      success: true,
      data: {
        images: images.docs,
        total: images.totalDocs,
        pages: images.totalPages,
        page: images.page,
        limit: images.limit
      }
    });
  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).json({ 
      success: false,
      error: 'An error occurred while fetching images.',
      details: error.message
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
    const { userId, metadata = {} } = req.body;
    const storageType = req.body.storageType || 's3';
    
    // Create image data based on storage type
    const imageData = {
      originalName: req.file.originalname,
      fileName: req.file.originalname,
      userId: userId || 'anonymous',
      storageType,
      metadata: {
        ...metadata,
        size: req.file.size,
        mimeType: req.file.mimetype
      }
    };

    // Handle S3 storage
    if (storageType === 's3') {
      imageData.fileUrl = req.file.location;
      imageData.metadata.bucket = process.env.S3_BUCKET_NAME;
      imageData.metadata.storagePath = req.file.key;
    } 
    // Handle local storage
    else {
      const uploadsDir = await ensureUploadsDir();
      const fileName = `${Date.now()}-${req.file.originalname}`;
      const filePath = path.join('uploads', fileName);
      const fullPath = path.join(__dirname, '..', filePath);
      
      // Move the file to the uploads directory
      await fs.rename(req.file.path, fullPath);
      
      imageData.filePath = filePath;
      imageData.fileUrl = `${req.protocol}://${req.get('host')}/${filePath}`;
      imageData.metadata.storagePath = filePath;
    }

    // Create and save the image document
    const newImage = new Image(imageData);
    await newImage.save();

    // Return success response with the saved image
    res.status(201).json({
      success: true,
      message: 'Image uploaded successfully',
      data: newImage
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

/**
 * @desc    Delete an image from storage and database
 * @route   DELETE /api/images/:id
 * @access  Public
 * @param   {string} id - The ID of the image to delete
 * @returns {Object} Success/error message
 */
const deleteImage = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the image first to get storage details
    const image = await Image.findById(id);
    if (!image) {
      return res.status(404).json({ 
        success: false,
        message: 'Image not found' 
      });
    }

    // Handle S3 deletion
    if (image.storageType === 's3' && image.fileUrl) {
      try {
        const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
        const { s3 } = require('../config/s3');
        
        // Extract key from URL or use stored metadata
        let key = image.metadata?.storagePath;
        if (!key && image.fileUrl.includes('amazonaws.com')) {
          const url = new URL(image.fileUrl);
          key = url.pathname.substring(1);
        }
        
        if (key) {
          const deleteParams = {
            Bucket: image.metadata?.bucket || process.env.S3_BUCKET_NAME,
            Key: key
          };
          
          await s3.send(new DeleteObjectCommand(deleteParams));
          console.log(`Successfully deleted ${key} from S3`);
        }
      } catch (s3Error) {
        console.error('Error deleting file from S3:', s3Error);
        // Continue with database deletion even if S3 deletion fails
      }
    } 
    // Handle local file deletion
    else if (image.storageType === 'local' && image.filePath) {
      try {
        const fullPath = path.join(__dirname, '..', image.filePath);
        if (fsSync.existsSync(fullPath)) {
          await fs.unlink(fullPath);
          console.log(`Successfully deleted local file: ${image.filePath}`);
          
          // Try to remove the directory if empty
          const dirPath = path.dirname(fullPath);
          try {
            await fs.rmdir(dirPath);
          } catch (e) {
            // Directory not empty, which is fine
          }
        }
      } catch (fsError) {
        console.error('Error deleting local file:', fsError);
        // Continue with database deletion even if file deletion fails
      }
    }

    // Delete from database
    await Image.findByIdAndDelete(id);
    console.log(`Successfully deleted image ${id} from database`);

    res.status(200).json({ 
      success: true,
      message: 'Image deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ 
      success: false,
      error: 'An error occurred while deleting the image',
      details: error.message
    });
  }
};

/**
 * @desc    Get a single image by its ID and serve it from the appropriate storage
 * @route   GET /api/images/:id
 * @access  Public
 * @param   {Object} req - Express request object
 * @param   {string} req.params.id - The ID of the image to retrieve
 * @returns {Stream} The image file streamed from storage
 */
const getImageById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the image by ID
    const image = await Image.findById(id);
    if (!image) {
      return res.status(404).json({ 
        success: false,
        error: 'Image not found' 
      });
    }

    // Handle S3 storage
    if (image.storageType === 's3' && image.fileUrl) {
      try {
        const { GetObjectCommand } = require('@aws-sdk/client-s3');
        const { s3 } = require('../config/s3');
        
        // Extract key from URL or use stored metadata
        let key = image.metadata?.storagePath;
        if (!key && image.fileUrl.includes('amazonaws.com')) {
          const url = new URL(image.fileUrl);
          key = url.pathname.substring(1);
        }
        
        if (!key) {
          throw new Error('Could not determine S3 key');
        }
        
        const params = {
          Bucket: image.metadata?.bucket || process.env.S3_BUCKET_NAME,
          Key: key
        };
        
        // Get the file from S3
        const { Body, ContentType } = await s3.send(new GetObjectCommand(params));
        
        // Set the appropriate content type
        res.set('Content-Type', ContentType || 'application/octet-stream');
        
        // Stream the file back to the client
        return Body.pipe(res);
      } catch (s3Error) {
        console.error('Error fetching from S3:', s3Error);
        return res.status(500).json({
          success: false,
          error: 'Error retrieving image from storage',
          details: s3Error.message
        });
      }
    } 
    // Handle local storage
    else if (image.storageType === 'local' && image.filePath) {
      try {
        const fullPath = path.join(__dirname, '..', image.filePath);
        if (fsSync.existsSync(fullPath)) {
          return res.sendFile(fullPath, {
            headers: {
              'Content-Type': image.metadata?.mimeType || 'application/octet-stream'
            }
          });
        } else {
          throw new Error('File not found on server');
        }
      } catch (fsError) {
        console.error('Error serving local file:', fsError);
        return res.status(404).json({
          success: false,
          error: 'Image file not found',
          details: fsError.message
        });
      }
    }
    
    // If we get here, the storage type is not supported or file not found
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
        error: 'Invalid image ID format'
      });
    }
    
    // Handle other errors
    res.status(500).json({
      success: false,
      error: 'An error occurred while fetching the image',
      details: error.message
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
