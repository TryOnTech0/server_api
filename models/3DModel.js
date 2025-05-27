const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const threeDModelSchema = new mongoose.Schema({
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
  format: {
    type: String,
    enum: ['obj', 'fbx', 'glb', 'gltf', 'stl', 'dae', '3ds', 'blend'],
    required: true
  },
  metadata: {
    size: {
      type: Number,
      required: true
    },
    verticesCount: {
      type: Number,
      required: true,
      default: 0
    },
    facesCount: {
      type: Number,
      required: true,
      default: 0
    },
    materials: {
      type: [String],
      default: []
    },
    textures: {
      type: [String],
      default: []
    },
    description: {
      type: String,
      trim: true
    },
    previewImageUrl: {
      type: String
    },
    tags: {
      type: [String],
      default: []
    },
    previewImage: {
      type: {
        url: String,
        filePath: String
      }
    },
    thumbnail: {
      type: {
        url: String,
        filePath: String
      }
    },
    boundingBox: {
      min: {
        x: Number,
        y: Number,
        z: Number
      },
      max: {
        x: Number,
        y: Number,
        z: Number
      }
    },
    dimensions: {
      width: Number,
      height: Number,
      depth: Number
    },
    center: {
      x: Number,
      y: Number,
      z: Number
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
  },
  previewImages: [{
    url: String,
    filePath: String,
    description: String
  }]
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
threeDModelSchema.index({ description: 'text', tags: 'text' });

// Add pagination plugin
threeDModelSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('3DModel', threeDModelSchema);
