const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Admin = require('../src/models/Admin');

dotenv.config();

const createSuperAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const superAdmin = await Admin.create({
      fullname: 'Sami Jelassi',
      email: 'samijelassi@pinkink.com',
      dateofbirth: '1999-09-29',
      gender: 'male',
      password: 'Lmonjisteank80',
      role: 'super_admin',
    });
    
    console.log('Super Admin created:', superAdmin.email);
    process.exit();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

createSuperAdmin();