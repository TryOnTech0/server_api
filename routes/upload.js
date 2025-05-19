// routes/upload.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads')); // relative değil, absolute path
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + path.extname(file.originalname);
    cb(null, 'cloth-' + uniqueSuffix);
  }
});

const upload = multer({ storage: storage });

//  BURADA "image" POSTMAN'de key olarak girilmek zorunda!
router.post('/', upload.single('image'), (req, res) => {
  console.log('req.file:', req.file);
  console.log('req.body:', req.body);

  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  res.status(200).json({
    message: 'Image uploaded successfully',
    filePath: req.file.path,
  });
});

module.exports = router;

