const mongoose = require('mongoose');

const clothSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    size: {
      type: String,
      required: true,
    },
    color: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
    },
  },
  {
    timestamps: true, // createdAt ve updatedAt otomatik oluşur
  }
);

const Cloth = mongoose.model('Cloth', clothSchema);

module.exports = Cloth;

