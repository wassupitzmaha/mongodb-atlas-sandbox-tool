// Cluster Management Routes
import express from 'express';
import atlasApi from '../services/atlasApi.js';

const router = express.Router();

// List all clusters - Fix the route path!
router.get('/', async (req, res, next) => { //defines a route handler for the root path '/'
    try {
        console.log('📋 Listing all clusters...');
        
        const clusters = await atlasApi.listClusters(); // calls the listCluster method from the imported atlasApi service and awaits for the operation to complete

        
        // Add helpful metadata
        const response = {
            clusters: clusters.results || [],
            totalCount: clusters.totalCount || 0,
            productionCluster: process.env.PRODUCTION_CLUSTER_NAME,
            timestamp: new Date().toISOString(),
            projectId: process.env.ATLAS_GROUP_ID
        };
        
        res.json(response); // sends the response back as a JSON object back to the client
        
    } catch (error) {
        next(error); //passes the error to the next error-handling middelware
    }
});



// Get specific cluster details
router.get('/:clusterName', async (req, res, next) => {
    try {
        const { clusterName } = req.params;
        console.log(`🔍 Getting cluster details: ${clusterName}`);
        
        const cluster = await atlasApi.getCluster(clusterName);
        
        // Add helpful metadata
        const response = {
            cluster: cluster,
            connectionString: cluster.connectionStrings?.standardSrv || null,
            isReady: cluster.stateName === 'IDLE', //checks if the cluster is ready to use
            isProduction: clusterName === process.env.PRODUCTION_CLUSTER_NAME,
            timestamp: new Date().toISOString()
        };
        
        res.json(response);
        
    } catch (error) {
        next(error);
    }
});

// Create new cluster
router.post('/', async (req, res, next) => {
    try {
        const { clusterName, config } = req.body;
        
        if (!clusterName) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'clusterName is required',
                timestamp: new Date().toISOString()
            });
        }
        
        console.log(`🔨 Creating cluster: ${clusterName}`);
        
        const cluster = await atlasApi.createCluster(clusterName, config);
        
        res.status(202).json({
            status: 'success',
            message: 'Cluster creation initiated',
            cluster: cluster,
            estimatedTime: '10-15 minutes',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        next(error);
    }
});

// Delete cluster
router.delete('/:clusterName', async (req, res, next) => {
    try {
        const { clusterName } = req.params;
        console.log(`🗑️ Deleting cluster: ${clusterName}`);
        
        const result = await atlasApi.deleteCluster(clusterName);
        
        res.json({
            status: 'success',
            message: `Cluster ${clusterName} deletion initiated`,
            result: result,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        next(error);
    }
});

router.post('/:clusterName/restore', async (req, res, next) => {
    try {
        let { clusterName } = req.params;
        
        // Auto-add SANDBOX- prefix if not present
        if (!clusterName.startsWith('SANDBOX-')) {
            const originalName = clusterName;
            clusterName = `SANDBOX-${clusterName}`;
            console.log(`  Auto-prefixed: "${originalName}" → "${clusterName}"`);
        }

        console.log(` Starting restore process for: ${clusterName}`);
        console.log(`   This will return immediately with a job ID`);

        console.log(` Checking if cluster exists...`);
        const exists = await atlasApi.clusterExists(clusterName);

        if (!exists) {
            // Auto-create cluster
            console.log(` Cluster doesn't exist, creating it...`);
            console.log(`   Using M30 configuration (same as production)`);
            console.log(`   This will take 10-15 minutes...`);

            await atlasApi.createCluster(clusterName);
            
            // Wait for cluster to be IDLE (15 min timeout)
            console.log(` Waiting for cluster to be ready...`);
            await atlasApi.waitForClusterIdle(clusterName, 15);
            console.log(` Cluster created and ready!`);
        } else {
            console.log(` Cluster exists, checking state...`);
        }
        const cluster = await atlasApi.getCluster(clusterName);
        const currentState = cluster.stateName;
        const isPaused = cluster.paused;

        console.log(`   Current state: ${currentState}${isPaused ? ' (PAUSED)' : ''}`);

        // Block DELETING state
        if (currentState === 'DELETING' || currentState === 'DELETED') {
            return res.status(400).json({
                error: 'Cluster Not Available',
                message: `Cannot restore to cluster in ${currentState} state`,
                clusterName: clusterName,
                currentState: currentState,
                suggestion: 'Wait for deletion to complete or use a different cluster name',
                timestamp: new Date().toISOString()
            });
        }
        if (currentState !== 'IDLE' || isPaused) {
            console.log(` Cluster not ready, waiting for IDLE state...`);
            
            const stateMessages = {
                'CREATING': 'Cluster is being created (10-15 minutes)',
                'REPAIRING': 'Cluster is being repaired',
                'UPDATING': 'Cluster is being updated',
                'PAUSED': 'Cluster is paused, will auto-resume'
            };
            
            console.log(`   ${stateMessages[currentState] || 'Waiting for cluster to be ready'}`);
            
            await atlasApi.waitForClusterIdle(clusterName, 15);
            console.log(` Cluster is now IDLE and ready!`);
        }
    }})



export default router;