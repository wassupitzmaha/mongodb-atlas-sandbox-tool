import express from 'express';
import atlasApi from '../services/atlasApi.js';
import crypto from 'crypto';

const router = express.Router();

//in job memory store
const deploymentJobs = new Map();

// Helper: Generate unique job ID
function generateJobId() {
    return `deploy-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

// Helper: Update job status
function updateJobStatus(jobId, updates) {
    const job = deploymentJobs.get(jobId);
    if (job) {
        Object.assign(job, updates, { updatedAt: new Date().toISOString() });
        console.log(`📝 Job ${jobId}: ${updates.step} (${updates.progress}%)`);
    }
}

//background deployment function
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
        