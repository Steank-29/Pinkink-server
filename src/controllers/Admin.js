const Admin = require('../models/Admin');
const jwt = require('jsonwebtoken');
const cloudinary = require('../config/cloudinary');

// Helper to generate token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

// Helper to format admin response
const formatAdminResponse = (admin) => {
  return {
    _id: admin._id,
    fullname: admin.fullname,
    email: admin.email,
    dateofbirth: admin.dateofbirth,
    gender: admin.gender,
    image: admin.image,
    role: admin.role,
    isActive: admin.isActive,
    lastLogin: admin.lastLogin,
    createdAt: admin.createdAt,
    updatedAt: admin.updatedAt,
  };
};

// ==================== AUTH ROUTES ====================

// @desc    Login admin
// @route   POST /api/admins/login
// @access  Public
// @desc    Login admin
// @route   POST /api/admins/login
// @access  Public
const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password',
      });
    }

    // Check if admin exists
    const admin = await Admin.findOne({ email }).select('+password');
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Check if admin is active
    if (!admin.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Your account is deactivated. Please contact super admin.',
      });
    }

    // Check password
    const isPasswordMatch = await admin.comparePassword(password);
    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Update last login
    admin.lastLogin = Date.now();
    await admin.save();

    // Format user data to match frontend expectations
    const userData = {
      _id: admin._id,
      name: admin.fullname,  // Map fullname to name for frontend
      email: admin.email,
      role: admin.role,
      image: admin.image,
    };

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token: generateToken(admin._id),
        user: userData,  // Send as 'user' instead of 'admin'
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Register new admin (Super Admin only)
// @route   POST /api/admins/register
// @access  Private/Super Admin
// @desc    Register new admin (Super Admin only)
// @route   POST /api/admins/register
// @access  Private/Super Admin
const registerAdmin = async (req, res) => {
  try {
    const { fullname, email, dateofbirth, gender, password, role } = req.body;

    // Check if admin already exists
    const adminExists = await Admin.findOne({ email });
    if (adminExists) {
      return res.status(400).json({
        success: false,
        message: 'Admin with this email already exists',
      });
    }

    // Create admin
    const admin = await Admin.create({
      fullname,
      email,
      dateofbirth,
      gender,
      password,
      role: role || 'admin',
    });

    // Format user data
    const userData = {
      _id: admin._id,
      name: admin.fullname,
      email: admin.email,
      role: admin.role,
      image: admin.image,
    };

    res.status(201).json({
      success: true,
      message: 'Admin created successfully',
      data: {
        token: generateToken(admin._id),
        user: userData,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== ADMIN MANAGEMENT ====================

// @desc    Get all admins
// @route   GET /api/admins
// @access  Private/Super Admin
const getAllAdmins = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, isActive } = req.query;
    
    let query = {};
    
    if (search) {
      query.$or = [
        { fullname: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const admins = await Admin.find(query)
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Admin.countDocuments(query);
    
    res.status(200).json({
      success: true,
      count: admins.length,
      data: admins.map(formatAdminResponse),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get single admin by ID
// @route   GET /api/admins/:id
// @access  Private/Super Admin
const getAdminById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const admin = await Admin.findById(id);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found',
      });
    }
    
    res.status(200).json({
      success: true,
      data: formatAdminResponse(admin),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update admin profile
// @route   PUT /api/admins/:id
// @access  Private (Self or Super Admin)
const updateAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Remove sensitive fields that shouldn't be updated here
    delete updates.password;
    delete updates._id;
    delete updates.createdAt;
    
    const admin = await Admin.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );
    
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found',
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Admin updated successfully',
      data: formatAdminResponse(admin),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Delete admin
// @route   DELETE /api/admins/:id
// @access  Private/Super Admin
const deleteAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Prevent deleting self
    if (id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account',
      });
    }
    
    const admin = await Admin.findByIdAndDelete(id);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found',
      });
    }
    
    // Delete image from Cloudinary if exists
    if (admin.image && admin.image.publicId) {
      await cloudinary.uploader.destroy(admin.image.publicId);
    }
    
    res.status(200).json({
      success: true,
      message: 'Admin deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update admin password
// @route   PUT /api/admins/:id/password
// @access  Private (Self or Super Admin)
const updatePassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current and new password',
      });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters',
      });
    }
    
    const admin = await Admin.findById(id).select('+password');
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found',
      });
    }
    
    const isPasswordMatch = await admin.comparePassword(currentPassword);
    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }
    
    admin.password = newPassword;
    await admin.save();
    
    res.status(200).json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Toggle admin status (activate/deactivate)
// @route   PATCH /api/admins/:id/toggle-status
// @access  Private/Super Admin
const toggleAdminStatus = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Prevent deactivating self
    if (id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own account',
      });
    }
    
    const admin = await Admin.findById(id);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found',
      });
    }
    
    admin.isActive = !admin.isActive;
    await admin.save();
    
    res.status(200).json({
      success: true,
      message: `Admin ${admin.isActive ? 'activated' : 'deactivated'} successfully`,
      data: { isActive: admin.isActive },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Upload admin profile image
// @route   POST /api/admins/upload-image
// @access  Private
const uploadAdminImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided',
      });
    }
    
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'admins',
      width: 300,
      height: 300,
      crop: 'fill',
    });
    
    res.status(200).json({
      success: true,
      data: {
        url: result.secure_url,
        publicId: result.public_id,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get current admin profile
// @route   GET /api/admins/me/profile
// @access  Private
const getMyProfile = async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found',
      });
    }
    
    res.status(200).json({
      success: true,
      data: formatAdminResponse(admin),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update my profile
// @route   PUT /api/admins/me/profile
// @access  Private
const updateMyProfile = async (req, res) => {
  try {
    const updates = req.body;
    delete updates.password;
    delete updates.email;
    delete updates.role;
    
    const admin = await Admin.findByIdAndUpdate(
      req.user.id,
      { ...updates, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );
    
    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: formatAdminResponse(admin),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  // Auth
  loginAdmin,
  registerAdmin,
  // Admin management
  getAllAdmins,
  getAdminById,
  updateAdmin,
  deleteAdmin,
  updatePassword,
  toggleAdminStatus,
  uploadAdminImage,
  // Self management
  getMyProfile,
  updateMyProfile,
};