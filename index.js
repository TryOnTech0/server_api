require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const uploadRoutes = require('./routes/upload');
const { ErrorResponse } = require('./controllers/utils');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Log all requests
app.use((req, res, next) => {
  console.log(`\n=== NEW REQUEST ===`);
  console.log(`Method: ${req.method}`);
  console.log('Path:', req.path);
  console.log('Headers:', req.headers);
  console.log('Content-Type:', req.get('Content-Type'));
  next();
});

// Import routes
const imageRoutes = require('./routes/images');
const intArrayRoutes = require('./routes/intArrays');
const objFileRoutes = require('./routes/objFiles');
const threeDModelRoutes = require('./routes/3dmodels');
const authRoutes = require('./routes/auth');

// Mount routers
app.use('/api/v1/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/intarrays', intArrayRoutes);
app.use('/api/objfiles', objFileRoutes);
app.use('/api/3dmodels', threeDModelRoutes);

// Health check endpoint
app.get('/', (req, res) => {
  res.send('Image Upload API is running');
});

// Handle 404 - Route not found
app.use((req, res, next) => {
  next(new ErrorResponse(`Not Found - ${req.originalUrl}`, 404));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  const statusCode = err.statusCode || 500;
  const error = {
    success: false,
    error: err.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  };

  res.status(statusCode).json(error);
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