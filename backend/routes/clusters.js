// Cluster Management Routes
import express from 'express';
import atlasApi from '../services/atlasApi.js';

const router = express.Router();

// List all clusters - Fix the route path!
router.get('/', async (req, res, next) => {
    try {
        console.log('📋 Listing all clusters...');
        
        const clusters = await atlasApi.listClusters();
        
        // Add helpful metadata
        const response = {
            clusters: clusters.results || [],
            totalCount: clusters.totalCount || 0,
            productionCluster: process.env.PRODUCTION_CLUSTER_NAME,
            timestamp: new Date().toISOString(),
            projectId: process.env.ATLAS_GROUP_ID
        };
        
        res.json(response);
        
    } catch (error) {
        next(error);
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
            isReady: cluster.stateName === 'IDLE',
            isProduction: clusterName === process.env.PRODUCTION_CLUSTER_NAME,
            timestamp: new Date().toISOString()
        };
        
        res.json(response);
        
    } catch (error) {
        next(error);
    }
});

export default router;