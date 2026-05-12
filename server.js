const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./src/config/db');

dotenv.config();

// Colorful console styles
const colors = {
  pink: '\x1b[35m',
  brightPink: '\x1b[38;5;205m',
  darkPink: '\x1b[38;5;162m',
  white: '\x1b[37m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

const printBanner = () => {
  console.log(colors.brightPink + `
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║     ██████╗ ██╗███╗   ██╗██╗  ██╗██╗███╗   ██╗██╗  ██╗    ║
║     ██╔══██╗██║████╗  ██║██║ ██╔╝██║████╗  ██║██║ ██╔╝    ║
║     ██████╔╝██║██╔██╗ ██║█████╔╝ ██║██╔██╗ ██║█████╔╝     ║
║     ██╔═══╝ ██║██║╚██╗██║██╔═██╗ ██║██║╚██╗██║██╔═██╗     ║
║     ██║     ██║██║ ╚████║██║  ██╗██║██║ ╚████║██║  ██╗    ║
║     ╚═╝     ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝    ║
║                                                           ║
║              PinkInk Server v1.0                          ║
╚═══════════════════════════════════════════════════════════╝
` + colors.reset);
};

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple request logger
app.use((req, res, next) => {
  console.log(colors.pink + `➜ ${req.method}` + colors.reset + ` ${req.url}`);
  next();
});

// Test route
app.get('/api/test', (req, res) => {
  console.log(colors.green + '✓ Test endpoint called' + colors.reset);
  res.json({ 
    success: true, 
    message: '🌸 PinkInk API is working beautifully! 🌸',
    timestamp: new Date().toISOString()
  });
});

// Welcome route
app.get('/', (req, res) => {
  res.json({
    name: 'PinkInk API',
    version: '1.0.0',
    status: 'active',
    message: '💕 Welcome to PinkInk Backend 💕',
    endpoints: {
      test: '/api/test',
      products: '/api/products',
      categories: '/api/categories',
      auth: '/api/auth',
      orders: '/api/orders'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: `❌ Cannot find ${req.url} on PinkInk server` 
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.log(colors.red + '❌ Error:', err.message + colors.reset);
  res.status(500).json({ 
    success: false, 
    message: 'Something went wrong on PinkInk server! 💔',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// Connect to database and start server
const startServer = async () => {
  try {
    // Show banner
    printBanner();
    
    // Connect to MongoDB
    console.log(colors.pink + '📡 Connecting to MongoDB...' + colors.reset);
    await connectDB();
    
    console.log(colors.green + '✓ MongoDB Connected Successfully' + colors.reset);
    
    // Start server
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(colors.brightPink + `
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ✨ PinkInk Server is Running! ✨                        ║
║                                                           ║
║   📍 URL: http://localhost:${PORT}                            ║
║   🧪 Test: http://localhost:${PORT}/api/test                  ║
║   💚 Status: ONLINE                                        ║
║                                                           ║
║   💕 Ready to serve PinkInk! 💕                          ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
` + colors.reset);
      
      // Console heart
      console.log(colors.pink + '🌸 PinkInk Server' + colors.reset + ' - ' + colors.brightPink + 'Made with 💕' + colors.reset);
    });
    
  } catch (error) {
    console.log(colors.red + '❌ Failed to start server:', error.message + colors.reset);
    process.exit(1);
  }
};

// Start the server
startServer();