// Simplified test script to verify integration
import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

// Then import services
import atlasAuth from './services/atlasAuth.js';
import atlasApi from './services/atlasApi.js';
import snapshotManager from './services/snapshotManager.js';

async function testIntegration() {
    try {
        console.log('🧪 Testing Atlas Integration...\n');

        // Test 1: Authentication
        console.log('1️ Testing OAuth Authentication...');
        const token = await atlasAuth.getAuthToken();
        console.log(` Token acquired: ${token.substring(0, 20)}...\n`);

        // Test 2: List Clusters
        console.log('2️ Testing Cluster Listing...');
        const clusters = await atlasApi.listClusters();
        console.log(` Found ${clusters.totalCount} clusters`);
        if (clusters.results) {
            clusters.results.forEach(cluster => {
                console.log(`   - ${cluster.name} (${cluster.stateName})`);
            });
        }
        console.log('');

        // Test 3: Get Production Cluster Details
        console.log('3️ Testing Production Cluster Access...');
        const prodCluster = await atlasApi.getCluster('JustAir-Dedicated-Cluster');
        console.log(` JustAir-Dedicated-Cluster: ${prodCluster.stateName}`);
        console.log(`   MongoDB Version: ${prodCluster.mongoDBVersion}`);
        console.log('');

        // Test 4: Snapshot Validation
        console.log('4️ Testing Snapshot Availability...');
        const validation = await snapshotManager.validateSnapshotAvailability();
        console.log(` ${validation.totalSnapshots} snapshots available`);
        console.log(`   Latest: ${validation.latestSnapshot.id}`);
        console.log(`   Created: ${validation.latestSnapshot.createdAt}`);
        console.log('');

        console.log(' All integration tests passed!');

    } catch (error) {
        console.error(' Integration test failed:', error.message);
        
        // Add more detailed error information
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
        
        console.error('Full error:', error);
        process.exit(1);
    }
}

// Run tests
testIntegration();