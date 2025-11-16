// Atlas API Service - Direct Postman Collection Integration
import axios from 'axios';

import dotenv from 'dotenv';

//import your atlas authentication service to get and refresh OAuth tokens automatically
import atlasAuth from './atlasAuth.js';

// iMPORTANT: Load environment variables in the service file
dotenv.config();

//
class AtlasApiService {
    constructor() {
        //base url for atlas api req 
        this.baseUrl = process.env.ATLAS_API_BASE_URL;
        //atlas group id to scope req to your res
        this.groupId = process.env.ATLAS_GROUP_ID;
        //default production cluster name used in snapshot calls and others
        this.productionCluster = process.env.PRODUCTION_CLUSTER_NAME;
        
        // Create axios instance configured with the baseURL and timeout for reuse
        this.client = axios.create({
            baseURL: this.baseUrl,
            timeout: 60000, //wait this much for response 
        });

        // Add request interceptor to inject authentication headers into every reqs
        //adds authentication to every request automatically
        this.client.interceptors.request.use(async (config) => {
            //get valid OAuth headers (Bearer token, correct content-type) from atlasAuth service
            const authHeaders = await atlasAuth.getAuthHeader(); //the await since it might need to refresh the token
            //merge these headers into the req config's headers
            config.headers = { ...config.headers, ...authHeaders };
            //return the udpated config so the req continues
            return config; // axios uses this modified config to add authentication to every request
        });

        // Add axios response interceptor for token refresh
        this.client.interceptors.response.use(
            (response) => response, //for successful responses, jsut return unchanged
            async (error) => {
                if (error.response?.status === 401) {
                    console.log('🔄 Received 401, refreshing token...');
                    //force token refresh using AtlasAuth service
                    await atlasAuth.refreshToken();
                    
                    // Retry original request with new token
                    //get new auth headers with fresh token
                    const authHeaders = await atlasAuth.getAuthHeader();
                    //update the original req headers with new token headers
                    error.config.headers = { ...error.config.headers, ...authHeaders };
                    //retry the original failed req with refreshed authentication
                    return this.client.request(error.config);
                }
                //for other errors or if retry is not triggered, reject promise with error
                return Promise.reject(error);
            }
        );
    }

    // List all clusters - Exact Postman format
    async listClusters() {
        try {
            console.log(' Listing clusters in project...');

            //use the axios client to call atlas api endpoint that lists clusters
            const response = await this.client.get(`/groups/${this.groupId}/clusters`);
            
            console.log(` Found ${response.data.totalCount || 0} clusters`);

            //return the entire response data to caller
            return response.data;
        } catch (error) {
            console.error(' Failed to list clusters:', error.response?.data || error.message);
            throw error;
        }
    }

    // Get single cluster details - Exact Postman format
    async getCluster(clusterName) {
        try {
            console.log(` Getting details for cluster: ${clusterName}`);

            //make GET req to Atlas API endpoint for this cluster's details
            const response = await this.client.get(`/groups/${this.groupId}/clusters/${clusterName}`);
            
            console.log(` Retrieved cluster details for ${clusterName}`);

            //return cluster info object
            return response.data;
        } catch (error) {
            console.error(` Failed to get cluster ${clusterName}:`, error.response?.data || error.message);
            throw error;
        }
    }

    // Get a list of snapshots for a specific cluster - Exact Postman forma, makes the HTTP req to the mongodb atlast
    async getClusterSnapshots(clusterName = this.productionCluster) {
        try {
            console.log(` Getting snapshots for cluster: ${clusterName}`);
            
            //GET snapshots endpoint for the specific cluster
            const response = await this.client.get(
                `/groups/${this.groupId}/clusters/${clusterName}/backup/snapshots`
            );
            
            console.log(` Found ${response.data.totalCount || 0} snapshots for ${clusterName}`);
            
            // if results array exitsts, sort snapshots descedning by created date (newest first)
            if (response.data.results) {
                response.data.results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            }
        //return the entire snapshots data including sorted results
            return response.data;
        } catch (error) {
            console.error(` Failed to get snapshots for ${clusterName}:`, error.response?.data || error.message);
            throw error;
        }
    }

