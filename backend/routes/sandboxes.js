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

        

