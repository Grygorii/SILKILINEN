const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const productRoutes = require('./routes/products');
const authRoutes = require('./routes/auth');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();

app.use(cors({
  origin: ['http://localhost:3001', 'https://silkilinen.vercel.app'],
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use('/api/products', productRoutes);
app.use('/api/auth', authRoutes);

mongoose.connect(process.env.MONGODB_URI)
  .then(function() {
    console.log('Connected to MongoDB');
  })
  .catch(function(err) {
    console.log('MongoDB connection error:', err);
  });

app.get('/', function(req, res) {
  res.send('Silkilinen backend is running');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, function() {
  console.log('Server running on port ' + PORT);
});