    // Get latest snapshot from production cluster
    async getLatestSnapshot() {
        try {
            console.log(`📸 Getting latest snapshot from ${this.productionCluster}...`);
            
            //use getCLusterSnapshots internally to fetch all snapshots first
            const snapshots = await this.getClusterSnapshots(this.productionCluster);
            
            //throw error if no snapshots found
            if (!snapshots.results || snapshots.results.length === 0) {
                throw new Error(`No snapshots found for ${this.productionCluster}`);
            }
        

            //the newest snapshot is the first element afetr sorting (done in getCLusterSnapshots)
            const latestSnapshot = snapshots.results[0];
        
            //log specific details about the latest snapshot
            console.log(` Latest snapshot: ${latestSnapshot.id}`);
            console.log(` Created: ${latestSnapshot.createdAt}`);
            console.log(` Size: ${(latestSnapshot.storageSizeBytes / 1024 / 1024 / 1024).toFixed(2)} GB`);
            
            return latestSnapshot;
        } catch (error) {
            console.error(' Failed to get latest snapshot:', error.message);
            throw error;
        }
    }

    // Create cluster - using actual config from postman
    async createCluster(clusterName, options = {}) {
        try {
            console.log(` Creating cluster: ${clusterName}`);
            
            //cluster configuration object for sandbox environments
            const clusterConfig = {
                
                    "backupEnabled": true,
                    "biConnector": {
                        "enabled": false
                    },
                    "clusterType": "REPLICASET",
                    "globalClusterSelfManagedSharding": false,
                    "mongoDBMajorVersion": "8.0",
                    "name": clusterName,
                    "paused": false,
                    "pitEnabled": true,
                    "redactClientLogData": true,
                    "replicaSetScalingStrategy": "SEQUENTIAL",
                    "terminationProtectionEnabled": false,
                    "versionReleaseSystem": "LTS",
                    "replicationSpecs": [
                        {
                            "zoneName": "Zone 1",
                            "regionConfigs": [
                                {
                                    "priority": 7,
                                    "regionName": "US_EAST_1",
                                    "autoScaling": {
                                        "diskGB": {
                                            "enabled": true
                                        },
                                        "compute": {
                                            "enabled": true,
                                            "maxInstanceSize": "M40",
                                            "minInstanceSize": "M30",
                                            "scaleDownEnabled": true
                                        },
                                        "autoIndexing": {
                                            "enabled": false
                                        }
                                    },
                                    "providerName": "AWS",
                                    "readOnlySpecs": {
                                        "nodeCount": 0,
                                        "diskSizeGB": 10,
                                        "instanceSize": "M30"
                                    },
                                    "analyticsSpecs": {
                                        "nodeCount": 0,
                                        "diskSizeGB": 10,
                                        "instanceSize": "M30"
                                    },
                                    "electableSpecs": {
                                        "nodeCount": 3,
                                        "diskSizeGB": 10,
                                        "instanceSize": "M30"
                                    }
                                }
                            ]
                        }
                    ]
                }
            
            
            //POST req to create the lcuster with defined config
            const response = await this.client.post(`/groups/${this.groupId}/clusters`, clusterConfig);
            
            console.log(` Cluster creation initiated: ${clusterName}`);
            console.log(` Cluster will take 5-10 minutes to provision`);
            
            //return response data describing the created cluster req
            return response.data;
        } catch (error) {
            //log cluster creation failure details
            console.error(' Failed to create cluster:', error.response?.data || error.message);
            throw error;
        }
    }

