#!/usr/bin/env node

// Configure global proxy BEFORE any other imports
import { bootstrap } from 'global-agent';

// Set proxy environment variables
process.env.GLOBAL_AGENT_HTTP_PROXY = 'http://127.0.0.1:7890';
process.env.GLOBAL_AGENT_HTTPS_PROXY = 'http://127.0.0.1:7890';

// Bootstrap global agent to intercept all HTTP/HTTPS requests
bootstrap();

import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';
import { dirname, join, basename } from 'path';
import { mkdir, writeFile, access, stat } from 'fs/promises';
import { createWriteStream } from 'fs';
import { URL } from 'url';
import { constants } from 'fs';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Function to fetch content via HTTP/HTTPS
function fetchContent(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;

    protocol.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        // Handle redirects
        fetchContent(res.headers.location).then(resolve).catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`Failed to fetch ${url}: ${res.statusCode}`));
        return;
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// Function to download a file
function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;

    const file = createWriteStream(outputPath);

    protocol.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        // Handle redirects
        file.close();
        downloadFile(res.headers.location, outputPath).then(resolve).catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        file.close();
        reject(new Error(`Failed to download ${url}: ${res.statusCode}`));
        return;
      }

      res.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      file.close();
      reject(err);
    });
  });
}

// Parse M3U8 playlist
function parseM3U8(content) {
  const lines = content.split('\n').filter(line => line.trim());
  const segments = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#EXTINF:')) {
      // Next line should be the segment URL
      if (i + 1 < lines.length) {
        const segmentUrl = lines[i + 1].trim();
        if (!segmentUrl.startsWith('#')) {
          segments.push(segmentUrl);
        }
      }
    }
  }

  return segments;
}

// Check if file exists and has content
async function fileExists(filePath) {
  try {
    await access(filePath, constants.F_OK);
    const stats = await stat(filePath);
    return stats.size > 0; // Only consider file exists if it has content
  } catch {
    return false;
  }
}

// Download segments with concurrency control and resume support
async function downloadSegments(segments, baseUrl, outputDir, concurrency = 8) {
  const total = segments.length;
  let completed = 0;
  let skipped = 0;
  let failed = 0;

  console.log(`📦 Total segments: ${total}`);
  console.log(`⚡ Concurrency: ${concurrency}`);
  console.log('');

  // Create a queue of segment indices
  const queue = [...Array(segments.length).keys()];
  const workers = [];

  // Worker function
  const worker = async () => {
    while (queue.length > 0) {
      const index = queue.shift();
      if (index === undefined) break;

      const segment = segments[index];
      const segmentUrl = segment.startsWith('http')
        ? segment
        : new URL(segment, baseUrl).href;

      const filename = basename(segment);
      const outputPath = join(outputDir, filename);

      try {
        // Check if file already exists
        const exists = await fileExists(outputPath);

        if (exists) {
          skipped++;
          const progress = (((completed + skipped) / total) * 100).toFixed(1);
          process.stdout.write(`\r⏭️  Progress: ${completed + skipped}/${total} (${progress}%) - Skipped: ${filename} (already exists)`);
        } else {
          await downloadFile(segmentUrl, outputPath);
          completed++;
          const progress = (((completed + skipped) / total) * 100).toFixed(1);
          process.stdout.write(`\r✓ Progress: ${completed + skipped}/${total} (${progress}%) - Downloaded: ${filename}`);
        }
      } catch (error) {
        failed++;
        console.error(`\n❌ Failed to download ${filename}: ${error.message}`);
      }
    }
  };

  // Start workers
  for (let i = 0; i < concurrency; i++) {
    workers.push(worker());
  }

  // Wait for all workers to complete
  await Promise.all(workers);

  console.log('\n');
  return { completed, skipped, failed, total };
}

async function main() {
  // Get URL from command line arguments
  const url = process.argv[2];

  if (!url) {
    console.error('❌ Error: Please provide a M3U8 URL as an argument');
    console.log('Usage: node download.js <M3U8_URL>');
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
  console.log('📥 Fetching M3U8 playlist...');
  console.log(`🔗 URL: ${url}`);
  console.log('');

  try {
    // Fetch M3U8 content
    const m3u8Content = await fetchContent(url);

    // Save the playlist
    const playlistPath = join(dataDir, 'playlist.m3u8');
    await writeFile(playlistPath, m3u8Content);
    console.log(`✓ Saved playlist to: ${playlistPath}`);
    console.log('');

    // Parse segments
    const segments = parseM3U8(m3u8Content);

    if (segments.length === 0) {
      console.error('❌ No segments found in M3U8 playlist');
      process.exit(1);
    }

    // Download segments
    const result = await downloadSegments(segments, url, dataDir, 8);

    console.log('✅ Download completed!');
    console.log(`   Total: ${result.total}`);
    console.log(`   Downloaded: ${result.completed}`);
    console.log(`   Skipped: ${result.skipped}`);
    console.log(`   Failed: ${result.failed}`);

    if (result.failed > 0) {
      console.log('');
      console.log('⚠️  Some segments failed to download. You may want to retry.');
      process.exit(1);
    }

    if (result.skipped > 0) {
      console.log('');
      console.log('💡 Some segments were skipped (already downloaded). This is resume functionality.');
    }
  } catch (error) {
    console.error('');
    console.error('❌ Download failed:', error.message);
    console.error('');
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

main();
