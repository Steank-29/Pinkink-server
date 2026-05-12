const Poster = require('../models/Poster');
const cloudinary = require('../config/cloudinary');

// ==================== HELPERS ====================

// Helper function to upload image to Cloudinary
const uploadToCloudinary = async (file, folder = 'posters') => {
  try {
    const result = await cloudinary.uploader.upload(file, {
      folder: folder,
      use_filename: true,
      unique_filename: true,
    });
    return {
      url: result.secure_url,
      publicId: result.public_id,
    };
  } catch (error) {
    throw new Error(`Image upload failed: ${error.message}`);
  }
};

// Helper function to delete image from Cloudinary
const deleteFromCloudinary = async (publicId) => {
  try {
    await cloudinary.uploader.destroy(publicId);
    return true;
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    return false;
  }
};

// Helper to format poster response
const formatPosterResponse = (poster) => {
  return {
    _id: poster._id,
    name: poster.name,
    description: poster.description,
    sizes: poster.sizes.map(size => ({
      size: size.size,
      height: size.height,
      width: size.width,
      price: size.price,
      stock: size.stock,
      sku: size.sku,
      discountedPrice: size.price * (1 - (poster.discount || 0) / 100),
    })),
    mainImage: poster.mainImage,
    moreImages: poster.moreImages,
    discount: poster.discount,
    tags: poster.tags,
    totalStock: poster.totalStock,
    status: poster.status,
    slug: poster.slug,
    inStock: poster.inStock,
    minPrice: poster.minPrice,
    maxPrice: poster.maxPrice,
    createdAt: poster.createdAt,
    updatedAt: poster.updatedAt,
  };
};

// ==================== PUBLIC ROUTES (Frontend) ====================

