const IntArray = require('../models/IntArray');
const { promisify } = require('util');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

// Create S3 client
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

/**
 * @desc    Create a new integer array
 * @route   POST /api/intarrays
 * @access  Public
 * @param   {Object} req - Express request object
 * @param   {Object} req.body - Array data and metadata
 * @returns {Object} The saved integer array
 */
const createIntArray = async (req, res) => {
  try {
    const { data, metadata = {}, userId } = req.body;
    
    // Validate the array data
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Data must be a non-empty array'
      });
    }

    // Calculate dimensions if not provided
    const dimensions = metadata.dimensions || [data.length, 1];
    
    // Generate a unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const key = `int-arrays/array_${uniqueSuffix}.json`;
    
    // Prepare data for S3
    const arrayData = JSON.stringify({
      data,
      metadata: {
        ...metadata,
        dimensions,
        size: data.length,
        userId: userId || 'anonymous',
        createdAt: new Date().toISOString()
      }
    });

    // Upload to S3
    const uploadParams = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      Body: arrayData,
      ContentType: 'application/json',
      Metadata: {
        'user-id': userId || 'anonymous',
        'uploaded-at': new Date().toISOString()
      }
    };

    await s3.send(new PutObjectCommand(uploadParams));

    // Create new integer array with S3 reference
    const s3Url = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    
    const newIntArray = new IntArray({
      data,
      fileUrl: s3Url,
      metadata: {
        ...metadata,
        dimensions,
        size: data.length,
        storagePath: key,
        bucket: process.env.S3_BUCKET_NAME
      },
      userId: userId || 'anonymous',
      storageType: 's3'
    });

    await newIntArray.save();

    res.status(201).json({
      success: true,
      data: newIntArray
    });
  } catch (error) {
    console.error('Error creating integer array:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create integer array',
      details: error.message
    });
  }
};

/**
 * @desc    Get an integer array by ID
 * @route   GET /api/intarrays/:id
 * @access  Public
 * @param   {string} id - The ID of the integer array
 * @returns {Object} The integer array
 */
const getIntArray = async (req, res) => {
  try {
    const array = await IntArray.findById(req.params.id);
    if (!array) {
      return res.status(404).json({
        success: false,
        error: 'Integer array not found'
      });
    }

    res.json({
      success: true,
      data: array
    });
  } catch (error) {
    console.error('Error fetching integer array:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching integer array',
      details: error.message
    });
  }
};

/**
 * @desc    Get all integer arrays
 * @route   GET /api/intarrays
 * @access  Public
 * @returns {Array} List of integer arrays
 */
const getAllIntArrays = async (req, res) => {
  try {
    const { search, page = 1, limit = 10 } = req.query;
    const query = {};
    
    if (search) {
      query.$text = { $search: search };
    }

    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: { createdAt: -1 }
    };

    const arrays = await IntArray.paginate(query, options);

    res.json({
      success: true,
      data: {
        arrays: arrays.docs,
        total: arrays.totalDocs,
        pages: arrays.totalPages,
        page: arrays.page,
        limit: arrays.limit
      }
    });
  } catch (error) {
    console.error('Error fetching integer arrays:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching integer arrays',
      details: error.message
    });
  }
};

/**
 * @desc    Delete an integer array by ID
 * @route   DELETE /api/intarrays/:id
 * @access  Public
 * @param   {string} id - The ID of the integer array
 * @returns {Object} Success/error message
 */
const deleteIntArray = async (req, res) => {
  try {
    // Find the array first to get the S3 key
    const array = await IntArray.findById(req.params.id);
    
    if (!array) {
      return res.status(404).json({
        success: false,
        error: 'Integer array not found'
      });
    }

    // If the array is stored in S3, delete the file
    if (array.storageType === 's3' && array.metadata?.storagePath) {
      try {
        const deleteParams = {
          Bucket: array.metadata.bucket || process.env.S3_BUCKET_NAME,
          Key: array.metadata.storagePath
        };
        
        await s3.send(new DeleteObjectCommand(deleteParams));
      } catch (s3Error) {
        console.error('Error deleting file from S3:', s3Error);
        // Continue with the deletion even if S3 deletion fails
      }
    }

    // Delete the document from MongoDB
    await IntArray.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Integer array and associated file deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting integer array:', error);
    res.status(500).json({
      success: false,
      error: 'Error deleting integer array',
      details: error.message
    });
  }
};

module.exports = {
  createIntArray,
  getIntArray,
  getAllIntArrays,
  deleteIntArray
};
