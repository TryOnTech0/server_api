const ObjFile = require('../models/ObjFile');
const { promisify } = require('util');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// Helper function to ensure uploads directory exists
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
 * @desc    Create a new OBJ file
 * @route   POST /api/objfiles
 * @access  Public
 * @param   {Object} req - Express request object
 * @param   {Object} req.file - The uploaded OBJ file
 * @param   {Object} req.body - Metadata and storage preferences
 * @returns {Object} The saved OBJ file
 */
const createObjFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const { userId, metadata = {}, storageType = 's3' } = req.body;
    
    // Create file data based on storage type
    const fileData = {
      fileName: req.file.originalname,
      userId: userId || 'anonymous',
      storageType,
      metadata: {
        ...metadata,
        size: req.file.size,
        verticesCount: 0,
        facesCount: 0
      }
    };

    // Handle S3 storage
    if (storageType === 's3') {
      // Create a unique filename
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const extension = path.extname(req.file.originalname).toLowerCase();
      const fileName = `file_${uniqueSuffix}${extension}`;
      
      // Create the S3 client
      const s3 = new S3Client({
        region: process.env.AWS_REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        }
      });

      // Upload to obj-files directory in S3
      const key = `obj-files/${fileName}`;
      
      // Make sure we have the file buffer
      if (!req.file.buffer) {
        throw new Error('No file buffer available');
      }

      const uploadParams = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
        Body: req.file.buffer,
        ContentType: 'model/obj',
        Metadata: {
          'original-filename': req.file.originalname,
          'user-id': userId || 'anonymous',
          'uploaded-at': new Date().toISOString()
        }
      };

      try {
        // Upload to S3
        await s3.send(new PutObjectCommand(uploadParams));
        
        // Update file data with S3 information
        fileData.fileUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
        fileData.metadata = {
          ...fileData.metadata,
          bucket: process.env.S3_BUCKET_NAME,
          storagePath: key,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype
        };
      } catch (error) {
        console.error('Error uploading to S3:', error);
        throw new Error(`Failed to upload file to S3: ${error.message}`);
      }
    } 
    // Handle local storage
    else {
      const uploadsDir = await ensureUploadsDir();
      const fileName = `${Date.now()}-${req.file.originalname}`;
      const filePath = path.join('uploads', fileName);
      const fullPath = path.join(__dirname, '..', filePath);
      
      // Save the file locally
      await fs.writeFile(fullPath, req.file.buffer);
      
      fileData.filePath = filePath;
      fileData.fileUrl = `${req.protocol}://${req.get('host')}/${filePath}`;
      fileData.metadata.storagePath = filePath;

      // Parse OBJ file to get metadata after saving
      const objData = await parseObjFile(fullPath);
      fileData.metadata.verticesCount = objData.vertices.length;
      fileData.metadata.facesCount = objData.faces.length;
    }

    const newObjFile = new ObjFile(fileData);
    await newObjFile.save();

    res.status(201).json({
      success: true,
      data: newObjFile
    });
  } catch (error) {
    console.error('Error creating OBJ file:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create OBJ file',
      details: error.message
    });
  }
};

/**
 * @desc    Get an OBJ file by ID
 * @route   GET /api/objfiles/:id
 * @access  Public
 * @param   {string} id - The ID of the OBJ file
 * @returns {Stream} The OBJ file content
 */
