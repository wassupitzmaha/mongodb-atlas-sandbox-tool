// MongoDB Atlas Sandbox Backend Server
//import the express web frame which creates our web server
import express from 'express';

//imported cors middleware - allows our react frontend to call our backend
import cors from 'cors';

//imported this to load environment variables
import dotenv from 'dotenv';

// Import our custom services that handle Api calls 
import atlasAuth from './services/atlasAuth.js';
import atlasApi from './services/atlasApi.js';
import snapshotManager from './services/snapshotManager.js';


// Import our route handler - these define what happens when someone calls our API endpoints
import authRoutes from './routes/auth.js';
import clusterRoutes from './routes/clusters.js';
import snapshotRoutes from './routes/snapshots.js';
import restoreTestRoutes from './routes/restore-test.js';

// Import custom middleware
import errorHandler from './middleware/errorHandler.js';
import atlasAuthMiddleware from './middleware/atlasAuth.js';

//loaded environment variables from .env file to process.env
dotenv.config();

//defined which env variables are absolutely necessary for our app to work
const requiredEnvVars = [
    'ATLAS_CLIENT_ID', 
    'ATLAS_CLIENT_SECRET', 
    'ATLAS_GROUP_ID',
    'PRODUCTION_CLUSTER_NAME'
];

//this checks if all of our env variables are present
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        //if any required variables is missing, log error and exit
        console.error(` Missing required environment variable: ${envVar}`);
        process.exit(1); //exit with error code 1
    }
}

// create Express application
const app = express();
const PORT = process.env.PORT || 3006;

// configure cors middleware , this allows our react app to call our api
app.use(cors({
    //allow request from our frontend url
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true //allows for cookies and creds to be sent
}));
//configures express to parse json req bodies, limit: 10 mb
app.use(express.json({ limit: '10mb' }));

//configre express to parse url encoded form data
app.use(express.urlencoded({ extended: true }));

// Request logging middleware, logs every req that comes throuhg our middleware
app.use((req, res, next) => {
    //get currrent timestamp
    const timestamp = new Date().toISOString();
    //log the http method and path
    console.log(`${timestamp} - ${req.method} ${req.path}`);
    //call next () to contine to the next middleware
    next();
});

// Health check endpoint, tells us if our serevr and atlas conenction is working
app.get('/api/health', async (req, res) => {
    try {
        // Test Atlas connectivity: test if we get a valid atlas token ( tests our atlas conenction)
        const isAtlasConnected = await atlasAuth.isTokenValid() || //checks if the atlas token is valid, it resolcves to true or false, use await and Promises
            await atlasAuth.getAuthToken().then(() => true).catch(() => false); //is isTokenValis false, the code proceeds to the right side of the code ||, attempts to obtain a new token. 
            //if successful then true but if it fails, .catch(() => false) then return false. Assigns the results to isAtlasConnected
            
        //send a json response with server status
        res.json({
            status: 'OK', //overall server status 
            timestamp: new Date().toISOString(), //when this check was performed
            environment: process.env.NODE_ENV, //Development/production env
            atlasConnected: isAtlasConnected, //tells us whether atlas is reachable
            productionCluster: process.env.PRODUCTION_CLUSTER_NAME,
            services: {
                auth: 'operational',  //auth service status 
                clusters: 'operational', //cluster service status
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

//mounted our route handlers at specific URL paths
app.use('/api/auth', authRoutes); //authentication routes
app.use('/api/clusters', atlasAuthMiddleware, clusterRoutes); //cluster routes (with auth middleware)
app.use('/api/snapshots', atlasAuthMiddleware, snapshotRoutes); //snapshot routes (with auth middelware)
app.use('/api/restore-test', atlasAuthMiddleware, restoreTestRoutes);
app.use('/api/sandboxes', atlasAuthMiddleware, sandboxRoutes);


// Global error handler (must be last)
app.use(errorHandler);

// 404 handler f- respons to routes that don't exist
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl,
        message: 'The requested API endpoint does not exist'
    });
});

async function startServer() {
    try {
        // Test Atlas connection on startup
        console.log(' Testing Atlas connection...');
        await atlasAuth.getAuthToken();
        console.log('Atlas connection successful');
        
        // CHANGE THIS SECTION - Make it non-fatal
        try {
            console.log(' Testing production cluster access...');
            const prodCluster = await atlasApi.getCluster(process.env.PRODUCTION_CLUSTER_NAME);
            console.log(`Production cluster accessible: ${prodCluster.name} (${prodCluster.stateName})`);
            
            console.log(' Testing snapshot availability...');
            const validation = await snapshotManager.validateSnapshotAvailability();
            console.log(`${validation.totalSnapshots} snapshots available`);
        } catch (validationError) {
            // Don't kill server if validation fails
            console.warn('Startup validation failed (non-fatal):');
            console.warn(`   ${validationError.message}`);
            console.warn('   Server will start anyway...\n');
        }
        
        // Start server listening on the specified port
        app.listen(PORT, () => {
            console.log(`\n Atlas Sandbox Server running on port ${PORT}`);
            console.log(` Environment: ${process.env.NODE_ENV}`);
            console.log(` Health check: http://localhost:${PORT}/api/health`);
            console.log(` Production cluster: ${process.env.PRODUCTION_CLUSTER_NAME}`);
            console.log(`Ready to deploy sandbox environments!\n`);
        });
        
    } catch (error) {
        // Only fatal errors reach here (auth failure, etc.)
        console.error(' Server startup failed:', error.message);
        console.error('  Please check your Atlas credentials and network connectivity');
        process.exit(1);
    }
}

//with these callbacks with cloud signals, our app will exit cleanly
// Graceful shutdown handling
//process.on(event, callback) tells Node.js to run the given callback whenever a specific event has occured
process.on('SIGTERM', () => { //SIGTERM is a termination signal often sent by cloud platforms to request shutdown
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);//this callback logs that the signal was received
});

process.on('SIGINT', () => { //SIGINT is usually sent when pressed CTRL+C to terminate the process
    console.log(' SIGINT received, shutting down gracefully');
    process.exit(0);
});

//errorhandling for uncaught errors
//event fires when there's an uncaught error that nobody could catch with a try catch block in your code
process.on('uncaughtException', (error) => {
    console.error(' Uncaught Exception:', error);
    process.exit(1);
});
//when a Promise is rejected but wasn't caught in a .catch
process.on('unhandledRejection', (reason, promise) => {
    console.error(' Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});


// Start the server
startServer();