// @desc    Get all posters (with filters, pagination, sorting)
// @route   GET /api/posters
// @access  Public
const getPosters = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      sort = '-createdAt',
      status = 'active',
      tags,
      minPrice,
      maxPrice,
      inStock,
      search,
      discount,
    } = req.query;

    // Build query
    let query = { status: 'active' };
    
    // Filter by tags
    if (tags) {
      const tagsArray = tags.split(',');
      query.tags = { $in: tagsArray };
    }
    
    // Filter by price range
    if (minPrice || maxPrice) {
      query['sizes.price'] = {};
      if (minPrice) query['sizes.price'].$gte = parseFloat(minPrice);
      if (maxPrice) query['sizes.price'].$lte = parseFloat(maxPrice);
    }
    
    // Filter by discount
    if (discount === 'true') {
      query.discount = { $gt: 0 };
    }
    
    // Filter by stock availability
    if (inStock === 'true') {
      query.totalStock = { $gt: 0 };
    }
    
    // Search by name or tags
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
      ];
    }
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Execute query
    const posters = await Poster.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Poster.countDocuments(query);
    
    res.status(200).json({
      success: true,
      data: posters.map(formatPosterResponse),
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

// @desc    Get single poster by ID or slug
// @route   GET /api/posters/:id
// @access  Public
const getPosterById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if id is mongo id or slug
    const query = id.match(/^[0-9a-fA-F]{24}$/) 
      ? { _id: id, status: 'active' }
      : { slug: id, status: 'active' };
    
    const poster = await Poster.findOne(query);
    
    if (!poster) {
      return res.status(404).json({
        success: false,
        message: 'Poster not found',
      });
    }
    
    res.status(200).json({
      success: true,
      data: formatPosterResponse(poster),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get posters by tags
// @route   GET /api/posters/tags/:tag
// @access  Public
const getPostersByTag = async (req, res) => {
  try {
    const { tag } = req.params;
    const { limit = 20 } = req.query;
    
    const posters = await Poster.findByTag(tag).limit(parseInt(limit));
    
    res.status(200).json({
      success: true,
      count: posters.length,
      data: posters.map(formatPosterResponse),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get discounted posters
// @route   GET /api/posters/discounted
// @access  Public
const getDiscountedPosters = async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    
    const posters = await Poster.findDiscounted().limit(parseInt(limit));
    
    res.status(200).json({
      success: true,
      count: posters.length,
      data: posters.map(formatPosterResponse),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get all unique tags
// @route   GET /api/posters/tags/all
// @access  Public
const getAllTags = async (req, res) => {
  try {
    const tags = await Poster.distinct('tags', { status: 'active' });
    
    res.status(200).json({
      success: true,
      count: tags.length,
      data: tags.sort(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Check stock for a specific size
// @route   GET /api/posters/:id/check-stock
// @access  Public
const checkStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { size } = req.query;
    
    const poster = await Poster.findById(id);
    if (!poster) {
      return res.status(404).json({
        success: false,
        message: 'Poster not found',
      });
    }
    
    const sizeInfo = poster.sizes.find(s => s.size === size);
    if (!sizeInfo) {
      return res.status(404).json({
        success: false,
        message: 'Size not found',
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        size: sizeInfo.size,
        inStock: sizeInfo.stock > 0,
        stock: sizeInfo.stock,
        price: sizeInfo.price,
        discountedPrice: sizeInfo.price * (1 - poster.discount / 100),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== ADMIN ROUTES (Protected) ====================

// @desc    Create new poster
// @route   POST /api/posters
// @access  Private/Admin
const createPoster = async (req, res) => {
  try {
    const {
      name,
      description,
      sizes,
      mainImage,
      moreImages = [],
      discount,
      tags,
      status,
      metaTitle,
      metaDescription,
    } = req.body;
    
    // Validate required fields
    if (!name || !sizes || !mainImage) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, sizes, and mainImage',
      });
    }
    
    // Validate sizes
    for (const size of sizes) {
      if (!size.size || !size.height || !size.width || !size.price) {
        return res.status(400).json({
          success: false,
          message: 'Each size must have size, height, width, and price',
        });
      }
    }
    
    const poster = await Poster.create({
      name,
      description,
      sizes,
      mainImage,
      moreImages,
      discount: discount || 0,
      tags: tags || [],
      status: status || 'draft',
      metaTitle,
      metaDescription,
    });
    
    res.status(201).json({
      success: true,
      message: 'Poster created successfully',
      data: formatPosterResponse(poster),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update poster
// @route   PUT /api/posters/:id
// @access  Private/Admin
const updatePoster = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const poster = await Poster.findById(id);
    if (!poster) {
      return res.status(404).json({
        success: false,
        message: 'Poster not found',
      });
    }
    
    // Update fields
    Object.keys(updates).forEach(key => {
      if (key !== '_id' && key !== '__v') {
        poster[key] = updates[key];
      }
    });
    
    await poster.save();
    
    res.status(200).json({
      success: true,
      message: 'Poster updated successfully',
      data: formatPosterResponse(poster),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Delete poster
// @route   DELETE /api/posters/:id
// @access  Private/Admin
const deletePoster = async (req, res) => {
  try {
    const { id } = req.params;
    
    const poster = await Poster.findById(id);
    if (!poster) {
      return res.status(404).json({
        success: false,
        message: 'Poster not found',
      });
    }
    
    // Delete main image from Cloudinary
    if (poster.mainImage && poster.mainImage.publicId) {
      await deleteFromCloudinary(poster.mainImage.publicId);
    }
    
    // Delete more images from Cloudinary
    for (const image of poster.moreImages) {
      if (image.publicId) {
        await deleteFromCloudinary(image.publicId);
      }
    }
    
    await poster.deleteOne();
    
    res.status(200).json({
      success: true,
      message: 'Poster deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update stock for a specific size
// @route   PATCH /api/posters/:id/stock
// @access  Private/Admin
const updateStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { size, quantity, operation = 'subtract' } = req.body;
    
    const poster = await Poster.findById(id);
    if (!poster) {
      return res.status(404).json({
        success: false,
        message: 'Poster not found',
      });
    }
    
    let updatedPoster;
    if (operation === 'subtract') {
      updatedPoster = await poster.updateStock(size, quantity);
    } else if (operation === 'add') {
      updatedPoster = await poster.addStock(size, quantity);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Operation must be either "add" or "subtract"',
      });
    }
    
    res.status(200).json({
      success: true,
      message: `Stock ${operation === 'add' ? 'added' : 'subtracted'} successfully`,
      data: {
        size,
        newStock: updatedPoster.sizes.find(s => s.size === size).stock,
        totalStock: updatedPoster.totalStock,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Upload poster image
// @route   POST /api/posters/upload-image
// @access  Private/Admin
const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided',
      });
    }
    
    const imageData = await uploadToCloudinary(req.file.path, 'posters');
    
    res.status(200).json({
      success: true,
      data: imageData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Delete poster image
// @route   DELETE /api/posters/delete-image
// @access  Private/Admin
const deleteImage = async (req, res) => {
  try {
    const { publicId } = req.body;
    
    if (!publicId) {
      return res.status(400).json({
        success: false,
        message: 'Public ID is required',
      });
    }
    
    await deleteFromCloudinary(publicId);
    
    res.status(200).json({
      success: true,
      message: 'Image deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Bulk update status
// @route   PATCH /api/posters/bulk/status
// @access  Private/Admin
const bulkUpdateStatus = async (req, res) => {
  try {
    const { ids, status } = req.body;
    
    if (!ids || !ids.length) {
      return res.status(400).json({
        success: false,
        message: 'Please provide poster IDs',
      });
    }
    
    await Poster.updateMany(
      { _id: { $in: ids } },
      { status }
    );
    
    res.status(200).json({
      success: true,
      message: `${ids.length} posters updated successfully`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get low stock posters (for admin alert)
// @route   GET /api/posters/admin/low-stock
// @access  Private/Admin
const getLowStockPosters = async (req, res) => {
  try {
    const { threshold = 5 } = req.query;
    
    const posters = await Poster.find({
      'sizes.stock': { $lt: parseInt(threshold), $gt: 0 },
    });
    
    const lowStockItems = [];
    posters.forEach(poster => {
      poster.sizes.forEach(size => {
        if (size.stock < parseInt(threshold) && size.stock > 0) {
          lowStockItems.push({
            posterId: poster._id,
            posterName: poster.name,
            size: size.size,
            stock: size.stock,
            mainImage: poster.mainImage.url,
          });
        }
      });
    });
    
    res.status(200).json({
      success: true,
      count: lowStockItems.length,
      data: lowStockItems,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  // Public
  getPosters,
  getPosterById,
  getPostersByTag,
  getDiscountedPosters,
  getAllTags,
  checkStock,
  // Admin
  createPoster,
  updatePoster,
  deletePoster,
  updateStock,
  uploadImage,
  deleteImage,
  bulkUpdateStatus,
  getLowStockPosters,
};