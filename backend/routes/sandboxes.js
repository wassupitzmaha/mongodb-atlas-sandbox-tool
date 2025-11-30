import express from 'express';
import atlasApi from '../services/atlasApi.js'
const route = express.Router()

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

        //sync mode: waiting for full completion
        const startTime = Date.now()

        //step1: create cluster
        console.log('  STEP 1/4: Creating cluster...');
        console.log(`   Configuration: M30 (same as production)`);
        console.log(`   Region: US_EAST_1`);
        console.log(`   MongoDB Version: 8.0\n`);
        
        await atlasApi.createCluster(sandboxName);









