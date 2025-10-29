#!/usr/bin/env node

// One-click CLI: download + merge + compress into a single MP4 under data/
// ESM, Node 18+

// Load environment variables from .env file
import 'dotenv/config';

// Configure global proxy BEFORE any other imports
import { bootstrap } from 'global-agent';

// Function to setup proxy based on command line arguments and .env config
function setupProxy(noProxy) {
  // Check if proxy should be disabled by .env config
  const disableProxyByEnv = process.env.DISABLE_PROXY === 'true';

  if (noProxy || disableProxyByEnv) {
    // Clear proxy environment variables when proxy is disabled
    delete process.env.GLOBAL_AGENT_HTTP_PROXY;
    delete process.env.GLOBAL_AGENT_HTTPS_PROXY;
    return false;
  }

  // Use .env proxy settings if available, otherwise use defaults
  const httpProxy = process.env.GLOBAL_AGENT_HTTP_PROXY || process.env.HTTP_PROXY || 'http://127.0.0.1:7890';
  const httpsProxy = process.env.GLOBAL_AGENT_HTTPS_PROXY || process.env.HTTPS_PROXY || httpProxy;

  // Set proxy environment variables
  process.env.GLOBAL_AGENT_HTTP_PROXY = httpProxy;
  process.env.GLOBAL_AGENT_HTTPS_PROXY = httpsProxy;

  bootstrap();
  return true;
}

import { spawn } from 'child_process';
import { mkdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function sanitizeFilename(name) {
  return name
    .replace(/[\s]+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    || 'video';
}

function defaultBaseNameFromUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    const host = u.host.replace(/[:.]/g, '-');
    const pathLast = (u.pathname.split('/').filter(Boolean).pop() || 'stream')
      .replace(/\.(m3u8|ts|mp4)$/i, '');
    const ts = new Date()
      .toISOString()
      .replace(/[:T]/g, '-')
      .replace(/\..+$/, '');
    return sanitizeFilename(`${host}-${pathLast}-${ts}`);
  } catch {
    const ts = Date.now();
    return `video-${ts}`;
  }
}

function parseArgs(argv) {
  // Use .env defaults if available, otherwise use hardcoded defaults
  const defaultCodec = process.env.DEFAULT_CODEC || 'h264';
  const defaultCrf = process.env.DEFAULT_CRF ? Number(process.env.DEFAULT_CRF) : 23;
  const defaultPreset = process.env.DEFAULT_PRESET || 'medium';
  const defaultAudioBitrate = process.env.DEFAULT_AUDIO_BITRATE || '128k';

  const args = {
    url: undefined,
    name: undefined,
    codec: defaultCodec,
    crf: defaultCrf,
    preset: defaultPreset,
    audioBitrate: defaultAudioBitrate,
    noProxy: false
  };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (!args.url && !a.startsWith('-')) {
      args.url = a;
      continue;
    }
    if (a === '--name' && i + 1 < rest.length) {
      args.name = rest[++i];
      continue;
    }
    if ((a === '--codec' || a === '--video-codec') && i + 1 < rest.length) {
      const v = rest[++i].toLowerCase();
      args.codec = v === 'hevc' || v === 'h265' || v === 'x265' ? 'hevc' : 'h264';
      continue;
    }
    if (a === '--h265' || a === '--hevc') {
      args.codec = 'hevc';
      continue;
    }
    if (a === '--crf' && i + 1 < rest.length) {
      args.crf = Number(rest[++i]);
      continue;
    }
    if (a === '--preset' && i + 1 < rest.length) {
      args.preset = rest[++i];
      continue;
    }
    if ((a === '--ab' || a === '--audio-bitrate') && i + 1 < rest.length) {
      args.audioBitrate = rest[++i];
      continue;
    }
    if (a === '--no-proxy') {
      args.noProxy = true;
      continue;
    }
    if (a === '-h' || a === '--help') {
      printHelpAndExit();
    }
  }
  return args;
}

