
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


router.get('/status/:restoreJobId', async (req, res, next) => {
    try {
        const { restoreJobId } = req.params;
        
        console.log(`🔍 Checking restore job status: ${restoreJobId}`);
        
        const status = await atlasApi.getRestoreJobStatus(restoreJobId);
        
        res.json({
            status: 'success',
            restoreJob: status,
            isComplete: status.isComplete,
            isActive: status.isActive,
            message: status.isComplete ? 
                '✅ Restore completed! Your cluster is ready to use.' : 
                '⏳ Restore still in progress... poll this endpoint again in 30s',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        next(error);
    }
});


router.post('/restore-and-wait', async (req, res, next) => {
    try {
        const { targetClusterName, snapshotId, maxWaitMinutes } = req.body;
        
        if (!targetClusterName) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'targetClusterName is required',
                note: 'This endpoint will wait 5-10 minutes for restore to complete'
            });
        }
        
        const maxWait = maxWaitMinutes || 15;
        
        console.log(`🔄 Starting full restore flow (with wait)...`);
        console.log(`   This will take approximately 5-10 minutes`);
        
        // Step 1: Get snapshot
        let snapshotToRestore = snapshotId;
        if (!snapshotToRestore) {
            const latestSnapshot = await atlasApi.getLatestSnapshot();
            snapshotToRestore = latestSnapshot.id;
            console.log(`   Using latest snapshot: ${snapshotToRestore}`);
        }
        
        // Step 2: Verify cluster is ready
        const targetCluster = await atlasApi.getCluster(targetClusterName);
        if (targetCluster.stateName !== 'IDLE') {
            return res.status(400).json({
                error: 'Cluster Not Ready',
                message: `Cluster state: ${targetCluster.stateName}`,
                detail: 'Wait for cluster to be IDLE before restoring'
            });
        }
        
        // Step 3: Create restore job
        console.log(`📦 Creating restore job...`);
        const restoreJob = await atlasApi.createRestoreJob(
            targetClusterName,
            snapshotToRestore
        );
        
        console.log(`⏳ Waiting for restore to complete (max ${maxWait} minutes)...`);
        
        // Step 4: Wait for completion
        const completedJob = await atlasApi.waitForRestoreCompletion(
            restoreJob.id,
            maxWait
        );
        
        // Step 5: Get final cluster details
        const finalCluster = await atlasApi.getCluster(targetClusterName);
        
        res.json({
            status: 'success',
            message: '✅ Restore completed successfully!',
            restoreJob: {
                id: completedJob.id,
                finishedAt: completedJob.finishedAt,
                targetClusterName: completedJob.targetClusterName,
                snapshotId: completedJob.snapshotId
            },
            cluster: {
                name: finalCluster.name,
                state: finalCluster.stateName,
                connectionString: finalCluster.connectionStrings?.standardSrv,
                mongoDBVersion: finalCluster.mongoDBVersion
            },
            nextSteps: [
                'Use the connectionString to connect to your restored cluster',
                'Verify your data is present',
                'Start testing your features!'
            ],
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        next(error);
    }
});


router.get('/jobs', async (req, res, next) => {
    try {
        console.log(`📋 Listing all restore jobs...`);
        
        const jobs = await atlasApi.listRestoreJobs();
        
        res.json({
            status: 'success',
            sourceCluster: process.env.PRODUCTION_CLUSTER_NAME,
            totalJobs: jobs.totalCount,
            jobs: jobs.jobs.map(job => ({
                id: job.id,
                targetClusterName: job.targetClusterName,
                snapshotId: job.snapshotId,
                deliveryType: job.deliveryType,
                createdAt: job.timestamp || job.createdAt,
                finishedAt: job.finishedAt,
                cancelled: job.cancelled,
                isComplete: !!job.finishedAt
            })),
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        next(error);
    }
});

export default router;