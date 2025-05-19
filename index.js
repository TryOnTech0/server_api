const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./db');

dotenv.config();

const app = express();

// MongoDB bağlantısı
connectDB();

app.use(cors());
app.use(express.json());

// Routes

const clothesRoutes = require('./routes/clothes');
app.use('/api/clothes', clothesRoutes);

const uploadRoutes = require('./routes/upload');
app.use('/api/upload', uploadRoutes);

app.use('/uploads', express.static('uploads'));



// Basit ana endpoint
app.get('/', (req, res) => {
  res.send('Server is running!');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server started on http://localhost:${PORT}`);
});

