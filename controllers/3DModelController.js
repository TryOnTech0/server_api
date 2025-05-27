const ThreeDModel = require('../models/3DModel');
const { promisify } = require('util');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { s3, upload3D } = require('../config/s3');
const { ensureUploadsDir } = require('./utils');

// Helper function to upload to S3
const uploadToS3 = async (file) => {
  try {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname).toLowerCase();
    const key = `3d-models/file_${uniqueSuffix}${extension}`;
    
    // Upload to S3
    await s3.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      Metadata: {
        'original-filename': file.originalname
      }
    }));
    
    return {
      fileUrl: `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
      metadata: {
        bucket: process.env.S3_BUCKET_NAME,
        storagePath: key,
        originalName: file.originalname
      }
    };
  } catch (error) {
    console.error('Error uploading to S3:', error);
    throw error;
  }
};

// Helper function to parse 3D model metadata
const parse3DModel = async (filePath, format) => {
  const data = {
    vertices: [],
    faces: [],
    materials: [],
    textures: [],
    boundingBox: { min: { x: Infinity, y: Infinity, z: Infinity }, max: { x: -Infinity, y: -Infinity, z: -Infinity } }
  };
  
  try {
    const content = await fs.readFile(filePath, 'utf8');
    
    switch (format.toLowerCase()) {
      case 'obj':
        // Parse OBJ file
        const lines = content.split('\n');
        for (const line of lines) {
          if (line.startsWith('v ')) {
            const vertex = line.split(' ').slice(1).map(Number);
            data.vertices.push(vertex);
            // Update bounding box
            data.boundingBox.min.x = Math.min(data.boundingBox.min.x, vertex[0]);
            data.boundingBox.min.y = Math.min(data.boundingBox.min.y, vertex[1]);
            data.boundingBox.min.z = Math.min(data.boundingBox.min.z, vertex[2]);
            data.boundingBox.max.x = Math.max(data.boundingBox.max.x, vertex[0]);
            data.boundingBox.max.y = Math.max(data.boundingBox.max.y, vertex[1]);
            data.boundingBox.max.z = Math.max(data.boundingBox.max.z, vertex[2]);
          } else if (line.startsWith('f ')) {
            data.faces.push(line.split(' ').slice(1));
          } else if (line.startsWith('mtllib ')) {
            data.materials.push(line.split(' ')[1]);
          } else if (line.startsWith('vt ')) {
            data.textures.push(line.split(' ').slice(1).map(Number));
          }
        }
        break;
      
      // Add more format parsers as needed
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
    
    // Calculate dimensions from bounding box
    const dimensions = {
      width: data.boundingBox.max.x - data.boundingBox.min.x,
      height: data.boundingBox.max.y - data.boundingBox.min.y,
      depth: data.boundingBox.max.z - data.boundingBox.min.z
    };
    
    // Calculate center point
    const center = {
      x: (data.boundingBox.max.x + data.boundingBox.min.x) / 2,
      y: (data.boundingBox.max.y + data.boundingBox.min.y) / 2,
      z: (data.boundingBox.max.z + data.boundingBox.min.z) / 2
    };
    
    return {
      ...data,
      dimensions,
      center
    };
  } catch (error) {
    console.error('Error parsing 3D model:', error);
    throw error;
  }
};

/**
 * @desc    Create a new 3D model
 * @route   POST /api/3dmodels
 * @access  Public
 * @param   {Object} req - Express request object
 * @param   {Object} req.file - The uploaded 3D model file
 * @param   {Object} req.body - Model metadata and storage preferences
 * @returns {Object} The saved 3D model
 */
const create3DModel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const { userId, metadata = {}, storageType = 's3' } = req.body;
    
    // Get file extension to determine format
    const extension = path.extname(req.file.originalname).toLowerCase();
    const format = extension.slice(1); // Remove the dot
    
    // Validate format
    if (!['obj', 'fbx', 'glb', 'gltf', 'stl', 'dae', '3ds', 'blend'].includes(format)) {
      return res.status(400).json({
        success: false,
        error: 'Unsupported 3D model format'
      });
    }

    // Log file details for debugging
    console.log('Received file:', {
      name: req.file.originalname,
      size: req.file.size,
      fieldname: req.file.fieldname
    });

    // Create model data
    const modelData = {
      fileName: req.file.originalname,
      userId: userId || 'anonymous',
      storageType,
      format,
      metadata: {
        ...metadata,
        size: req.file.size
      }
    };

    // Handle S3 storage
    if (storageType === 's3') {
      try {
        // Only upload if we have a file buffer
        if (!req.file || !req.file.buffer) {
          throw new Error('No file data available for upload');
        }

        const uploadResult = await uploadToS3(req.file);
        
        // Update model data with upload result
        modelData.fileUrl = uploadResult.fileUrl;
        modelData.metadata = {
          ...modelData.metadata,
          ...uploadResult.metadata,
          size: req.file.size,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype
        };
      } catch (error) {
        console.error('Error uploading to S3:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to upload file to S3',
          details: error.message
        });
      }
    } 
    // Handle local storage
    else {
      try {
        const uploadsDir = await ensureUploadsDir();
        const fileName = `${Date.now()}-${req.file.originalname}`;
        const filePath = path.join('uploads', fileName);
        const fullPath = path.join(__dirname, '..', filePath);
        
        // Save the file locally
        await fs.writeFile(fullPath, req.file.buffer);
        
        modelData.filePath = filePath;
        modelData.fileUrl = `${req.protocol}://${req.get('host')}/${filePath}`;
        modelData.metadata = {
          ...modelData.metadata,
          storagePath: filePath,
          size: req.file.size,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype
        };
      } catch (error) {
        console.error('Error saving file locally:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to save file locally',
          details: error.message
        });
      }
    }

    // Parse model metadata based on format
    if (storageType === 'local') {
      const modelData = await parse3DModel(fullPath, format);
      modelData.metadata.verticesCount = modelData.vertices.length;
      modelData.metadata.facesCount = modelData.faces.length;
      modelData.metadata.boundingBox = modelData.boundingBox;
      modelData.metadata.dimensions = modelData.dimensions;
      modelData.metadata.center = modelData.center;
    }

    const newModel = new ThreeDModel(modelData);
    await newModel.save();

    res.status(201).json({
      success: true,
      data: newModel
    });
  } catch (error) {
    console.error('Error creating 3D model:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create 3D model',
      details: error.message
    });
  }
};