const getObjFile = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the OBJ file by ID
    const objFile = await ObjFile.findById(id);
    if (!objFile) {
      return res.status(404).json({ 
        success: false,
        error: 'OBJ file not found' 
      });
    }

    // Handle S3 storage
    if (objFile.storageType === 's3' && objFile.fileUrl) {
      try {
        const { GetObjectCommand } = require('@aws-sdk/client-s3');
        const { s3 } = require('../config/s3');
        
        // Extract key from URL or use stored metadata
        let key = objFile.metadata?.storagePath;
        if (!key && objFile.fileUrl.includes('amazonaws.com')) {
          const url = new URL(objFile.fileUrl);
          key = url.pathname.substring(1);
        }
        
        if (!key) {
          throw new Error('Could not determine S3 key');
        }
        
        const params = {
          Bucket: objFile.metadata?.bucket || process.env.S3_BUCKET_NAME,
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
          error: 'Error retrieving OBJ file from storage',
          details: s3Error.message
        });
      }
    } 
    // Handle local storage
    else if (objFile.storageType === 'local' && objFile.filePath) {
      try {
        const fullPath = path.join(__dirname, '..', objFile.filePath);
        if (fsSync.existsSync(fullPath)) {
          return res.sendFile(fullPath, {
            headers: {
              'Content-Type': 'model/obj'
            }
          });
        } else {
          throw new Error('File not found on server');
        }
      } catch (fsError) {
        console.error('Error serving local file:', fsError);
        return res.status(404).json({
          success: false,
          error: 'OBJ file not found',
          details: fsError.message
        });
      }
    }
    
    return res.status(404).json({
      success: false,
      error: 'OBJ file not available in storage'
    });
  } catch (error) {
    console.error('Error fetching OBJ file:', error);
    
    // Handle invalid ObjectId format
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid OBJ file ID format'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'An error occurred while fetching the OBJ file',
      details: error.message
    });
  }
};

/**
 * @desc    Get all OBJ files
 * @route   GET /api/objfiles
 * @access  Public
 * @returns {Array} List of OBJ files
 */
const getAllObjFiles = async (req, res) => {
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

    const files = await ObjFile.paginate(query, options);

    res.json({
      success: true,
      data: {
        files: files.docs,
        total: files.totalDocs,
        pages: files.totalPages,
        page: files.page,
        limit: files.limit
      }
    });
  } catch (error) {
    console.error('Error fetching OBJ files:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching OBJ files',
      details: error.message
    });
  }
};

/**
 * @desc    Delete an OBJ file by ID
 * @route   DELETE /api/objfiles/:id
 * @access  Public
 * @param   {string} id - The ID of the OBJ file
 * @returns {Object} Success/error message
 */
const deleteObjFile = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the OBJ file first to get storage details
    const objFile = await ObjFile.findById(id);
    if (!objFile) {
      return res.status(404).json({ 
        success: false,
        error: 'OBJ file not found' 
      });
    }

    // Handle S3 deletion
    if (objFile.storageType === 's3' && objFile.fileUrl) {
      try {
        const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
        const { s3 } = require('../config/s3');
        
        // Extract key from URL or use stored metadata
        let key = objFile.metadata?.storagePath;
        if (!key && objFile.fileUrl.includes('amazonaws.com')) {
          const url = new URL(objFile.fileUrl);
          key = url.pathname.substring(1);
        }
        
        if (key) {
          const deleteParams = {
            Bucket: objFile.metadata?.bucket || process.env.S3_BUCKET_NAME,
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
    else if (objFile.storageType === 'local' && objFile.filePath) {
      try {
        const fullPath = path.join(__dirname, '..', objFile.filePath);
        if (fsSync.existsSync(fullPath)) {
          await fs.unlink(fullPath);
          console.log(`Successfully deleted local file: ${objFile.filePath}`);
          
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
    await ObjFile.findByIdAndDelete(id);
    console.log(`Successfully deleted OBJ file ${id} from database`);

    res.status(200).json({ 
      success: true,
      message: 'OBJ file deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting OBJ file:', error);
    res.status(500).json({ 
      success: false,
      error: 'An error occurred while deleting the OBJ file',
      details: error.message
    });
  }
};

// Helper function to parse OBJ file and extract metadata
const parseObjFile = async (filePath) => {
  const content = await fs.readFile(filePath, 'utf8');
  const lines = content.split('\n');
  
  const data = {
    vertices: [],
    faces: [],
    materials: [],
    textures: []
  };
  
  for (const line of lines) {
    if (line.startsWith('v ')) {
      data.vertices.push(line.split(' ').slice(1).map(Number));
    } else if (line.startsWith('f ')) {
      data.faces.push(line.split(' ').slice(1));
    } else if (line.startsWith('mtllib ')) {
      data.materials.push(line.split(' ')[1]);
    } else if (line.startsWith('vt ')) {
      data.textures.push(line.split(' ').slice(1).map(Number));
    }
  }
  
  return data;
};

module.exports = {
  createObjFile,
  getObjFile,
  getAllObjFiles,
  deleteObjFile
};