    // Delete cluster given its name
    async deleteCluster(clusterName) {
        try {
            console.log(` Deleting cluster: ${clusterName}`);
            
            //send DELETE req for the cluster, passing options in the req body as data
            const response = await this.client.delete(`/groups/${this.groupId}/clusters/${clusterName}`, {
                data: {
                    pretty: true, //req a pretty-printeed response 
                    retainBackups: false //do not keep backups after deletion
                }
            });
            
            console.log(`Cluster deletion initiated: ${clusterName}`);
            return response.data;
        } catch (error) {
            if (error.response?.status === 404) {// checkin if cluster is already deleted or not
                console.log(` Cluster ${clusterName} already deleted or not found`);
                return { message: 'Cluster not found (may already be deleted)' };
            }
            console.error(` Failed to delete cluster ${clusterName}:`, error.response?.data || error.message);
            throw error;
        }
    }

    // Wait for cluster to reach specific state (default 'IDLE')
    async waitForClusterState(clusterName, targetState = 'IDLE', maxWaitMinutes = 15) {
        //convert maximum wait time from mins to milliseconds for timing logic
        const maxWaitMs = maxWaitMinutes * 60 * 1000;

        //set polling interval to 30 seconds ot avoid hitting rate limits unnecessarily; how often to check status 
        const pollInterval = 30000; // 30 seconds

        //record start time for timeout calculation
        const startTime = Date.now();

        console.log(` Waiting for cluster ${clusterName} to reach state: ${targetState}`);
        console.log(` Will check every 30 seconds, max wait: ${maxWaitMinutes} minutes`);

        //loop until cluster reaches target state or timeout exceeded
        while (Date.now() - startTime < maxWaitMs) {
            try {
                //fetch current cluster info/state
                const cluster = await this.getCluster(clusterName);

                const currentState = cluster.stateName;
                //log the current cluster state
                console.log(` Cluster ${clusterName} state: ${currentState}`);
                //check if cluster is in desired state - if yes, return clsuter info to caller
                if (currentState === targetState) {
                    console.log(` Cluster ${clusterName} is now ${targetState}!`);
                    return cluster;
                }

                //detect failure or deleted states early and throw error
                if (currentState === 'CREATION_FAILED' || currentState === 'DELETED') {
                    throw new Error(`Cluster entered error state: ${currentState}`);
                }

                // log wait before next poll iteration
                console.log(` Waiting 30 seconds before next status check...`);
                
                //wait for poll interval duration
                await this.delay(pollInterval);
            } catch (error) {

                //if cluster is not found during wait, raise meaningful error
                if (error.response?.status === 404) {
                    throw new Error(`Cluster ${clusterName} not found`);
                }
                throw error;
            }
        }

        //if timeout expires without reaching state throw timeout error
        throw new Error(`Timeout: Cluster ${clusterName} did not reach ${targetState} within ${maxWaitMinutes} minutes`);
    }

    // Utility helper function to create Promise-based delay for async wait
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async createRestoreJob(targetClusterName, snapshotId) {
        try {
            // Source cluster is always JUSTAIR-TEST-DEMO-CLUSTER (production)
            const sourceCluster = this.productionCluster;
            
            console.log(` Creating restore job...`);
            console.log(`   Source Cluster: ${sourceCluster}`);
            console.log(`   Target Cluster: ${targetClusterName}`);
            console.log(`   Snapshot ID: ${snapshotId}`);
            
            // Correct payload structure for automated restore
            const restorePayload = {
                deliveryType: "automated",              // CRITICAL: Must be "automated"
                targetClusterName: targetClusterName,   // Where to restore data
                targetGroupId: this.groupId,            //Our atlas project id
                snapshotId: snapshotId                  // Which snapshot to restore
            };
            
            // IMPORTANT: Post to SOURCE cluster endpoint (where snapshot lives)
            const response = await this.client.post(
                `/groups/${this.groupId}/clusters/${sourceCluster}/backup/restoreJobs`,
                restorePayload
            );
    
            console.log(` Restore job created successfully`);
            console.log(`   Job ID: ${response.data.id}`);
            console.log(`   Delivery Type: ${response.data.deliveryType}`);
            console.log(`   Status will be available at the source cluster`);
            
            return response.data;
        } catch (error) {
            console.error(` Failed to create restore job:`, error.response?.data || error.message);
            
            // Add helpful error context
            if (error.response?.status === 400) {
                console.error(`   Possible causes:`);
                console.error(`   - Target cluster not in IDLE state`);
                console.error(`   - Invalid snapshot ID`);
                console.error(`   - Target cluster doesn't exist`);
            }
            
            throw error;
        }
    }
    

