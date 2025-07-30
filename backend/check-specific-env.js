import dotenv from 'dotenv';
dotenv.config();

console.log('🔍 Specific Environment Check:');
console.log('');

const authUrl = process.env.ATLAS_AUTH_URL;
console.log('Raw ATLAS_AUTH_URL value:', JSON.stringify(authUrl));
console.log('ATLAS_AUTH_URL type:', typeof authUrl);
console.log('ATLAS_AUTH_URL length:', authUrl?.length);
console.log('Starts with https:', authUrl?.startsWith('https://'));
console.log('');

// Check for hidden characters or encoding issues
if (authUrl) {
    console.log('Character by character analysis:');
    for (let i = 0; i < Math.min(authUrl.length, 50); i++) {
        console.log(`  ${i}: "${authUrl[i]}" (${authUrl.charCodeAt(i)})`);
    }
}

// Expected value
const expected = 'https://cloud.mongodb.com/api/oauth/token';
console.log('');
console.log('Expected:', expected);
console.log('Matches expected:', authUrl === expected);