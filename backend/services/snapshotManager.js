// Snapshot Management Service for JustAir-Dedicated-Cluster
import dotenv from 'dotenv'
import atlasApi from './atlasApi.js';

//load environment variables
dotenv.config();

class SnapshotManager {
    constructor() {
        this.productionCluster = process.env.PRODUCTION_CLUSTER_NAME;
    }

    async validateSnapshotAvailability() {
        try {
            const snapshots = await atlasApi.getClusterSnapshots(this.productionCluster);
            
            if (!snapshots.results || snapshots.results.length === 0) {
                throw new Error(`No snapshots available for ${this.productionCluster}`);
            }
            
            const latestSnapshot = snapshots.results[0];
            const snapshotAge = Date.now() - new Date(latestSnapshot.createdAt).getTime();
            
            return {
                isValid: true,
                latestSnapshot: latestSnapshot,
                totalSnapshots: snapshots.totalCount,
                snapshotAge: snapshotAge
            };
        } catch (error) {
            console.error('Snapshot validation failed:', error.message);
            throw error;
        }
    }

    
    async getAvailableSnapshots() {
        try {
            console.log(`📸 Fetching all snapshots from ${this.productionCluster}...`);
            
            const snapshots = await atlasApi.getClusterSnapshots(this.productionCluster);
            
            return {
                totalSnapshots: snapshots.totalCount || 0,
                snapshots: snapshots.results || [],
                latestSnapshot: snapshots.results?.[0] || null
            };
        } catch (error) {
            console.error(' Failed to get available snapshots:', error.message);
            throw error;
        }
    }
    async getLatestSnapshotInfo() {
        try {
            console.log(`📷 Getting latest snapshot from ${this.productionCluster}...`);
            
            const latestSnapshot = await atlasApi.getLatestSnapshot();
            
            return {
                id: latestSnapshot.id,
                createdAt: latestSnapshot.createdAt,
                description: latestSnapshot.description,
                sizeGB: (latestSnapshot.storageSizeBytes / 1024 / 1024 / 1024).toFixed(2),
                type: latestSnapshot.type,
                status: latestSnapshot.status,
                clusterId: latestSnapshot.clusterId
            };
        } catch (error) {
            console.error(' Failed to get latest snapshot info:', error.message);
            throw error;
        }
    }
}

export default new SnapshotManager();