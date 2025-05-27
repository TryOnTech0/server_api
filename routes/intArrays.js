const express = require('express');
const router = express.Router();
const { createIntArray, getIntArray, getAllIntArrays, deleteIntArray } = require('../controllers/intArrayController');

// Create new integer array
router.post('/', createIntArray);

// Get all integer arrays
router.get('/', getAllIntArrays);

// Get a specific integer array
router.get('/:id', getIntArray);

// Delete an integer array
router.delete('/:id', deleteIntArray);

module.exports = router;
