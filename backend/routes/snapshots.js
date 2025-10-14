// Snapshot management routes using JustAir-Dedicated-Cluster
import express from 'express';
import dotenv from 'dotenv';
import atlasApi from '../services/atlasApi.js';
//import snapshotManager service which contains the snapshot-specifc business logic
import snapshotManager from '../services/snapshotManager.js';

// Load environment variables
dotenv.config();

//creat an express router instance to modularize this set of routes
const router = express.Router();

// Get all available snapshots from production cluster, route handler
router.get('/available', async (req, res, next) => {
    try {
        console.log(`📸 Getting available snapshots from ${process.env.PRODUCTION_CLUSTER_NAME}...`);

        //await the async call to get all available snapshots via snapshotManager
        //calls the service method getAvailableSnapshots
        //inside that service method, it calls atlasApi.getClusterSnapshots()
        //and then stores the results: const snapshots =...
        const snapshots = await snapshotManager.getAvailableSnapshots();
        //Respond with JSON containing metadata and a mapped list of snapshots
        res.json({ //converts javascript object to json string
            status: 'success',
            sourceCluster: process.env.PRODUCTION_CLUSTER_NAME,

            //map over each snapshot to select and reformat relevant fields for API response
            totalSnapshots: snapshots.totalSnapshots, //came from snapshotsManager.js  
            snapshots: snapshots.snapshots.map(snapshot => ({
                id: snapshot.id,
                createdAt: snapshot.createdAt,
                description: snapshot.description,

                //convert storage size from bytes to gigabytes with two decimals
                sizeGB: (snapshot.storageSizeBytes / 1024 / 1024 / 1024).toFixed(2),
                type: snapshot.type,
                status: snapshot.status
            })),

            //include info about latest snapshot if one even exits, or null otherwise
            latestSnapshot: snapshots.latestSnapshot ? { //conditional expression
                id: snapshots.latestSnapshot.id,
                createdAt: snapshots.latestSnapshot.createdAt,
                sizeGB: (snapshots.latestSnapshot.storageSizeBytes / 1024 / 1024 / 1024).toFixed(2)
            } : null,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        next(error);
    }
});

// Get latest snapshot info
router.get('/latest', async (req, res, next) => {
    try {
        console.log(' Getting latest snapshot information...');
        
        //await fetching the latest snapshot info
        const snapshotInfo = await snapshotManager.getLatestSnapshotInfo();
        
        //respond with status and the snapshot info directly
        res.json({
            status: 'success',
            snapshot: snapshotInfo, //the latest snapshot details returned from service
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        next(error);
    }
});

// Validate snapshot availability for deployment
router.get('/validate', async (req, res, next) => {
    try {
        console.log('🔍 Validating snapshot availability...');
        
        //call service method that checks if snapshot is suitable
        const validation = await snapshotManager.validateSnapshotAvailability();
        
        res.json({
            status: 'success',
            validation: {
                isValid: validation.isValid,
                totalSnapshots: validation.totalSnapshots,
                latestSnapshot: validation.latestSnapshot,
                //data about the latest snapshot
                snapshotAge: validation.snapshotAge,
                //age in milliseconds //convert age into hours (rounded) for easier reading
                snapshotAgeHours: Math.round(validation.snapshotAge / (60 * 60 * 1000)), //converst milliseconds to hours
                recommendations: validation.snapshotAge > (24 * 60 * 60 * 1000) ? 
                    ['Latest snapshot is over 24 hours old'] : 
                    ['Snapshot is recent and ready for deployment']
            },
            sourceCluster: process.env.PRODUCTION_CLUSTER_NAME,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        next(error);
    }
});

// Get snapshots for specific cluster (using exact Postman endpoint)
router.get('/cluster/:clusterName', async (req, res, next) => {
    try {
        //extract clusterName param from the URL, req.params is a object containign all URL parameters
        const { clusterName } = req.params;// req.params = { clusterName: "JustAir-dedicated-cluster"}
        console.log(`📸 Getting snapshots for cluster: ${clusterName}`);
        
        //call atlasApi to get snapshots direclty from the requested cluster
        const snapshots = await atlasApi.getClusterSnapshots(clusterName); //calls atlasApi directly instead of through snapshotManager
        
        res.json({
            status: 'success',
            clusterName: clusterName,
            //fallback to empty array if no results
            snapshots: snapshots.results || [],
            //fallback to 0 if undefined
            totalCount: snapshots.totalCount || 0,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        next(error);
    }
});

export default router