const express = require('express');
const router = express.Router();
const multer = require('multer');
const { create3DModel, get3DModel, getAll3DModels, delete3DModel } = require('../controllers/3DModelController');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit for 3D models
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.obj', '.fbx', '.glb', '.gltf', '.stl', '.dae', '.3ds', '.blend'];
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only 3D model files are allowed.'));
    }
  }
});

// Create new 3D model
router.post('/', upload.single('file'), create3DModel);

// Get all 3D models
router.get('/', getAll3DModels);

// Get a specific 3D model
router.get('/:id', get3DModel);

// Delete a 3D model
router.delete('/:id', delete3DModel);

module.exports = router;
