const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const productRoutes = require('./routes/products');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/products', productRoutes);
console.log('Products route registered');

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
