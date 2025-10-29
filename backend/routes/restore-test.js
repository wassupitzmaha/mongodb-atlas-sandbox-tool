import express from 'express';
import atlasApi from '../services/atlasApi.js';

const router = express.Router();

router.get('/latest-snapshot', async (req, res, next) => {
    try {
        console.log('🔍 Fetching latest snapshot from production...');
        
        const snapshot = await atlasApi.getLatestSnapshot();
        
        res.json({
            status: 'success',
            message: 'Use this snapshot ID for restore testing',
            snapshot: {
                id: snapshot.id,
                createdAt: snapshot.createdAt,
                sizeGB: (snapshot.storageSizeBytes / 1024 / 1024 / 1024).toFixed(2),
                type: snapshot.type,
                status: snapshot.status
            },
            sourceCluster: process.env.PRODUCTION_CLUSTER_NAME,
            note: 'Copy the snapshot.id - you\'ll need it for restore',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
});

router.post('/restore', async (req, res, next) => {
    try {
        const { targetClusterName, snapshotId } = req.body;
        
        // Validation
        if (!targetClusterName) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'targetClusterName is required',
                example: {
                    targetClusterName: 'RESTORE-TEST-001',
                    snapshotId: 'optional - uses latest if not provided'
                }
            });
        }
        
        console.log(`🔄 Starting restore process...`);
        console.log(`   Target Cluster: ${targetClusterName}`);
        
        // Step 1: Get snapshot ID (use latest if not provided)
        let snapshotToRestore = snapshotId;
        if (!snapshotToRestore) {
            console.log('📸 No snapshot ID provided, fetching latest...');
            const latestSnapshot = await atlasApi.getLatestSnapshot();
            snapshotToRestore = latestSnapshot.id;
            console.log(`   Using latest snapshot: ${snapshotToRestore}`);
        }
        
        // Step 2: Verify target cluster exists and is IDLE
        console.log('🔍 Checking target cluster status...');
        try {
            const targetCluster = await atlasApi.getCluster(targetClusterName);
            
            if (targetCluster.stateName !== 'IDLE') {
                return res.status(400).json({
                    error: 'Cluster Not Ready',
                    message: `Target cluster is in state: ${targetCluster.stateName}`,
                    detail: 'Cluster must be in IDLE state before restoring',
                    currentState: targetCluster.stateName,
                    suggestion: targetCluster.stateName === 'CREATING' ? 
                        'Wait for cluster creation to complete (10-15 minutes)' :
                        'Check cluster status and try again when IDLE'
                });
            }
            
            console.log(`✅ Target cluster is IDLE and ready for restore`);
            
        } catch (error) {
            if (error.response?.status === 404) {
                return res.status(404).json({
                    error: 'Target Cluster Not Found',
                    message: `Cluster ${targetClusterName} does not exist`,
                    suggestion: 'Create the cluster first: POST /api/clusters',
                    example: {
                        clusterName: targetClusterName
                    }
                });
            }
            throw error;
        }
        
        // Step 3: Create restore job
        console.log('📦 Creating restore job...');
        const restoreJob = await atlasApi.createRestoreJob(
            targetClusterName,
            snapshotToRestore
        );
        
        res.status(202).json({
            status: 'success',
            message: 'Restore job created successfully',
            restoreJob: {
                id: restoreJob.id,
                deliveryType: restoreJob.deliveryType,
                targetClusterName: restoreJob.targetClusterName,
                snapshotId: restoreJob.snapshotId,
                createdAt: restoreJob.timestamp || new Date().toISOString()
            },
            sourceCluster: process.env.PRODUCTION_CLUSTER_NAME,
            nextSteps: [
                `Poll status: GET /api/restore-test/status/${restoreJob.id}`,
                `Estimated time: 5-10 minutes`,
                `Check every 30 seconds until complete`
            ],
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        next(error);
    }
});