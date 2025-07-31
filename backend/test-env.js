import dotenv from 'dotenv';

// Load environment variables
const result = dotenv.config();

console.log('🔍 Environment Loading Test:');
console.log('dotenv.config() result:', result);
console.log('');

console.log('Environment Variables:');
console.log('ATLAS_CLIENT_ID:', process.env.ATLAS_CLIENT_ID ? 'SET' : 'MISSING');
console.log('ATLAS_CLIENT_SECRET:', process.env.ATLAS_CLIENT_SECRET ? 'SET' : 'MISSING');
console.log('ATLAS_AUTH_URL:', process.env.ATLAS_AUTH_URL);
console.log('');

if (!process.env.ATLAS_CLIENT_ID) {
    console.error(' ATLAS_CLIENT_ID is not set!');
}
if (!process.env.ATLAS_CLIENT_SECRET) {
    console.error(' ATLAS_CLIENT_SECRET is not set!');
}
if (!process.env.ATLAS_AUTH_URL) {
    console.error(' ATLAS_AUTH_URL is not set!');
}

console.log('Current working directory:', process.cwd());
console.log('Looking for .env file at:', process.cwd() + '/.env');

// Try to read .env file manually
try {
    const fs = await import('fs');
    const envContent = fs.readFileSync('.env', 'utf8');
    console.log('\n .env file found and readable');
    console.log('First few lines:');
    console.log(envContent.split('\n').slice(0, 3).join('\n'));
} catch (error) {
    console.error('\n Cannot read .env file:', error.message);
}