// Snapshot Management Service for JustAir-Dedicated-Cluster
import dotenv from 'dotenv'
import atlasApi from './atlasApi.js';

//load environment variables
dotenv.config();

class SnapshotManager {
    constructor() {
        this.productionCluster = process.env.PRODUCTION_CLUSTER_NAME;
    }

    //checks if there are usable snapshots
    async validateSnapshotAvailability() {
        try {
            //step 1: gets all snapshots
            const snapshots = await atlasApi.getClusterSnapshots(this.productionCluster);
            //cehcks if any exist
            if (!snapshots.results || snapshots.results.length === 0) {
                throw new Error(`No snapshots available for ${this.productionCluster}`);
            }
            //calculates how all the latest one is by subtracting the newDate as it when it was created it from the date now
            const latestSnapshot = snapshots.results[0]; //get the latest snapshot the getClusterSnapshot mehtod in AtlasAPi which already sorted through which one is recent
            const snapshotAge = Date.now() - new Date(latestSnapshot.createdAt).getTime();
            
            //return validation results
            return {
                isValid: true, //we confirmed snapshots exists
                latestSnapshot: latestSnapshot, //
                totalSnapshots: snapshots.totalCount,
                snapshotAge: snapshotAge //in milliseconds
            };
        } catch (error) {
            console.error('Snapshot validation failed:', error.message);
            throw error;
        }
    }

    
    async getAvailableSnapshots() {
        try {
            console.log(` Fetching all snapshots from ${this.productionCluster}...`);
            //step 1: call atlasApi t get raw snapshot data from MongoDB Atlas
            const snapshots = await atlasApi.getClusterSnapshots(this.productionCluster); //calls the method from atlasApi service which defines what info we get when we call the getclusterSnapshots from the production cluster
            
            return { //step2: //formats the response
                totalSnapshots: snapshots.totalCount || 0, //how many exist
                snapshots: snapshots.results || [], //an array of all snapshots
                latestSnapshot: snapshots.results?.[0] || null // the newest one 
            };
        } catch (error) {
            console.error(' Failed to get available snapshots:', error.message);
            throw error;
        }
    }
    async getLatestSnapshotInfo() {
        try {
            console.log(` Getting latest snapshot from ${this.productionCluster}...`);
            //Step 1: get the latest snapshot(atlasApi handles sorting)
            const latestSnapshot = await atlasApi.getLatestSnapshot(); //this method is defined in AtlasAPI
            
            //returns a single snapshot object, not an array
            return { //format specific field for easy consumption
                id: latestSnapshot.id,
                createdAt: latestSnapshot.createdAt,
                description: latestSnapshot.description,
                sizeGB: (latestSnapshot.storageSizeBytes / 1024 / 1024 / 1024).toFixed(2), //converting bytes to gigabytes
                type: latestSnapshot.type, //might be manual, scheduled, or continous
                status: latestSnapshot.status, //status might be inProgress, complete or failed
                clusterId: latestSnapshot.clusterId
            };
        } catch (error) {
            console.error(' Failed to get latest snapshot info:', error.message);
            throw error;
        }
    }
}

export default new SnapshotManager();