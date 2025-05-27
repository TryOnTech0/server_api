const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const imageSchema = new mongoose.Schema({
  originalName: { 
    type: String, 
    required: true 
  },
  fileName: {
    type: String,
    required: true
  },
  fileUrl: { 
    type: String, 
    required: true 
  },
  filePath: {
    type: String,
    required: false
  },
  storageType: {
    type: String,
    enum: ['s3', 'local'],
    default: 's3',
    required: true
  },
  userId: { 
    type: String, 
    required: true 
  },
  metadata: {
    size: {
      type: Number,
      required: false
    },
    mimeType: {
      type: String,
      required: false
    },
    bucket: {
      type: String,
      required: false
    },
    storagePath: {
      type: String,
      required: false
    }
  }
}, { 
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Add pagination plugin
imageSchema.plugin(mongoosePaginate);

// Add text index for search
imageSchema.index({ originalName: 'text' });

module.exports = mongoose.model('Image', imageSchema);