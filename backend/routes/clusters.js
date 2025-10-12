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


export default router;