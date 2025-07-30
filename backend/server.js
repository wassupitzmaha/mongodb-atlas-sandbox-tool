// MongoDB Atlas Sandbox Backend Server
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Import our integrated services
import atlasAuth from './services/atlasAuth.js';
import atlasApi from './services/atlasApi.js';
import snapshotManager from './services/snapshotManager.js';

// Import routes
import authRoutes from './routes/auth.js';
import clusterRoutes from './routes/clusters.js';
import snapshotRoutes from './routes/snapshots.js';

// Import middleware
import errorHandler from './middleware/errorHandler.js';
import atlasAuthMiddleware from './middleware/atlasAuth.js';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
    'ATLAS_CLIENT_ID',
    'ATLAS_CLIENT_SECRET', 
    'ATLAS_GROUP_ID',
    'PRODUCTION_CLUSTER_NAME'
];

for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        console.error(`❌ Missing required environment variable: ${envVar}`);
        process.exit(1);
    }
}

// Create Express application
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware Setup
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`${timestamp} - ${req.method} ${req.path}`);
    next();
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        // Test Atlas connectivity
        const isAtlasConnected = await atlasAuth.isTokenValid() || 
            await atlasAuth.getAuthToken().then(() => true).catch(() => false);
        
        res.json({
            status: 'OK',
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV,
            atlasConnected: isAtlasConnected,
            productionCluster: process.env.PRODUCTION_CLUSTER_NAME,
            services: {
                auth: 'operational',
                clusters: 'operational', 
                snapshots: 'operational'
            }
        });
    } catch (error) {
        res.status(503).json({
            status: 'ERROR',
            message: 'Health check failed',
            error: error.message
        });
    }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/clusters', atlasAuthMiddleware, clusterRoutes);
app.use('/api/snapshots', atlasAuthMiddleware, snapshotRoutes);

// Global error handler (must be last)
app.use(errorHandler);

// 404 handler for undefined routes
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl,
        message: 'The requested API endpoint does not exist'
    });
});

// Initialize server
async function startServer() {
    try {
        // Test Atlas connection on startup
        console.log('🔄 Testing Atlas connection...');
        await atlasAuth.getAuthToken();
        console.log('✅ Atlas connection successful');
        
        // Test production cluster access
        console.log('🔄 Testing production cluster access...');
        const prodCluster = await atlasApi.getCluster(process.env.PRODUCTION_CLUSTER_NAME);
        console.log(`✅ Production cluster accessible: ${prodCluster.name} (${prodCluster.stateName})`);
        
        // Test snapshot availability
        console.log('🔄 Testing snapshot availability...');
        const validation = await snapshotManager.validateSnapshotAvailability();
        console.log(`✅ ${validation.totalSnapshots} snapshots available`);
        
        // Start server
        app.listen(PORT, () => {
            console.log(`\n🚀 Atlas Sandbox Server running on port ${PORT}`);
            console.log(`📊 Environment: ${process.env.NODE_ENV}`);
            console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
            console.log(`📸 Production cluster: ${process.env.PRODUCTION_CLUSTER_NAME}`);
            console.log(`🎯 Ready to deploy sandbox environments!\n`);
        });
        
    } catch (error) {
        console.error('❌ Server startup failed:', error.message);
        console.error('💡 Please check your Atlas credentials and network connectivity');
        process.exit(1);
    }
}

// Graceful shutdown handling
process.on('SIGTERM', () => {
    console.log('📊 SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('📊 SIGINT received, shutting down gracefully');
    process.exit(0);
});

// Start the server
startServer();