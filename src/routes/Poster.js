const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  // Public
  getPosters,
  getPosterById,
  getPostersByTag,
  getDiscountedPosters,
  getAllTags,
  checkStock,
  // super_admin
  createPoster,
  updatePoster,
  deletePoster,
  updateStock,
  uploadImage,
  deleteImage,
  bulkUpdateStatus,
  getLowStockPosters,
} = require('../controllers/Poster');
const { protect, authorize } = require('../middleware/auth');

const upload = multer({ dest: 'uploads/' });

// ==================== PUBLIC ROUTES (No auth required) ====================
router.get('/', getPosters);
router.get('/tags/all', getAllTags);
router.get('/tags/:tag', getPostersByTag);
router.get('/discounted', getDiscountedPosters);
router.get('/check-stock/:id', checkStock);
router.get('/:id', getPosterById);

// ==================== super_admin ROUTES (Auth required) ====================
// All super_admin routes require authentication and super_admin role
router.post('/', protect, authorize('super_admin'), createPoster);
router.put('/:id', protect, authorize('super_admin'), updatePoster);
router.delete('/:id', protect, authorize('super_admin'), deletePoster);
router.patch('/:id/stock', protect, authorize('super_admin'), updateStock);
router.patch('/bulk/status', protect, authorize('super_admin'), bulkUpdateStatus);
router.get('/admin/low-stock', protect, authorize('super_admin'), getLowStockPosters);
router.post('/upload-image', protect, authorize('super_admin'), upload.single('image'), uploadImage);
router.delete('/delete-image', protect, authorize('super_admin'), deleteImage);

module.exports = router;