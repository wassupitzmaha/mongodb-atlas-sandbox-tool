import express from 'express';
import atlasApi from '../services/atlasApi.js';

const router = express.Router();

/**
 * Deploy a complete sandbox environment with production data
 * POST /api/sandboxes/deploy
 * 
 * Body: {
 *   "purpose": "feature-auth-test",  // Required: for what we are testing
 *   "wait": true                     // Optional: wait for completion (default: true)
 * }
 */
router.post('/deploy', async (req, res, next) => {
    try {
        const { purpose, wait = true } = req.body;
        
        // Validation
        if (!purpose) {
            return res.status(400).json({
                error: 'Purpose Required',
                message: 'Please specify what you\'re testing',
                example: {
                    purpose: 'feature-auth-test'
                }
            });
        }
        
        // Validate purpose format (alphanumeric and hyphens only)
        const validPurposePattern = /^[a-zA-Z0-9-]+$/;
        if (!validPurposePattern.test(purpose)) {
            return res.status(400).json({
                error: 'Invalid Purpose Format',
                message: 'Purpose can only contain letters, numbers, and hyphens',
                example: 'feature-auth-test',
                yourInput: purpose
            });
        }
        
        // Generate sandbox name
        const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const sandboxName = `SANDBOX-${purpose}-${timestamp}`;
        
        // Check if sandbox already exists
        const exists = await atlasApi.clusterExists(sandboxName);
        if (exists) {
            return res.status(409).json({
                error: 'Sandbox Already Exists',
                message: `A sandbox with this purpose already exists today`,
                existingSandbox: sandboxName,
                suggestion: 'Use a different purpose or delete the existing sandbox',
                deleteUrl: `/api/sandboxes/${sandboxName}`
            });
        }
        
        console.log(`\n${'='.repeat(60)}`);
        console.log(` SANDBOX DEPLOYMENT STARTED`);
        console.log(`${'='.repeat(60)}`);
        console.log(` Sandbox Name: ${sandboxName}`);
        console.log(` Purpose: ${purpose}`);
        console.log(`  Started: ${new Date().toISOString()}`);
        console.log(` Estimated Time: 15-20 minutes`);
        console.log(`${'='.repeat(60)}\n`);
        
        if (!wait) {
            // ASYNC MODE: Return immediately, process in background
            //job queue
            return res.status(202).json({
                status: 'accepted',
                message: 'Sandbox deployment started in background',
                sandbox: {
                    name: sandboxName,
                    purpose: purpose
                },
                note: 'This is async mode - not fully implemented yet. Use wait:true for now.'
            });
        }
        
        // SYNC MODE: Wait for full completion
        const startTime = Date.now();
        
// create cluster 
        console.log(' STEP 1/4: Creating cluster...');
        console.log(`   Configuration: M30 (same as production)`);
        console.log(`   Region: US_EAST_1`);
        console.log(`   MongoDB Version: 8.0\n`);
        
        await atlasApi.createCluster(sandboxName);
        
 // waiting for cluster to be idle
        console.log(' STEP 2/4: Waiting for cluster to be ready...');
        console.log(`   This typically takes 10-15 minutes`);
        console.log(`   Checking status every 30 seconds...\n`);
        
        await atlasApi.waitForClusterIdle(sandboxName, 15);
        
        const clusterReadyTime = Math.round((Date.now() - startTime) / 1000 / 60);
        console.log(`    Cluster ready! (${clusterReadyTime} minutes)\n`);
        
// get latest snapshot
        console.log(' STEP 3/4: Getting latest production snapshot...');
        console.log(`   Source: ${process.env.PRODUCTION_CLUSTER_NAME}`);
        
        const snapshot = await atlasApi.getLatestSnapshot();
        
        console.log(`    Snapshot found!`);
        console.log(`      Snapshot ID: ${snapshot.id}`);
        console.log(`      Created: ${snapshot.createdAt}`);
        console.log(`      Size: ${(snapshot.storageSizeBytes / 1024 / 1024 / 1024).toFixed(2)} GB\n`);
        
     //restore cluster with auto polling
        console.log(' STEP 4/4: Restoring production data...');
        console.log(`   Creating restore job...`);
        
        const restoreJob = await atlasApi.createRestoreJob(sandboxName, snapshot.id);
        
        console.log(`    Restore job created: ${restoreJob.id}`);
        console.log(`    Waiting for restore to complete (5-10 minutes)...`);
        console.log(`   Polling status every 30 seconds...\n`);
        
        //  USE OUR EXISTING AUTO-POLLING METHOD
        await atlasApi.waitForRestoreCompletion(restoreJob.id, 15);
        
        const restoreCompleteTime = Math.round((Date.now() - startTime) / 1000 / 60);
        console.log(`    Restore completed! (Total: ${restoreCompleteTime} minutes)\n`);
        
//get connection string
        console.log('Getting connection details...');
        const cluster = await atlasApi.getCluster(sandboxName);
        
        const totalTime = Math.round((Date.now() - startTime) / 1000 / 60);
        
        console.log(`\n${'='.repeat(60)}`);
        console.log(` SANDBOX DEPLOYMENT COMPLETE!`);
        console.log(`${'='.repeat(60)}`);
        console.log(` Sandbox: ${sandboxName}`);
        console.log(`  Total Time: ${totalTime} minutes`);
        console.log(` Connection String: ${cluster.connectionStrings.standardSrv.substring(0, 50)}...`);
        console.log(`${'='.repeat(60)}\n`);
        
        // Success response
        res.json({
            status: 'success',
            message: ' Sandbox fully deployed and ready to use!',
            sandbox: {
                name: sandboxName,
                purpose: purpose,
                connectionString: cluster.connectionStrings.standardSrv,
                mongoDBVersion: cluster.mongoDBVersion,
                state: cluster.stateName,
                region: 'US_EAST_1',
                createdAt: new Date().toISOString()
            },
            deployment: {
                totalDuration: `${totalTime} minutes`,
                clusterCreationTime: `${clusterReadyTime} minutes`,
                dataRestoreTime: `${restoreCompleteTime - clusterReadyTime} minutes`,
                snapshotUsed: {
                    id: snapshot.id,
                    createdAt: snapshot.createdAt,
                    sizeGB: (snapshot.storageSizeBytes / 1024 / 1024 / 1024).toFixed(2)
                }
            },
            usage: {
                connect: 'Use the connectionString above in your application',
                monitor: `GET /api/sandboxes/${sandboxName}`,
                delete: `DELETE /api/sandboxes/${sandboxName}`
            },
            nextSteps: [
                '1. Copy the connection string above',
                '2. Update your application configuration',
                '3. Start testing your features!',
                '4. Delete sandbox when done to save costs'
            ]
        });
        
    } catch (error) {
        console.error('\n SANDBOX DEPLOYMENT FAILED');
        console.error(`   Error: ${error.message}\n`);
        next(error);
    }
});

