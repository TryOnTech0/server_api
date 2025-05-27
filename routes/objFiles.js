const express = require('express');
const router = express.Router();
const multer = require('multer');
const { createObjFile, getObjFile, getAllObjFiles, deleteObjFile } = require('../controllers/objFileController');

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter to only allow OBJ files
const fileFilter = (req, file, cb) => {
  const ext = file.originalname.toLowerCase().split('.').pop();
  if (ext === 'obj') {
    cb(null, true);
  } else {
    cb(new Error('Only .obj files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit for OBJ files
    files: 1
  }
});

// Create new OBJ file
router.post('/', 
  (req, res, next) => {
    // Log the incoming request body to debug
    console.log('Request body:', req.body);
    console.log('Request files:', req.files);
    next();
  },
  upload.single('file'),
  (req, res, next) => {
    // Log the processed file
    console.log('Processed file:', req.file);
    next();
  },
  createObjFile
);

// Get all OBJ files
router.get('/', getAllObjFiles);

// Get a specific OBJ file
router.get('/:id', getObjFile);

// Delete an OBJ file
router.delete('/:id', deleteObjFile);

module.exports = router;
