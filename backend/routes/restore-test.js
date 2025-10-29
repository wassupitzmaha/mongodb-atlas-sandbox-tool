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