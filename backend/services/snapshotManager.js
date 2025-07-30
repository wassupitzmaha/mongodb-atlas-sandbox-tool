// Snapshot Management Service for JustAir-Dedicated-Cluster
import dotenv from 'dotenv'
import atlasApi from './atlasApi.js';

//load environment variables
dotenv.config();

class SnapshotManager {
    constructor() {
        this.productionCluster = process.env.PRODUCTION_CLUSTER_NAME;
    }

    // Validate snapshot availability before deployment
    async validateSnapshotAvailability() {
        try {
            const snapshots = await atlasApi.getClusterSnapshots(this.productionCluster);
            
            if (!snapshots.results || snapshots.results.length === 0) {
                throw new Error(`No snapshots available for ${this.productionCluster}`);
            }
            
            const latestSnapshot = snapshots.results[0];
            const snapshotAge = Date.now() - new Date(latestSnapshot.createdAt).getTime();
            
            console.log(`✅ Snapshot validation passed`);
            console.log(`📸 Latest snapshot: ${latestSnapshot.id}`);
            
            return {
                isValid: true,
                latestSnapshot: latestSnapshot,
                totalSnapshots: snapshots.totalCount,
                snapshotAge: snapshotAge
            };
        } catch (error) {
            console.error('❌ Snapshot validation failed:', error.message);
            throw error;
        }
    }
}

export default new SnapshotManager();