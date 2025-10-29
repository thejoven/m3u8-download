#!/usr/bin/env node

// Configure global proxy BEFORE any other imports
import { bootstrap } from 'global-agent';

// Set proxy environment variables
process.env.GLOBAL_AGENT_HTTP_PROXY = 'http://127.0.0.1:7890';
process.env.GLOBAL_AGENT_HTTPS_PROXY = 'http://127.0.0.1:7890';

// Bootstrap global agent to intercept all HTTP/HTTPS requests
bootstrap();

import { m3u8DLN } from 'm3u8-dln';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdir } from 'fs/promises';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  // Get URL from command line arguments
  const url = process.argv[2];

  if (!url) {
    console.error('❌ Error: Please provide a M3U8 URL as an argument');
    console.log('Usage: node index.js <M3U8_URL>');
    process.exit(1);
  }

  // Create data directory if it doesn't exist
  const dataDir = join(__dirname, 'data');
  try {
    await mkdir(dataDir, { recursive: true });
    console.log(`📁 Output directory: ${dataDir}`);
  } catch (error) {
    console.error('❌ Failed to create data directory:', error.message);
    process.exit(1);
  }

  console.log('🌐 Using proxy: http://127.0.0.1:7890');
  console.log('📥 Starting download...');
  console.log(`🔗 URL: ${url}`);
  console.log('');

  try {
    const response = await m3u8DLN(url, dataDir, {
      segmentBatch: 8,
      streamBatch: 4,
      streamSelection: {
        strategy: 'first-one', // Changed to first-one to handle direct media playlists
      },
    });

    console.log('');
    console.log('✅ Download completed successfully!');
    console.log('📺 Output files:');
    response.forEach((result, index) => {
      result.outputFilePaths.forEach(filePath => {
        console.log(`   ${index + 1}. ${filePath}`);
      });
    });
  } catch (error) {
    console.error('');
    console.error('❌ Download failed:', error.message);
    console.error('');
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

main();