    async waitForRestoreCompletion(restoreJobId, maxWaitMinutes = 15) {
        const maxWaitMs = maxWaitMinutes * 60 * 1000;
        const pollInterval = 30000; // 30 seconds (to avoid rate limits)
        const startTime = Date.now();
        
        // Always check on source cluster (where snapshot lives)
        const sourceCluster = this.productionCluster;
    
        console.log(`Waiting for restore job to complete...`);
        console.log(`   Job ID: ${restoreJobId}`);
        console.log(`   Source Cluster: ${sourceCluster}`);
        console.log(`   Max wait: ${maxWaitMinutes} minutes`);
        console.log(`   Checking every 30 seconds...`);
        
        while (Date.now() - startTime < maxWaitMs) {
            try {
                // Query SOURCE cluster for restore job status
                const response = await this.client.get(
                    `/groups/${this.groupId}/clusters/${sourceCluster}/backup/restoreJobs/${restoreJobId}`
                );
    
                const job = response.data;
                const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
                const elapsedMinutes = Math.floor(elapsedSeconds / 60);
                const remainingSeconds = elapsedSeconds % 60;
                
                console.log(`     Time elapsed: ${elapsedMinutes}m ${remainingSeconds}s`);
                console.log(`    Status: ${job.deliveryType} | Cancelled: ${job.cancelled}`);
    
                // Check if job completed successfully
                if (job.finishedAt) {
                    console.log(` Restore job completed successfully!`);
                    console.log(`   Finished at: ${job.finishedAt}`);
                    console.log(`   Total time: ${elapsedMinutes}m ${remainingSeconds}s`);
                    return job;
                }
                
                // Check if job was cancelled
                if (job.cancelled) {
                    throw new Error(`Restore job was cancelled`);
                }
                
                // Check for failed status (if API provides this field)
                if (job.failed) {
                    throw new Error(`Restore job failed: ${job.failureReason || 'Unknown reason'}`);
                }
                
                console.log(`   ⏳ Still restoring... checking again in 30s`);
                await this.delay(pollInterval);
                
            } catch (error) {
                if (error.response?.status === 404) {
                    throw new Error(`Restore job ${restoreJobId} not found on source cluster ${sourceCluster}`);
                }
                throw error;
            }
        }
    
        throw new Error(`Timeout: Restore job did not complete within ${maxWaitMinutes} minutes`);
    }
    
    //for manual testing
    async getRestoreJobStatus(restoreJobId) {
        try {
            const sourceCluster = this.productionCluster;
            
            const response = await this.client.get(
                `/groups/${this.groupId}/clusters/${sourceCluster}/backup/restoreJobs/${restoreJobId}`
            );
            
            const job = response.data;
            
            return {
                id: job.id,
                deliveryType: job.deliveryType,
                targetClusterName: job.targetClusterName,
                snapshotId: job.snapshotId,
                finishedAt: job.finishedAt,
                cancelled: job.cancelled,
                timestamp: job.timestamp,
                createdAt: job.createdAt,
                isComplete: !!job.finishedAt,
                isActive: !job.finishedAt && !job.cancelled,
                isCancelled: job.cancelled,
                sourceCluster: sourceCluster
            };
        } catch (error) {
            console.error(` Failed to get restore job status:`, error.response?.data || error.message);
            throw error;
        }
    }
    
//listing all restore jobs
    async listRestoreJobs() {
        try {
            const sourceCluster = this.productionCluster;
            
            console.log(` Listing all restore jobs from ${sourceCluster}...`);
            
            const response = await this.client.get(
                `/groups/${this.groupId}/clusters/${sourceCluster}/backup/restoreJobs`
            );
            
            console.log(`   Found ${response.data.totalCount || 0} restore jobs`);
            
            return {
                totalCount: response.data.totalCount || 0,
                jobs: response.data.results || [],
                sourceCluster: sourceCluster
            };
        } catch (error) {
            console.error(` Failed to list restore jobs:`, error.response?.data || error.message);
            throw error;
        }
    }


