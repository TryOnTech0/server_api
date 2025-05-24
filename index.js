require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const uploadRoutes = require('./routes/upload');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Log all requests
app.use((req, res, next) => {
  console.log(`\n=== NEW REQUEST ===`);
  console.log(`Method: ${req.method}`);
  console.log('Headers:', req.headers);
  console.log('Content-Type:', req.get('Content-Type'));
  next();
});

// Import routes
const imageRoutes = require('./routes/images');

// Routes
app.use('/api/upload', uploadRoutes);
app.use('/api/images', imageRoutes);

// Health check endpoint
app.get('/', (req, res) => {
  res.send('Image Upload API is running');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\nServer running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Upload limit: ${process.env.FILE_UPLOAD_LIMIT || '10MB'}`);
});