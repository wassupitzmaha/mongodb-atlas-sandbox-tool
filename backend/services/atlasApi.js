// Atlas API Service - Direct Postman Collection Integration
import axios from 'axios';
import dotenv from 'dotenv';
import atlasAuth from './atlasAuth.js';

//load environment variables 
dotenv.config();

class AtlasApiService {
    constructor() {
        this.baseUrl = process.env.ATLAS_API_BASE_URL;
        this.groupId = process.env.ATLAS_GROUP_ID;
        this.productionCluster = process.env.PRODUCTION_CLUSTER_NAME;
        
        // Create axios instance
        this.client = axios.create({
            baseURL: this.baseUrl,
            timeout: 60000,
        });

        // Add request interceptor for authentication
        this.client.interceptors.request.use(async (config) => {
            const authHeaders = await atlasAuth.getAuthHeader();
            config.headers = { ...config.headers, ...authHeaders };
            return config;
        });

        // Add response interceptor for token refresh
        this.client.interceptors.response.use(
            (response) => response,
            async (error) => {
                if (error.response?.status === 401) {
                    console.log('🔄 Received 401, refreshing token...');
                    await atlasAuth.refreshToken();
                    
                    const authHeaders = await atlasAuth.getAuthHeader();
                    error.config.headers = { ...error.config.headers, ...authHeaders };
                    return this.client.request(error.config);
                }
                return Promise.reject(error);
            }
        );
    }

    // List all clusters
    async listClusters() {
        try {
            console.log('📋 Listing clusters in project...');
            const response = await this.client.get(`/groups/${this.groupId}/clusters`);
            console.log(`✅ Found ${response.data.totalCount || 0} clusters`);
            return response.data;
        } catch (error) {
            console.error('❌ Failed to list clusters:', error.response?.data || error.message);
            throw error;
        }
    }

    // Get single cluster details
    async getCluster(clusterName) {
        try {
            console.log(`🔍 Getting details for cluster: ${clusterName}`);
            const response = await this.client.get(`/groups/${this.groupId}/clusters/${clusterName}`);
            console.log(`✅ Retrieved cluster details for ${clusterName}`);
            return response.data;
        } catch (error) {
            console.error(`❌ Failed to get cluster ${clusterName}:`, error.response?.data || error.message);
            throw error;
        }
    }

    // Get cluster snapshots
    async getClusterSnapshots(clusterName = this.productionCluster) {
        try {
            console.log(`📸 Getting snapshots for cluster: ${clusterName}`);
            const response = await this.client.get(
                `/groups/${this.groupId}/clusters/${clusterName}/backup/snapshots`
            );
            console.log(`✅ Found ${response.data.totalCount || 0} snapshots for ${clusterName}`);
            
            if (response.data.results) {
                response.data.results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            }
            
            return response.data;
        } catch (error) {
            console.error(`❌ Failed to get snapshots for ${clusterName}:`, error.response?.data || error.message);
            throw error;
        }
    }

    // Get latest snapshot
    async getLatestSnapshot() {
        try {
            console.log(`📸 Getting latest snapshot from ${this.productionCluster}...`);
            const snapshots = await this.getClusterSnapshots(this.productionCluster);
            
            if (!snapshots.results || snapshots.results.length === 0) {
                throw new Error(`No snapshots found for ${this.productionCluster}`);
            }
            
            const latestSnapshot = snapshots.results[0];
            console.log(`✅ Latest snapshot: ${latestSnapshot.id}`);
            return latestSnapshot;
        } catch (error) {
            console.error('❌ Failed to get latest snapshot:', error.message);
            throw error;
        }
    }
}

export default new AtlasApiService();