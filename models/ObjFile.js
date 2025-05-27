const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const objFileSchema = new mongoose.Schema({
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
  metadata: {
    size: {
      type: Number,
      required: true
    },
    verticesCount: {
      type: Number,
      required: true
    },
    facesCount: {
      type: Number,
      required: true
    },
    description: {
      type: String,
      trim: true
    },
    materials: {
      type: [String],
      default: []
    },
    textures: {
      type: [String],
      default: []
    }
  },
  userId: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
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

// Add text index for search
objFileSchema.index({ description: 'text' });

// Add pagination plugin
objFileSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('ObjFile', objFileSchema);
