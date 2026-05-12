const mongoose = require('mongoose');

// Size schema for different dimensions with specific prices
const posterSizeSchema = new mongoose.Schema({
  size: {
    type: String,
    required: [true, 'Size dimensions are required'],
    trim: true,
    example: '104x205',
  },
  height: {
    type: Number,
    required: true,
    description: 'Height in cm',
  },
  width: {
    type: Number,
    required: true,
    description: 'Width in cm',
  },
  price: {
    type: Number,
    required: [true, 'Price for this size is required'],
    min: 0,
  },
  stock: {
    type: Number,
    default: 0,
    min: 0,
    description: 'Number of posters available in this size',
  },
  sku: {
    type: String,
    unique: true,
    sparse: true,
    description: 'Stock Keeping Unit for this size variant',
  },
});

const posterSchema = new mongoose.Schema({
  // Required fields
  name: {
    type: String,
    required: [true, 'Poster name is required'],
    trim: true,
    maxlength: [200, 'Name cannot exceed 200 characters'],
  },
  
  description: {
    type: String,
    default: '',
    maxlength: [2000, 'Description cannot exceed 2000 characters'],
  },
  
  // Size variants with different prices (dynamic pricing by size)
  sizes: [posterSizeSchema],
  
  // Main image (required)
  mainImage: {
    url: {
      type: String,
      required: [true, 'Main image URL is required'],
    },
    publicId: {
      type: String,
      required: true,
    },
    alt: {
      type: String,
      default: '',
    },
  },
  
  // Additional images (not required)
  moreImages: [{
    url: {
      type: String,
      required: true,
    },
    publicId: {
      type: String,
      required: true,
    },
    alt: {
      type: String,
      default: '',
    },
  }],
  
  // Discount by percentage
  discount: {
    type: Number,
    default: 0,
    min: [0, 'Discount cannot be negative'],
    max: [90, 'Discount cannot exceed 90%'],
  },
  
  // Tags (manual entry)
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
  }],
  
  // Total stock across all sizes
  totalStock: {
    type: Number,
    default: 0,
    min: 0,
  },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'draft', 'out_of_stock'],
    default: 'active',
  },
  
  // Seo fields
  slug: {
    type: String,
    unique: true,
    sparse: true,
  },
  metaTitle: String,
  metaDescription: String,
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes for better query performance
posterSchema.index({ name: 'text' });
posterSchema.index({ tags: 1 });
posterSchema.index({ status: 1 });
posterSchema.index({ 'sizes.size': 1 });

// Virtual: Get all available sizes as array of strings
posterSchema.virtual('availableSizes').get(function() {
  return this.sizes.map(s => s.size);
});

// Virtual: Get minimum price across all sizes
posterSchema.virtual('minPrice').get(function() {
  if (this.sizes.length === 0) return 0;
  return Math.min(...this.sizes.map(s => s.price));
});

// Virtual: Get maximum price across all sizes
posterSchema.virtual('maxPrice').get(function() {
  if (this.sizes.length === 0) return 0;
  return Math.max(...this.sizes.map(s => s.price));
});

// Virtual: Get discounted price for each size
posterSchema.virtual('sizesWithDiscount').get(function() {
  return this.sizes.map(size => ({
    ...size.toObject(),
    originalPrice: size.price,
    discountedPrice: size.price * (1 - this.discount / 100),
    discountAmount: size.price * (this.discount / 100),
  }));
});

// Virtual: Check if poster is in stock (any size has stock > 0)
posterSchema.virtual('inStock').get(function() {
  return this.sizes.some(size => size.stock > 0);
});

// Pre-save middleware: Calculate total stock (without next)
posterSchema.pre('save', function() {
  // Calculate total stock from all sizes
  this.totalStock = this.sizes.reduce((sum, size) => sum + (size.stock || 0), 0);
  
  // Auto-update status based on stock
  if (this.status === 'active' && this.totalStock === 0) {
    this.status = 'out_of_stock';
  } else if (this.status === 'out_of_stock' && this.totalStock > 0) {
    this.status = 'active';
  }
  
  // Generate slug from name if not provided
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
});

// Method: Update stock for a specific size
posterSchema.methods.updateStock = async function(sizeValue, quantity) {
  const sizeIndex = this.sizes.findIndex(s => s.size === sizeValue);
  if (sizeIndex === -1) {
    throw new Error(`Size ${sizeValue} not found`);
  }
  
  const currentStock = this.sizes[sizeIndex].stock;
  const newStock = currentStock - quantity;
  
  if (newStock < 0) {
    throw new Error(`Insufficient stock for size ${sizeValue}. Available: ${currentStock}`);
  }
  
  this.sizes[sizeIndex].stock = newStock;
  this.totalStock = this.sizes.reduce((sum, s) => sum + s.stock, 0);
  
  await this.save();
  return this;
};

// Method: Add stock for a specific size
posterSchema.methods.addStock = async function(sizeValue, quantity) {
  const sizeIndex = this.sizes.findIndex(s => s.size === sizeValue);
  if (sizeIndex === -1) {
    throw new Error(`Size ${sizeValue} not found`);
  }
  
  this.sizes[sizeIndex].stock += quantity;
  this.totalStock = this.sizes.reduce((sum, s) => sum + s.stock, 0);
  
  await this.save();
  return this;
};

// Static method: Get posters by tag
posterSchema.statics.findByTag = function(tag) {
  return this.find({ tags: tag, status: 'active' });
};

// Static method: Get discounted posters
posterSchema.statics.findDiscounted = function() {
  return this.find({ discount: { $gt: 0 }, status: 'active' }).sort({ discount: -1 });
};

// Method: Calculate price for a specific size with discount
posterSchema.methods.getPriceForSize = function(sizeValue) {
  const size = this.sizes.find(s => s.size === sizeValue);
  if (!size) return null;
  
  const discountedPrice = size.price * (1 - this.discount / 100);
  return {
    originalPrice: size.price,
    discountedPrice: Math.round(discountedPrice * 100) / 100,
    discountPercentage: this.discount,
    size: size.size,
    inStock: size.stock > 0,
    stock: size.stock,
  };
};

module.exports = mongoose.model('Poster', posterSchema);