require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const uploadRoutes = require('./routes/upload');

// Initialize Express app
const app = express();

// Middleware
app.use(cors()); // Enable CORS
app.use(express.json()); // Parse JSON bodies

// Routes
app.use('/api/upload', uploadRoutes);

// Health check endpoint
app.get('/', (req, res) => {
  res.send('Image Upload API is running');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error stack:', err.stack);
  res.status(500).json({
    success: false,
    error: err.message || 'Something went wrong!',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});