function printHelpAndExit(code = 0) {
  console.log('Usage: node cli.js <M3U8_URL> [options]');
  console.log('');
  console.log('Options:');
  console.log('  --name <file>            Output base name (without extension)');
  console.log('  --codec <h264|hevc>      Video codec (default: h264)');
  console.log('  --h265                   Alias of --codec hevc');
  console.log('  --crf <num>              Constant Rate Factor (default: 23)');
  console.log('  --preset <p>             x264/x265 preset (default: medium)');
  console.log('  --audio-bitrate <rate>   Audio bitrate (default: 128k)');
  console.log('  --no-proxy               Disable proxy usage');
  console.log('');
  console.log('Environment:');
  console.log('  GLOBAL_AGENT_HTTP_PROXY / GLOBAL_AGENT_HTTPS_PROXY for proxy override');
  console.log('');
  console.log('Configuration:');
  console.log('  Create a .env file to set default values for all options');
  console.log('  See .env.example for available configuration options');
  process.exit(code);
}

async function ensureFfmpegAvailable() {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', ['-version'], { stdio: 'ignore' });
    p.on('error', reject);
    p.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error('ffmpeg not available'));
    });
  });
}

function buildFfmpegEnv() {
  const env = { ...process.env };
  const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy || process.env.GLOBAL_AGENT_HTTP_PROXY;
  const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.GLOBAL_AGENT_HTTPS_PROXY || httpProxy;
  if (httpProxy) env.HTTP_PROXY = httpProxy;
  if (httpsProxy) env.HTTPS_PROXY = httpsProxy;
  return env;
}

async function runFfmpeg(inputUrl, outputPath, { codec, crf, preset, audioBitrate }) {
  const videoCodec = codec === 'hevc' ? 'libx265' : 'libx264';
  const args = [
    '-y',
    '-hide_banner',
    '-loglevel', 'error',
    '-stats',
    '-i', inputUrl,
    '-c:v', videoCodec,
    '-preset', String(preset),
    '-crf', String(crf),
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', String(audioBitrate),
    '-movflags', '+faststart',
    outputPath,
  ];

  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'], env: buildFfmpegEnv() });
    proc.stdout.on('data', (d) => process.stdout.write(d));
    proc.stderr.on('data', (d) => process.stderr.write(d));
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
  });
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.url) {
    console.error('❌ Error: Please provide a M3U8 URL.');
    printHelpAndExit(1);
  }

  // Setup proxy based on command line argument
  const proxyEnabled = setupProxy(args.noProxy);

  const dataDir = join(__dirname, process.env.OUTPUT_DIR || 'data');
  await mkdir(dataDir, { recursive: true });

  const proxyStatus = proxyEnabled
    ? (process.env.GLOBAL_AGENT_HTTP_PROXY || process.env.GLOBAL_AGENT_HTTPS_PROXY || 'none')
    : 'disabled';
  console.log(`📁 Output directory: ${dataDir}`);
  console.log(`🌐 Proxy: ${proxyStatus}`);
  console.log('');

  const baseName = sanitizeFilename(args.name || defaultBaseNameFromUrl(args.url));
  const outPath = join(dataDir, `${baseName}.mp4`);

  try {
    await ensureFfmpegAvailable();
  } catch (e) {
    console.error('❌ ffmpeg not found. Please install ffmpeg and ensure it is in PATH.');
    console.error('   macOS (brew):  brew install ffmpeg');
    console.error('   Ubuntu/Debian: sudo apt-get install ffmpeg');
    console.error('   Windows (choco): choco install ffmpeg');
    process.exit(1);
  }

  console.log('📥 Downloading, merging and compressing via ffmpeg...');
  console.log(`🔗 URL: ${args.url}`);
  console.log(`🎞️  Codec: ${args.codec === 'hevc' ? 'HEVC (libx265)' : 'H.264 (libx264)'} | CRF: ${args.crf} | Preset: ${args.preset}`);
  console.log(`📦 Output: ${outPath}`);
  console.log('');

  try {
    await runFfmpeg(args.url, outPath, args);
    console.log('');
    console.log('✅ Completed!');
    console.log(`📄 File: ${outPath}`);
  } catch (err) {
    console.error('');
    console.error('❌ Processing failed:', err.message);
    process.exit(1);
  }
}

main();
