const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
  originalName: { 
    type: String, 
    required: true 
  },
  fileUrl: { 
    type: String, 
    required: true 
  },
  userId: { 
    type: String, 
    required: true 
  },
  metadata: {
    type: Object,
    default: {
      size: Number,
      mimeType: String
    }
  }
}, { 
  timestamps: true 
});

module.exports = mongoose.model('Image', imageSchema);