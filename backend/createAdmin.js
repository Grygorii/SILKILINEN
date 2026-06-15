const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function createAdmin() {
  // Credentials come from the environment — never hardcode them in the repo.
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD env vars before running this script.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  await User.deleteMany({ email });

  await User.create({ email, password, role: 'admin' });

  console.log(`Admin user created: ${email}`);
  mongoose.connection.close();
}

createAdmin().catch(console.error);