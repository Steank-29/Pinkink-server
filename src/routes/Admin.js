const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
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
} = require('../controllers/Admin');
const { protect, authorize } = require('../middleware/auth');

const upload = multer({ dest: 'uploads/' });

// ==================== PUBLIC ROUTES ====================
router.post('/login', loginAdmin);

// ==================== PROTECTED ROUTES (Admin/Super Admin) ====================
// Self management (logged in admin can manage their own profile)
router.get('/me/profile', protect, getMyProfile);
router.put('/me/profile', protect, updateMyProfile);

// ==================== SUPER ADMIN ONLY ROUTES ====================
router.post('/register', protect, authorize('super_admin'), registerAdmin);
router.get('/', protect, authorize('super_admin'), getAllAdmins);
router.get('/:id', protect, authorize('super_admin'), getAdminById);
router.put('/:id', protect, authorize('super_admin'), updateAdmin);
router.delete('/:id', protect, authorize('super_admin'), deleteAdmin);
router.put('/:id/password', protect, authorize('super_admin'), updatePassword);
router.patch('/:id/toggle-status', protect, authorize('super_admin'), toggleAdminStatus);
router.post('/upload-image', protect, upload.single('image'), uploadAdminImage);

module.exports = router;