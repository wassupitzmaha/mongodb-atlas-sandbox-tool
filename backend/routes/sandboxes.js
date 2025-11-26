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



