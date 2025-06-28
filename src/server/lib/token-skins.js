const https = require('https');
const http = require('http');

// In-memory cache for token images
const tokenImageCache = new Map();

// Moralis API configuration
const MORALIS_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6ImM5NWM1OWM3LTlmMmUtNDU5OS1hMmVmLWI1MzI3NjY4Y2NhMyIsIm9yZ0lkIjoiMzkzOTY0IiwidXNlcklkIjoiNDA0ODE1IiwidHlwZUlkIjoiNjc4YzQ0ZGEtZTdhZi00ZWI1LWE3MzAtZjQ0NTU3Y2M4OGM2IiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3MTY4Mzg3MzcsImV4cCI6NDg3MjU5ODczN30.nmdkTpo4avW-PgS1_BKf8TQXUbZwPuvjkdcrJa76XHQ';

async function fetchTokenMetadata(tokenAddress) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'solana-gateway.moralis.io',
            path: `/token/mainnet/${tokenAddress}/metadata`,
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'X-API-Key': MORALIS_API_KEY
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (error) {
                        reject(new Error('Failed to parse token metadata'));
                    }
                } else {
                    reject(new Error(`Failed to fetch token metadata: ${res.statusCode}`));
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.end();
    });
}

async function fetchImageAsBase64(imageUrl) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(imageUrl);
        const protocol = urlObj.protocol === 'https:' ? https : require('http');
        
        protocol.get(imageUrl, (res) => {
            const chunks = [];
            
            res.on('data', (chunk) => {
                chunks.push(chunk);
            });
            
            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                const base64 = buffer.toString('base64');
                const mimeType = res.headers['content-type'] || 'image/png';
                resolve(`data:${mimeType};base64,${base64}`);
            });
        }).on('error', (error) => {
            reject(error);
        });
    });
}

async function getTokenSkin(tokenAddress) {
    // Check cache first
    if (tokenImageCache.has(tokenAddress)) {
        console.log(`[TOKEN SKIN] Using cached image for ${tokenAddress}`);
        return tokenImageCache.get(tokenAddress);
    }
    
    try {
        console.log(`[TOKEN SKIN] Fetching metadata for ${tokenAddress}`);
        
        // Fetch token metadata
        const metadata = await fetchTokenMetadata(tokenAddress);
        
        if (!metadata.logo) {
            throw new Error('No logo found for token');
        }
        
        // Fetch image as base64
        const base64Image = await fetchImageAsBase64(metadata.logo);
        
        // Create token skin data
        const tokenSkin = {
            id: `token_${tokenAddress}`,
            name: metadata.name || 'Unknown Token',
            symbol: metadata.symbol || tokenAddress.slice(0, 8),
            address: tokenAddress,
            image: base64Image,
            timestamp: Date.now()
        };
        
        // Cache the result
        tokenImageCache.set(tokenAddress, tokenSkin);
        
        console.log(`[TOKEN SKIN] Successfully fetched ${tokenSkin.name} (${tokenSkin.symbol})`);
        
        return tokenSkin;
    } catch (error) {
        console.error(`[TOKEN SKIN] Error fetching token ${tokenAddress}:`, error.message);
        throw error;
    }
}

// Clean up old cache entries (older than 1 hour)
setInterval(() => {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    for (const [address, skin] of tokenImageCache.entries()) {
        if (skin.timestamp < oneHourAgo) {
            tokenImageCache.delete(address);
            console.log(`[TOKEN SKIN] Removed expired cache entry for ${address}`);
        }
    }
}, 10 * 60 * 1000); // Run every 10 minutes

module.exports = {
    getTokenSkin,
    tokenImageCache
};