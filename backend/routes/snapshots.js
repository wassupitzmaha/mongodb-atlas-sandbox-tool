//Snapshot managemen// Snapshot management routes
import express from 'express';
import atlasApi from '../services/atlasApi.js';
import snapshotManager from '../services/snapshotManager.js';

const router = express.Router();

// Get latest snapshot info
router.get('/latest', async (req, res, next) => {
    try {
        console.log('📸 Getting latest snapshot information...');
        
        const latestSnapshot = await atlasApi.getLatestSnapshot();
        
        const snapshotInfo = {
            id: latestSnapshot.id,
            createdAt: latestSnapshot.createdAt,
            description: latestSnapshot.description || 'Automated snapshot',
            sizeGB: (latestSnapshot.storageSizeBytes / 1024 / 1024 / 1024).toFixed(2),
            type: latestSnapshot.type || 'scheduled',
            sourceCluster: process.env.PRODUCTION_CLUSTER_NAME,
            status: latestSnapshot.status || 'completed'
        };
        
        res.json({
            status: 'success',
            snapshot: snapshotInfo,
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
        
        const validation = await snapshotManager.validateSnapshotAvailability();
        
        res.json({
            status: 'success',
            validation: {
                isValid: validation.isValid,
                totalSnapshots: validation.totalSnapshots,
                latestSnapshot: validation.latestSnapshot,
                snapshotAge: validation.snapshotAge,
                snapshotAgeHours: Math.round(validation.snapshotAge / (60 * 60 * 1000))
            },
            sourceCluster: process.env.PRODUCTION_CLUSTER_NAME,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        next(error);
    }
});

export default router;