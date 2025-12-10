import express from 'express';
import atlasApi from '../services/atlasApi.js';
import crypto from 'crypto';

const router = express.Router();


// IN-MEMORY JOB STORE

const deploymentJobs = new Map(); //lives in node.js process memory, 

//cons:
//when server restarts: all job history are list, each job has different job dtaat, but this is simple, no dependences needed and sfast

// Helper: Generate unique job ID
function generateJobId() {
    return `deploy-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

// Helper: Update job status
function updateJobStatus(jobId, updates) {
    //retrieve the exisitng job from the Map
    const job = deploymentJobs.get(jobId); 
    //see if job exists (safety check)
    if (job) {
        //step 3: merge new updates into exisiting job object
        Object.assign(job, updates, { updatedAt: new Date().toISOString() });
        //console log for monitoring
        console.log(` Job ${jobId}: ${updates.step} (${updates.progress}%)`);
    }
}


// BACKGROUND DEPLOYMENT FUNCTION

async function deployInBackground(jobId, sandboxName, purpose) {
    try {
        const startTime = Date.now();
        
        // STEP 1: Create Cluster (50% of total progress)
        updateJobStatus(jobId, {
            status: 'in_progress',
            step: 'creating_cluster',
            progress: 10,
            message: 'Creating new cluster...'
        });
        
        await atlasApi.createCluster(sandboxName);
        
        updateJobStatus(jobId, {
            step: 'waiting_for_cluster',
            progress: 20,
            message: 'Waiting for cluster to be ready (10-15 minutes)...'
        });
        
        // Poll cluster status and update progress
        let clusterReady = false;
        let attempts = 0;
        while (!clusterReady && attempts < 30) { // 30 attempts = 15 minutes max
            await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30s
            
            const cluster = await atlasApi.getCluster(sandboxName); //reusing our atlasAPI services
            attempts++;
            
            // Update progress gradually (20% -> 50%)
            const progressIncrement = Math.min(50, 20 + (attempts * 1));
            updateJobStatus(jobId, {
                step: 'waiting_for_cluster',
                progress: progressIncrement,
                message: `Cluster state: ${cluster.stateName} (${attempts * 0.5} min elapsed)`
            });
            
            if (cluster.stateName === 'IDLE' && !cluster.paused) {
                clusterReady = true;
            }
        }
        
        updateJobStatus(jobId, {
            step: 'cluster_ready',
            progress: 50,
            message: 'Cluster is ready!'
        });
        
        // STEP 2: Get Snapshot (10% of progress)
        updateJobStatus(jobId, {
            step: 'fetching_snapshot',
            progress: 55,
            message: 'Fetching production snapshot...'
        });
        
        const snapshot = await atlasApi.getLatestSnapshot();
        
        updateJobStatus(jobId, {
            step: 'snapshot_fetched',
            progress: 60,
            message: `Snapshot acquired: ${snapshot.id}`
        });
        
        // STEP 3: Restore Data (40% of progress)
        updateJobStatus(jobId, {
            step: 'creating_restore_job',
            progress: 65,
            message: 'Creating restore job...'
        });
        
        const restoreJob = await atlasApi.createRestoreJob(sandboxName, snapshot.id);
        
        updateJobStatus(jobId, {
            step: 'restoring_data',
            progress: 70,
            message: 'Restoring production data (5-10 minutes)...'
        });
        
        // Poll restore job and update progress
        let restoreComplete = false;
        attempts = 0;
        while (!restoreComplete && attempts < 20) { // 20 attempts = 10 minutes max
            await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30s
            
            const jobStatus = await atlasApi.getRestoreJobStatus(restoreJob.id);
            attempts++;
            
            // Update progress gradually (70% -> 90%)
            const progressIncrement = Math.min(90, 70 + (attempts * 1));
            updateJobStatus(jobId, {
                step: 'restoring_data',
                progress: progressIncrement,
                message: `Restoring data... (${attempts * 0.5} min elapsed)`
            });
            
            if (jobStatus.isComplete) {
                restoreComplete = true;
            }
        }
        
        // STEP 4: Get Final Details
        updateJobStatus(jobId, {
            step: 'finalizing',
            progress: 95,
            message: 'Getting connection details...'
        });
        
        const finalCluster = await atlasApi.getCluster(sandboxName);
        const totalDuration = Math.round((Date.now() - startTime) / 1000 / 60);
        
        // COMPLETE!
        updateJobStatus(jobId, {
            status: 'completed',
            step: 'ready',
            progress: 100,
            message: ' Sandbox deployed successfully!',
            result: {
                sandboxName: sandboxName,
                purpose: purpose,
                connectionString: finalCluster.connectionStrings.standardSrv,
                mongoDBVersion: finalCluster.mongoDBVersion,
                state: finalCluster.stateName,
                deploymentDuration: `${totalDuration} minutes`,
                snapshotUsed: {
                    id: snapshot.id,
                    createdAt: snapshot.createdAt,
                    sizeGB: (snapshot.storageSizeBytes / 1024 / 1024 / 1024).toFixed(2)
                },
                createdAt: new Date().toISOString(),
                estimatedMonthlyCost: '$389' // M30 cluster cost
            }
        });
        
        console.log(`\n Deployment ${jobId} completed in ${totalDuration} minutes\n`);
        
    } catch (error) {
        console.error(` Deployment ${jobId} failed:`, error.message);
        
        updateJobStatus(jobId, {
            status: 'failed',
            step: 'error',
            progress: 0,
            message: `Deployment failed: ${error.message}`,
            error: {
                message: error.message,
                code: error.response?.status || 'UNKNOWN',
                detail: error.response?.data?.detail || null
            }
        });
    }
}


// API ENDPOINTS


/**
 * Deploy sandbox (ASYNC - returns immediately)
 * POST /api/sandboxes/deploy-async
 */
router.post('/deploy-async', async (req, res, next) => {
    try {
        const { purpose } = req.body; //this is where the cluster name is stored in POSTMAN
        
        // Validation
        if (!purpose) {
            return res.status(400).json({
                error: 'Purpose Required',
                message: 'Please provide a purpose for this sandbox',
                example: { purpose: 'feature-auth-test' }
            });
        }
        
        const validPurposePattern = /^[a-zA-Z0-9-]+$/; //validates the purpose format
        if (!validPurposePattern.test(purpose)) {
            return res.status(400).json({ //400 error for a bad name
                error: 'Invalid Purpose Format',
                message: 'Purpose can only contain letters, numbers, and hyphens',
                example: { purpose: 'feature-auth-test' }
            });
        }
        
        // Generate names
        const jobId = generateJobId(); //generate a jobid
        const timestamp = new Date().toISOString().split('T')[0];
        const sandboxName = `SANDBOX-${purpose}-${timestamp}`; //this adds the SANDBOX prefix to all names
        
        // Check if already exists
        const exists = await atlasApi.clusterExists(sandboxName);
        if (exists) {
            return res.status(409).json({
                error: 'Sandbox Already Exists',
                message: 'A sandbox with this purpose already exists today',
                existingSandbox: sandboxName,
                suggestion: 'Use a different purpose name or delete the existing sandbox'
            });
        }
        
        // Create job in memory and store the job
        deploymentJobs.set(jobId, {
            jobId: jobId,
            sandboxName: sandboxName,
            purpose: purpose,
            status: 'pending',
            step: 'initializing',
            progress: 0,
            message: 'Deployment queued...',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        
        // Start deployment in background (non-blocking!)
        deployInBackground(jobId, sandboxName, purpose);
        
        // Return immediately
        res.status(202).json({
            status: 'success',
            message: 'Sandbox deployment started',
            job: {
                jobId: jobId,
                sandboxName: sandboxName,
                purpose: purpose,
                status: 'pending',
                progress: 0
            },
            polling: {
                statusUrl: `/api/sandboxes/jobs/${jobId}`,
                recommendedInterval: '5 seconds',
                estimatedDuration: '15-20 minutes'
            },
            timestamp: new Date().toISOString()
        });
        
        console.log(`\n Started deployment job ${jobId} for ${sandboxName}\n`);
        
    } catch (error) {
        console.error(' Failed to start deployment:', error.message);
        next(error);
    }
});

/**
 * Get job status (FOR POLLING)
 * GET /api/sandboxes/jobs/:jobId
 */
router.get('/jobs/:jobId', (req, res) => {
    const { jobId } = req.params;
    
    const job = deploymentJobs.get(jobId);//direct look up key, 0(1) instant
    
    if (!job) {
        return res.status(404).json({
            error: 'Job Not Found',
            message: `No deployment job found with ID: ${jobId}`,
            jobId: jobId
        });
    }
    
    // Return job status
    res.json({
        status: 'success',
        job: job,
        timestamp: new Date().toISOString()
    });
});

/**
 * List all jobs (OPTIONAL - for debugging)
 * GET /api/sandboxes/jobs
 */
router.get('/jobs', (req, res) => {
    const allJobs = Array.from(deploymentJobs.values())
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({
        status: 'success',
        totalJobs: allJobs.length,
        jobs: allJobs
    });
});

/**
 * List all sandboxes
 * GET /api/sandboxes
 */
router.get('/', async (req, res, next) => {
    try {
        const allClusters = await atlasApi.listClusters();
        
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
            .sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate));
        
        res.json({
            status: 'success',
            totalSandboxes: sandboxes.length,
            sandboxes: sandboxes,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * Get specific sandbox
 * GET /api/sandboxes/:name
 */
router.get('/:name', async (req, res, next) => {
    try {
        let { name } = req.params;
        
        if (!name.startsWith('SANDBOX-')) {
            name = `SANDBOX-${name}`;
        }
        
        const cluster = await atlasApi.getCluster(name);
        
        res.json({
            status: 'success',
            sandbox: {
                name: cluster.name,
                state: cluster.stateName,
                connectionString: cluster.connectionStrings?.standardSrv || null,
                mongoDBVersion: cluster.mongoDBVersion,
                createdDate: cluster.createDate,
                paused: cluster.paused,
                ready: cluster.stateName === 'IDLE' && !cluster.paused
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        if (error.response?.status === 404) {
            return res.status(404).json({
                error: 'Sandbox Not Found',
                name: req.params.name
            });
        }
        next(error);
    }
});

// In routes/sandboxes.js
router.delete('/:name', async (req, res, next) => {
    try {
        let { name } = req.params;
        
        if (!name.startsWith('SANDBOX-')) {
            name = `SANDBOX-${name}`;
        }
        
        // Check existence first
        const exists = await atlasApi.clusterExists(name);
        if (!exists) {
            return res.status(404).json({
                error: 'Sandbox Not Found',
                message: `Sandbox "${name}" does not exist or has already been deleted`,
                name: name,
                timestamp: new Date().toISOString()
            });
        }
        
        // Protection: Can't delete production
        if (name === process.env.PRODUCTION_CLUSTER_NAME) {
            return res.status(403).json({
                error: 'Production Cluster Protected',
                message: 'Cannot delete production cluster'
            });
        }
        
        await atlasApi.deleteCluster(name);
        
        res.json({
            status: 'success',
            message: `Sandbox deletion initiated`,
            sandbox: { name },
            note: 'Deletion takes 2-5 minutes to complete',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        next(error);
    }
});

export default router;