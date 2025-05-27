const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const intArraySchema = new mongoose.Schema({
  data: {
    type: [Number],
    required: true,
    validate: {
      validator: function(array) {
        return array.length > 0 && array.every(Number.isInteger);
      },
      message: 'Data must be a non-empty array of integers'
    }
  },
  fileUrl: {
    type: String,
    required: false
  },
  storageType: {
    type: String,
    enum: ['s3', 'local'],
    default: 's3'
  },
  metadata: {
    size: {
      type: Number,
      default: function() { return this.data ? this.data.length : 0; }
    },
    dimensions: {
      type: [Number],
      default: [1, 1], // Default 2D array dimensions
      validate: {
        validator: function(dimensions) {
          return dimensions.length === 2 && dimensions.every(Number.isInteger);
        },
        message: 'Dimensions must be an array of two integers'
      }
    },
    description: {
      type: String,
      trim: true
    },
    storagePath: {
      type: String,
      required: false
    },
    bucket: {
      type: String,
      required: false
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
intArraySchema.index({ description: 'text' });

// Add pagination plugin
intArraySchema.plugin(mongoosePaginate);

module.exports = mongoose.model('IntArray', intArraySchema);