/**
 * @desc    Get a 3D model by ID
 * @route   GET /api/3dmodels/:id
 * @access  Public
 * @param   {string} id - The ID of the 3D model
 * @returns {Stream} The 3D model file
 */
const get3DModel = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the 3D model by ID
    const model = await ThreeDModel.findById(id);
    if (!model) {
      return res.status(404).json({ 
        success: false,
        error: '3D model not found' 
      });
    }

    // Handle S3 storage
    if (model.storageType === 's3' && model.fileUrl) {
      try {
        const { GetObjectCommand } = require('@aws-sdk/client-s3');
        
        // Extract key from URL or use stored metadata
        let key = model.metadata?.storagePath;
        if (!key && model.fileUrl.includes('amazonaws.com')) {
          const url = new URL(model.fileUrl);
          key = url.pathname.substring(1);
        }
        
        if (!key) {
          throw new Error('Could not determine S3 key');
        }
        
        const params = {
          Bucket: model.metadata?.bucket || process.env.S3_BUCKET_NAME,
          Key: key
        };
        
        // Get the file from S3
        const { s3 } = require('../config/s3');
        const { Body, ContentType } = await s3.send(new GetObjectCommand(params));
        
        // Set the appropriate content type
        res.set('Content-Type', ContentType || 'application/octet-stream');
        
        // Stream the file back to the client
        return Body.pipe(res);
      } catch (s3Error) {
        console.error('Error fetching from S3:', s3Error);
        return res.status(500).json({
          success: false,
          error: 'Error retrieving 3D model from storage',
          details: s3Error.message
        });
      }
    } 
    // Handle local storage
    else if (model.storageType === 'local' && model.filePath) {
      try {
        const fullPath = path.join(__dirname, '..', model.filePath);
        if (fsSync.existsSync(fullPath)) {
          return res.sendFile(fullPath, {
            headers: {
              'Content-Type': 'model/3d'
            }
          });
        } else {
          throw new Error('File not found on server');
        }
      } catch (fsError) {
        console.error('Error serving local file:', fsError);
        return res.status(404).json({
          success: false,
          error: '3D model not found',
          details: fsError.message
        });
      }
    }
    
    return res.status(404).json({
      success: false,
      error: '3D model not available in storage'
    });
  } catch (error) {
    console.error('Error fetching 3D model:', error);
    
    // Handle invalid ObjectId format
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid 3D model ID format'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'An error occurred while fetching the 3D model',
      details: error.message
    });
  }
};

/**
 * @desc    Get all 3D models
 * @route   GET /api/3dmodels
 * @access  Public
 * @returns {Array} List of 3D models
 */
const getAll3DModels = async (req, res) => {
  try {
    const { search, page = 1, limit = 10, format, tag } = req.query;
    const query = {};
    
    if (search) {
      query.$text = { $search: search };
    }

    if (format) {
      query.format = format.toLowerCase();
    }

    if (tag) {
      query['metadata.tags'] = tag;
    }

    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: { createdAt: -1 }
    };

    const models = await ThreeDModel.paginate(query, options);

    res.json({
      success: true,
      data: {
        models: models.docs,
        total: models.totalDocs,
        pages: models.totalPages,
        page: models.page,
        limit: models.limit
      }
    });
  } catch (error) {
    console.error('Error fetching 3D models:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching 3D models',
      details: error.message
    });
  }
};

/**
 * @desc    Delete a 3D model by ID
 * @route   DELETE /api/3dmodels/:id
 * @access  Public
 * @param   {string} id - The ID of the 3D model
 * @returns {Object} Success/error message
 */
const delete3DModel = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the 3D model first to get storage details
    const model = await ThreeDModel.findById(id);
    if (!model) {
      return res.status(404).json({ 
        success: false,
        error: '3D model not found' 
      });
    }

    // Handle S3 deletion
    if (model.storageType === 's3' && model.fileUrl) {
      try {
        const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
        const { s3 } = require('../config/s3');
        
        // Extract key from URL or use stored metadata
        let key = model.metadata?.storagePath;
        if (!key && model.fileUrl.includes('amazonaws.com')) {
          const url = new URL(model.fileUrl);
          key = url.pathname.substring(1);
        }
        
        if (key) {
          const deleteParams = {
            Bucket: model.metadata?.bucket || process.env.S3_BUCKET_NAME,
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
    else if (model.storageType === 'local' && model.filePath) {
      try {
        const fullPath = path.join(__dirname, '..', model.filePath);
        if (fsSync.existsSync(fullPath)) {
          await fs.unlink(fullPath);
          console.log(`Successfully deleted local file: ${model.filePath}`);
          
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
    await ThreeDModel.findByIdAndDelete(id);
    console.log(`Successfully deleted 3D model ${id} from database`);

    res.status(200).json({ 
      success: true,
      message: '3D model deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting 3D model:', error);
    res.status(500).json({ 
      success: false,
      error: 'An error occurred while deleting the 3D model',
      details: error.message
    });
  }
};

module.exports = {
  create3DModel,
  get3DModel,
  getAll3DModels,
  delete3DModel
};
