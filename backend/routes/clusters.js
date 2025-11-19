// Cluster Management Routes
import express from 'express';
import atlasApi from '../services/atlasApi.js';

const router = express.Router();

// List all clusters - Fix the route path!
router.get('/', async (req, res, next) => { //defines a route handler for the root path '/'
    try {
        console.log(' Listing all clusters...');
        
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
        console.log(` Deleting cluster: ${clusterName}`);
        
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

 
        console.log(`🔍 Validating cluster name: ${clusterName}`);

        // Protection 1: Block dangerous patterns
        const dangerousPatterns = [
            { pattern: /^SANDBOX-PROD/i, name: 'SANDBOX-PROD*', reason: 'Production environment' },
            { pattern: /^SANDBOX-PRODUCTION/i, name: 'SANDBOX-PRODUCTION*', reason: 'Production environment' },
            { pattern: /^SANDBOX-MAIN/i, name: 'SANDBOX-MAIN*', reason: 'Main environment' },
            { pattern: /^SANDBOX-LIVE/i, name: 'SANDBOX-LIVE*', reason: 'Live environment' }
        ];

        for (const { pattern, name, reason } of dangerousPatterns) {
            if (pattern.test(clusterName)) {
                console.error(` Dangerous pattern detected: ${name}`);
                return res.status(400).json({
                    error: 'Invalid Cluster Name',
                    message: `Cluster name cannot start with ${name}`,
                    attemptedName: clusterName,
                    reason: reason,
                    suggestion: 'Use a descriptive name like: feature-xyz, bugfix-123, test-abc',
                    examples: [
                        'feature-user-auth',
                        'bugfix-payment-flow',
                        'test-new-api'
                    ],
                    timestamp: new Date().toISOString()
                });
            }
        }

        // Protection 2: Block production cluster name
        if (clusterName === process.env.PRODUCTION_CLUSTER_NAME) {
            console.error(` Attempted restore to production cluster`);
            return res.status(403).json({
                error: 'Production Cluster Protected',
                message: 'Cannot restore to production cluster',
                attemptedName: clusterName,
                reason: 'Production data must not be modified',
                suggestion: 'Create a new sandbox with a different name',
                timestamp: new Date().toISOString()
            });
        }

        // Protection 3: Validate name format (alphanumeric, hyphens only)
        const validNamePattern = /^[a-zA-Z0-9-]+$/;
        if (!validNamePattern.test(clusterName)) {
            console.error(` Invalid characters in cluster name`);
            return res.status(400).json({
                error: 'Invalid Cluster Name',
                message: 'Cluster name can only contain letters, numbers, and hyphens',
                attemptedName: clusterName,
                validPattern: 'a-z, A-Z, 0-9, and hyphens (-)',
                examples: [
                    'feature-auth',
                    'test-123',
                    'bugfix-payment'
                ],
                timestamp: new Date().toISOString()
            });
        }

        // Protection 4: Check name length (MongoDB Atlas limits)
        if (clusterName.length < 1 || clusterName.length > 64) {
            console.error(` Cluster name length invalid`);
            return res.status(400).json({
                error: 'Invalid Cluster Name',
                message: 'Cluster name must be between 1 and 64 characters',
                attemptedName: clusterName,
                length: clusterName.length,
                requirement: '1-64 characters',
                timestamp: new Date().toISOString()
            });
        }

        console.log(` Cluster name validation passed`);

        console.log(`🔍 Checking if cluster exists...`);
        const exists = await atlasApi.clusterExists(clusterName);

        if (!exists) {
            try {
                console.log(` Cluster doesn't exist, creating it...`);
                console.log(`   Using M30 configuration (same as production)`);
                console.log(`   This will take 10-15 minutes...`);

                await atlasApi.createCluster(clusterName);
                
                // Wait for cluster to be IDLE (15 min timeout)
                console.log(` Waiting for cluster to be ready...`);
                await atlasApi.waitForClusterIdle(clusterName, 15);
                console.log(` Cluster created and ready!`);
                
            } catch (createError) {
                // Handle MongoDB duplicate cluster name error
                if (createError.response?.status === 409) {
                    console.error(` Cluster name already exists`);
                    return res.status(409).json({
                        error: 'Cluster Already Exists',
                        message: 'A cluster with this name already exists',
                        clusterName: clusterName,
                        reason: 'MongoDB Atlas requires unique cluster names',
                        suggestion: 'Try a different name or add a suffix',
                        examples: [
                            `${clusterName}-v2`,
                            `${clusterName}-${new Date().getMonth() + 1}-${new Date().getDate()}`,
                            `${clusterName}-test`
                        ],
                        timestamp: new Date().toISOString()
                    });
                }
                
                // Handle other cluster creation errors
                if (createError.response?.status === 400) {
                    const errorDetail = createError.response.data?.detail || 
                                       createError.response.data?.error || 
                                       'Invalid cluster configuration';
                    
                    return res.status(400).json({
                        error: 'Cluster Creation Failed',
                        message: errorDetail,
                        clusterName: clusterName,
                        suggestion: 'Check the cluster name and try again',
                        timestamp: new Date().toISOString()
                    });
                }
                
                // Handle any other errors
                console.error(` Cluster creation failed:`, createError.message);
                return res.status(500).json({
                    error: 'Cluster Creation Failed',
                    message: 'Failed to create cluster',
                    clusterName: clusterName,
                    detail: createError.message,
                    suggestion: 'Please try again or contact support',
                    timestamp: new Date().toISOString()
                });
            }
        } else {
            console.log(` Cluster exists, checking state...`);
        }

        // Get cluster state
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

        // Wait for IDLE if in transitional states
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

        // Get latest snapshot
        console.log(`📸 Fetching latest snapshot from production...`);
        const latestSnapshot = await atlasApi.getLatestSnapshot();
        
        console.log(`   Snapshot ID: ${latestSnapshot.id}`);
        console.log(`   Created: ${latestSnapshot.createdAt}`);
        console.log(`   Size: ${(latestSnapshot.storageSizeBytes / 1024 / 1024 / 1024).toFixed(2)} GB`);

        // Create restore job
        console.log(` Creating restore job...`);
        const restoreJob = await atlasApi.createRestoreJob(
            clusterName,
            latestSnapshot.id
        );

        console.log(` Restore job created successfully!`);
        console.log(`   Job ID: ${restoreJob.id}`);
        console.log(`   Restore will complete in 5-10 minutes`);

        // Return response
        res.status(202).json({
            status: 'success',
            message: 'Restore job created successfully',
            restoreJob: {
                id: restoreJob.id,
                targetCluster: clusterName,
                sourceCluster: process.env.PRODUCTION_CLUSTER_NAME,
                snapshotId: latestSnapshot.id,
                snapshotCreatedAt: latestSnapshot.createdAt,
                snapshotSizeGB: (latestSnapshot.storageSizeBytes / 1024 / 1024 / 1024).toFixed(2),
                deliveryType: restoreJob.deliveryType,
                createdAt: restoreJob.timestamp || new Date().toISOString(),
                estimatedTime: '5-10 minutes'
            },
            pollUrl: `/api/clusters/${clusterName}/restore/status`,
            instructions: [
                'Poll the status endpoint every 30 seconds',
                'Restore typically completes in 5-10 minutes',
                'Once complete, use the connection string to connect'
            ],
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error(` Restore process failed:`, error.message);
        next(error);
    }
});


/**
 * Get restore job status for a cluster
 * GET /api/clusters/:clusterName/restore/status
 */
router.get('/:clusterName/restore/status', async (req, res, next) => {
    try {
        let { clusterName } = req.params;
        
        // Auto-add SANDBOX- prefix if not present
        if (!clusterName.startsWith('SANDBOX-')) {
            clusterName = `SANDBOX-${clusterName}`;
        }

        console.log(` Checking restore status for: ${clusterName}`);

        // Get all restore jobs from production cluster (where snapshots live)
        const allJobs = await atlasApi.listRestoreJobs();
        
        // Find the most recent job for this target cluster
        const clusterJobs = allJobs.jobs.filter(job => 
            job.targetClusterName === clusterName
        );

        if (clusterJobs.length === 0) {
            return res.status(404).json({
                error: 'No Restore Job Found',
                message: `No restore job found for cluster: ${clusterName}`,
                clusterName: clusterName,
                suggestion: 'Create a restore job first: POST /api/clusters/:clusterName/restore',
                timestamp: new Date().toISOString()
            });
        }

        // Get the most recent job (jobs are sorted by timestamp)
        const latestJob = clusterJobs.sort((a, b) => 
            new Date(b.timestamp || b.createdAt) - new Date(a.timestamp || a.createdAt)
        )[0];

        // Determine job status
        const isComplete = !!latestJob.finishedAt;
        const isCancelled = latestJob.cancelled;
        const isActive = !isComplete && !isCancelled;

        // Get detailed status if job ID is available
        let detailedStatus = null;
        if (latestJob.id) {
            try {
                detailedStatus = await atlasApi.getRestoreJobStatus(latestJob.id);
            } catch (error) {
                console.warn(`⚠️  Could not get detailed status for job ${latestJob.id}`);
            }
        }

        // Calculate duration if completed
        let duration = null;
        if (isComplete && latestJob.timestamp && latestJob.finishedAt) {
            const startTime = new Date(latestJob.timestamp || latestJob.createdAt).getTime();
            const endTime = new Date(latestJob.finishedAt).getTime();
            const durationMs = endTime - startTime;
            const minutes = Math.floor(durationMs / 60000);
            const seconds = Math.floor((durationMs % 60000) / 1000);
            duration = `${minutes}m ${seconds}s`;
        }

        // Prepare response
        const response = {
            status: 'success',
            clusterName: clusterName,
            restoreJob: {
                id: latestJob.id,
                targetCluster: latestJob.targetClusterName,
                sourceCluster: process.env.PRODUCTION_CLUSTER_NAME,
                snapshotId: latestJob.snapshotId,
                deliveryType: latestJob.deliveryType,
                createdAt: latestJob.timestamp || latestJob.createdAt,
                finishedAt: latestJob.finishedAt || null,
                cancelled: isCancelled,
                duration: duration
            },
            state: {
                isComplete: isComplete,
                isActive: isActive,
                isCancelled: isCancelled
            },
            timestamp: new Date().toISOString()
        };

        // Adds appropriate message and next steps
        if (isComplete) {
            response.message = ' Restore completed successfully!';
            response.nextSteps = [
                'Your cluster is ready to use',
                `Get connection string: GET /api/clusters/${clusterName}`,
                'Connect to your database and start testing'
            ];
            
            // Try to get connection string
            try {
                const cluster = await atlasApi.getCluster(clusterName);
                response.connectionString = cluster.connectionStrings?.standardSrv || null;
            } catch (error) {
                console.warn(`⚠️  Could not fetch connection string`);
            }
        } else if (isCancelled) {
            response.message = ' Restore job was cancelled';
            response.nextSteps = [
                'Create a new restore job if needed',
                `POST /api/clusters/${clusterName}/restore`
            ];
        } else {
            response.message = '⏳ Restore in progress...';
            response.nextSteps = [
                'Poll this endpoint again in 30 seconds',
                'Typical restore time: 5-10 minutes'
            ];
        }

        res.json(response);

    } catch (error) {
        console.error(` Failed to check restore status:`, error.message);
        next(error);
    }
});


export default router;