    async resumeCluster(clusterName) {
        try {
            console.log(` Resuming cluster: ${clusterName}`);
            
            const response = await this.client.patch(
                `/groups/${this.groupId}/clusters/${clusterName}`,
                {
                    paused: false
                }
            );
            
            console.log(` Cluster resume initiated: ${clusterName}`);
            return response.data;
        } catch (error) {
            console.error(` Failed to resume cluster ${clusterName}:`, error.response?.data || error.message);
            throw error;
        }
    }


    async waitForClusterIdle(clusterName, maxWaitMinutes = 15) {
        const maxWaitMs = maxWaitMinutes * 60 * 1000;
        const pollInterval = 30000; // 30 seconds
        const startTime = Date.now();

        console.log(` Waiting for cluster ${clusterName} to reach IDLE state`);
        console.log(`   Max wait time: ${maxWaitMinutes} minutes`);
        console.log(`   Polling every 30 seconds...`);

        while (Date.now() - startTime < maxWaitMs) {
            try {
                const cluster = await this.getCluster(clusterName);
                const currentState = cluster.stateName;
                const isPaused = cluster.paused;
                
                const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
                const elapsedMinutes = Math.floor(elapsedSeconds / 60);
                const remainingSeconds = elapsedSeconds % 60;
                
                console.log(`     ${elapsedMinutes}m ${remainingSeconds}s - State: ${currentState}${isPaused ? ' (PAUSED)' : ''}`);

                // Handle PAUSED state - resume and continue waiting
                if (isPaused) {
                    console.log(`   Cluster is paused, resuming...`);
                    await this.resumeCluster(clusterName);
                    console.log(`    Waiting for resume to complete...`);
                    await this.delay(pollInterval);
                    continue;
                }

                // Check if IDLE
                if (currentState === 'IDLE') {
                    console.log(`   Cluster ${clusterName} is now IDLE!`);
                    console.log(`    Total wait time: ${elapsedMinutes}m ${remainingSeconds}s`);
                    return cluster;
                }

                // Check for error states
                if (currentState === 'CREATION_FAILED') {
                    throw new Error(`Cluster creation failed`);
                }
                
                if (currentState === 'DELETED' || currentState === 'DELETING') {
                    throw new Error(`Cluster is being deleted or has been deleted`);
                }

                // Valid transitional states: CREATING, REPAIRING, UPDATING
                const validStates = ['CREATING', 'REPAIRING', 'UPDATING'];
                if (!validStates.includes(currentState)) {
                    console.warn(`   ⚠️  Unexpected state: ${currentState}`);
                }

                // Wait before next poll
                await this.delay(pollInterval);
            } catch (error) {
                if (error.response?.status === 404) {
                    throw new Error(`Cluster ${clusterName} not found`);
                }
                throw error;
            }
        }

        throw new Error(`Timeout: Cluster ${clusterName} did not reach IDLE within ${maxWaitMinutes} minutes`);
    }


    async clusterExists(clusterName) {
        try {
            await this.getCluster(clusterName);
            return true;
        } catch (error) {
            if (error.response?.status === 404) {
                return false;
            }
            throw error; // 
        }
    }



}
// Export both the class and a singleton instance
export { AtlasApiService };

// Create and export a singleton instance as default
export default new AtlasApiService();