/**
 * List all sandboxes in the project
 * GET /api/sandboxes
 */
router.get('/', async (req, res, next) => {
    try {
        console.log(' Listing all sandboxes...');
        
        const allClusters = await atlasApi.listClusters();
        
        // Filter only SANDBOX-* clusters
        const sandboxes = allClusters.results
            .filter(cluster => cluster.name.startsWith('SANDBOX-'))
            .map(cluster => ({
                name: cluster.name,
                state: cluster.stateName,
                connectionString: cluster.connectionStrings?.standardSrv || null,
                mongoDBVersion: cluster.mongoDBVersion,
                createdDate: cluster.createDate,
                paused: cluster.paused,
                ready: cluster.stateName === 'IDLE' && !cluster.paused
            }))
            .sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate)); // Newest first
        
        console.log(`   Found ${sandboxes.length} sandboxes\n`);
        
        res.json({
            status: 'success',
            totalSandboxes: sandboxes.length,
            sandboxes: sandboxes,
            productionCluster: process.env.PRODUCTION_CLUSTER_NAME,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error(' Failed to list sandboxes:', error.message);
        next(error);
    }
});

/**
 * Get details for a specific sandbox
 * GET /api/sandboxes/:name
 */
router.get('/:name', async (req, res, next) => {
    try {
        let { name } = req.params;
        
        // Auto-add SANDBOX- prefix if missing
        if (!name.startsWith('SANDBOX-')) {
            name = `SANDBOX-${name}`;
        }
        
        console.log(` Getting sandbox details: ${name}`);
        
        const cluster = await atlasApi.getCluster(name);
        
        // Check if this is actually a sandbox
        if (!cluster.name.startsWith('SANDBOX-')) {
            return res.status(403).json({
                error: 'Not a Sandbox',
                message: 'This endpoint only works with sandbox clusters',
                clusterName: cluster.name,
                suggestion: 'Use /api/clusters/:name for non-sandbox clusters'
            });
        }
        
        console.log(`   State: ${cluster.stateName}\n`);
        
        res.json({
            status: 'success',
            sandbox: {
                name: cluster.name,
                state: cluster.stateName,
                connectionString: cluster.connectionStrings?.standardSrv || null,
                mongoDBVersion: cluster.mongoDBVersion,
                paused: cluster.paused,
                createdDate: cluster.createDate,
                ready: cluster.stateName === 'IDLE' && !cluster.paused,
                region: cluster.replicationSpecs?.[0]?.regionConfigs?.[0]?.regionName || 'Unknown'
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        if (error.response?.status === 404) {
            return res.status(404).json({
                error: 'Sandbox Not Found',
                message: `Sandbox '${req.params.name}' does not exist`,
                suggestion: 'Check available sandboxes: GET /api/sandboxes',
                timestamp: new Date().toISOString()
            });
        }
        next(error);
    }
});

/**
 * Delete a sandbox
 * DELETE /api/sandboxes/:name
 */
router.delete('/:name', async (req, res, next) => {
    try {
        let { name } = req.params;
        
        // Auto-add SANDBOX- prefix if missing
        if (!name.startsWith('SANDBOX-')) {
            name = `SANDBOX-${name}`;
        }
        
        // CRITICAL: Prevent deleting production cluster
        if (name === process.env.PRODUCTION_CLUSTER_NAME) {
            console.error(` BLOCKED: Attempted to delete production cluster`);
            return res.status(403).json({
                error: 'Production Cluster Protected',
                message: 'Cannot delete production cluster via this endpoint',
                clusterName: name,
                reason: 'Safety mechanism to prevent accidental deletion'
            });
        }
        
        // Verify it's actually a sandbox
        if (!name.startsWith('SANDBOX-')) {
            return res.status(403).json({
                error: 'Not a Sandbox',
                message: 'This endpoint only deletes sandbox clusters',
                clusterName: name,
                suggestion: 'Use /api/clusters/:name/delete for non-sandbox clusters'
            });
        }
        
        console.log(`  Deleting sandbox: ${name}`);
        
        // Verify sandbox exists first
        try {
            await atlasApi.getCluster(name);
        } catch (error) {
            if (error.response?.status === 404) {
                return res.status(404).json({
                    error: 'Sandbox Not Found',
                    message: `Sandbox '${name}' does not exist`,
                    note: 'It may have already been deleted'
                });
            }
            throw error;
        }
        
        // Delete the cluster
        await atlasApi.deleteCluster(name);
        
        console.log(`    Deletion initiated (takes ~2 minutes)\n`);
        
        res.json({
            status: 'success',
            message: `Sandbox deletion initiated`,
            sandbox: {
                name: name,
                deletionInitiated: new Date().toISOString()
            },
            note: 'Deletion typically completes within 2 minutes',
            verify: `GET /api/sandboxes/${name} will return 404 when complete`
        });
        
    } catch (error) {
        console.error(` Failed to delete sandbox:`, error.message);
        next(error);
    }
});

export default router;