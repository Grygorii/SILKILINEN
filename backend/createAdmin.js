const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function createAdmin() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  await User.deleteMany({ email: 'admin@silkilinen.com' });
  
  await User.create({
    email: 'admin@silkilinen.com',
    password: 'SilkAdmin2025!',
    role: 'admin'
  });
  
  console.log('Admin user created successfully');
  mongoose.connection.close();
}

createAdmin().catch(console.error);