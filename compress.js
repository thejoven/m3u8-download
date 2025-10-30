#!/usr/bin/env node

// 视频压缩工具：压缩本地视频文件
// ESM, Node 18+

// Load environment variables from .env file
import 'dotenv/config';

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join, basename, extname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function sanitizeFilename(name) {
  return name
    .replace(/[\s]+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    || 'compressed-video';
}

function parseArgs(argv) {
  // Use .env defaults if available, otherwise use hardcoded defaults
  const defaultCodec = process.env.DEFAULT_CODEC || 'h264';
  const defaultCrf = process.env.DEFAULT_CRF ? Number(process.env.DEFAULT_CRF) : 23;
  const defaultPreset = process.env.DEFAULT_PRESET || 'medium';
  const defaultAudioBitrate = process.env.DEFAULT_AUDIO_BITRATE || '128k';

  const args = {
    input: undefined,
    output: undefined,
    codec: defaultCodec,
    crf: defaultCrf,
    preset: defaultPreset,
    audioBitrate: defaultAudioBitrate,
    noProxy: false
  };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (!args.input && !a.startsWith('-')) {
      args.input = a;
      continue;
    }
    if (a === '--output' && i + 1 < rest.length) {
      args.output = rest[++i];
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
  console.log('Usage: node compress.js <INPUT_VIDEO_FILE> [options]');
  console.log('');
  console.log('Options:');
  console.log('  --output <file>          Output file path (default: auto-generated)');
  console.log('  --codec <h264|hevc>      Video codec (default: h264)');
  console.log('  --h265                   Alias of --codec hevc');
  console.log('  --crf <num>              Constant Rate Factor (default: 23)');
  console.log('  --preset <p>             x264/x265 preset (default: medium)');
  console.log('  --audio-bitrate <rate>   Audio bitrate (default: 128k)');
  console.log('  --no-proxy               Disable proxy usage (for consistency)');
  console.log('');
  console.log('Examples:');
  console.log('  node compress.js video.mp4 --codec hevc --crf 26');
  console.log('  node compress.js input.mp4 --output compressed.mp4 --preset slow');
  console.log('');
  console.log('Configuration:');
  console.log('  Create a .env file to set default values for all options');
  console.log('  See .env.example for available configuration options');
  process.exit(code);
}

function generateOutputPath(inputPath, outputPath, codec) {
  if (outputPath) {
    return outputPath;
  }

  const inputDir = dirname(inputPath);
  const inputName = basename(inputPath, extname(inputPath));
  const codecSuffix = codec === 'hevc' ? '-hevc' : '-compressed';
  const outputName = sanitizeFilename(`${inputName}${codecSuffix}.mp4`);

  return join(inputDir, outputName);
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

async function runFfmpeg(inputPath, outputPath, { codec, crf, preset, audioBitrate }) {
  const videoCodec = codec === 'hevc' ? 'libx265' : 'libx264';
  const args = [
    '-y',
    '-hide_banner',
    '-loglevel', 'error',
    '-stats',
    '-i', inputPath,
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
  if (!args.input) {
    console.error('❌ Error: Please provide an input video file.');
    printHelpAndExit(1);
  }

  const outputPath = generateOutputPath(args.input, args.output, args.codec);

  try {
    await ensureFfmpegAvailable();
  } catch (e) {
    console.error('❌ ffmpeg not found. Please install ffmpeg and ensure it is in PATH.');
    console.error('   macOS (brew):  brew install ffmpeg');
    console.error('   Ubuntu/Debian: sudo apt-get install ffmpeg');
    console.error('   Windows (choco): choco install ffmpeg');
    process.exit(1);
  }

  console.log('🎬 Starting video compression...');
  console.log(`📥 Input: ${args.input}`);
  console.log(`📦 Output: ${outputPath}`);
  console.log(`🎞️  Codec: ${args.codec === 'hevc' ? 'HEVC (libx265)' : 'H.264 (libx264)'} | CRF: ${args.crf} | Preset: ${args.preset}`);
  console.log('');

  try {
    await runFfmpeg(args.input, outputPath, args);
    console.log('');
    console.log('✅ Compression completed!');
    console.log(`📄 File: ${outputPath}`);
  } catch (err) {
    console.error('');
    console.error('❌ Compression failed:', err.message);
    process.exit(1);
  }
}

main();