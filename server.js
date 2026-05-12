const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./src/config/db');
const mongoose = require('mongoose');

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
  origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174', 'https://pinkink.vercel.app', 'https://pinkink-frontend.vercel.app'],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple request logger
app.use((req, res, next) => {
  console.log(colors.pink + `➜ ${req.method}` + colors.reset + ` ${req.url}`);
  next();
});

// ==================== HEALTH CHECK ENDPOINTS FOR UPTIMEROBOT ====================

// Simple health check - returns 200 if server is running
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Detailed health check with database connection status
app.get('/health/detailed', async (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  const isDbConnected = dbState === 1;
  
  const healthStatus = {
    status: isDbConnected ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    uptimeFormatted: formatUptime(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    database: {
      status: dbStatus[dbState] || 'unknown',
      connected: isDbConnected,
      name: mongoose.connection.name || 'N/A',
      host: mongoose.connection.host || 'N/A'
    },
    memory: {
      rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`
    },
    version: '1.0.0',
    endpoints: {
      health: '/health',
      detailed: '/health/detailed',
      ping: '/ping',
      test: '/api/test'
    }
  };

  const statusCode = isDbConnected ? 200 : 503;
  res.status(statusCode).json(healthStatus);
});

// Simple ping endpoint - fastest response (best for UptimeRobot)
app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// Metrics endpoint for monitoring services
app.get('/metrics', (req, res) => {
  res.json({
    service: 'pinkink-backend',
    status: 'operational',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    dbStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime: process.uptime()
  });
});

// Helper function to format uptime
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  
  return parts.join(' ');
}

// ==================== REGULAR API ENDPOINTS ====================

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
    health: {
      ping: '/ping',
      health: '/health',
      detailed: '/health/detailed',
      metrics: '/metrics'
    },
    endpoints: {
      test: '/api/test',
      products: '/api/products',
      categories: '/api/categories',
      auth: '/api/auth',
      orders: '/api/orders',
      cart: '/api/cart',
      offers: '/api/offers'
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
    app.listen(PORT, '0.0.0.0', () => {
      console.log(colors.brightPink + `
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ✨ PinkInk Server is Running! ✨                        ║
║                                                           ║
║   📍 URL: http://localhost:${PORT}                            ║
║   🧪 Test: http://localhost:${PORT}/api/test                  ║
║   ❤️ Health: http://localhost:${PORT}/health                  ║
║   🏓 Ping: http://localhost:${PORT}/ping                      ║
║   💚 Status: ONLINE                                        ║
║                                                           ║
║   💕 Ready to serve PinkInk! 💕                          ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
` + colors.reset);
      
      console.log(colors.pink + '🌸 PinkInk Server' + colors.reset + ' - ' + colors.brightPink + 'Made with 💕' + colors.reset);
    });
    
  } catch (error) {
    console.log(colors.red + '❌ Failed to start server:', error.message + colors.reset);
    process.exit(1);
  }
};

// Start the server
startServer();