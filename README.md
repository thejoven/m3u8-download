# M3U8 视频下载工具

一个支持断点续传或一键合并压缩的 M3U8/HLS 下载工具。

## 功能特性

- 支持HTTP代理下载（默认127.0.0.1:7890，可用环境变量覆盖）
- 断点续传（手动模式）：自动跳过已下载的片段
- 一键模式：直接下载→合并→压缩，输出单文件到 `data/`
- 并发下载（手动模式）：默认8个并发连接
- 进度显示与错误容错

## 安装依赖

```bash
npm install
```

## 使用方法

### 一键下载→合并→压缩（推荐）

输出文件：`data/<自动生成文件名>.mp4`（可用 `--name` 指定）

```bash
node cli.js "<M3U8_URL>"

# 可选参数
# --name <file>            指定输出基础文件名（不含扩展名）
# --codec <h264|hevc>      视频编码（默认 h264；hevc 为更高压缩比）
# --h265                   等价于 --codec hevc
# --crf <num>              质量/体积平衡（默认 23；越小越清晰）
# --preset <p>             编码速度/效率（默认 medium）
# --audio-bitrate <rate>   音频码率（默认 128k）
```

示例：

```bash
node cli.js "https://example.com/playlist.m3u8" --name my-video --h265 --crf 26 --preset slow
```

如果作为全局 CLI 安装（或 `npm link` 本仓库），可直接使用：

```bash
m3u8-one "<M3U8_URL>"
```

### 下载视频片段（手动模式）

```bash
node download.js "<M3U8_URL>"
```

### 示例

```bash
node download.js "https://prod-fastly-us-west-1.video.pscp.tv/Transcoding/v1/hls/o6U3UX5qItJ7V-Jmh9HGBb7uuyNgUHZnemnmw-l24VrxJ2Q5ytrb9q_39wwQVGPdsAGqDXXdy85iKfpfGbvybA/transcode/us-west-1/periscope-replay-direct-prod-us-west-1-public/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsInZlcnNpb24iOiIyIn0.eyJFbmNvZGVyU2V0dGluZyI6ImVuY29kZXJfc2V0dGluZ18xMDgwcDYwXzEwIiwiSGVpZ2h0IjoxMDgwLCJIaWdoRnJhbWVSYXRlIjp0cnVlLCJLYnBzIjo4MDAwLCJXaWR0aCI6MTkyMH0.OBq8EsoF4c8ydlmfZFxJzACPHYFjmjUaSER2wvsfHso/playlist_16685069917841765633.m3u8?type=replay"
```

## 输出

- 一键模式：生成单个 `data/<name>.mp4`
- 手动模式：片段与播放列表保存在 `data/`（`playlist.m3u8` 与若干 `.ts`）

## 断点续传

如果下载中断，只需重新运行相同的命令，程序会：
1. 检查已下载的片段
2. 自动跳过已下载的文件
3. 只下载缺失或失败的片段

## 下载结果统计

下载完成后会显示：
- **Total**: 总片段数
- **Downloaded**: 本次新下载的片段数
- **Skipped**: 跳过的片段数（已存在）
- **Failed**: 失败的片段数

## 代理配置

默认使用以下代理配置：
- HTTP/HTTPS代理：`http://127.0.0.1:7890`

如需修改代理，请编辑 `download.js` 文件中的这几行：

```javascript
process.env.GLOBAL_AGENT_HTTP_PROXY = 'http://127.0.0.1:7890';
process.env.GLOBAL_AGENT_HTTPS_PROXY = 'http://127.0.0.1:7890';
```

## 合并视频片段

手动模式下载完成后，可以使用ffmpeg合并所有.ts片段为一个完整视频：

```bash
# 进入data目录
cd data

# 使用ffmpeg合并
ffmpeg -i playlist.m3u8 -c copy output.mp4
```

## 视频压缩（ffmpeg）

以下示例用于在合并后或直接从 M3U8 压缩视频（体积更小、便于分享/存档）。一键模式已经内置压缩，无需再次处理。

### 质量优先（CRF，推荐）

```bash
ffmpeg -i input.mp4 -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k -movflags +faststart output.mp4
```

### 更高压缩比（HEVC/H.265）

```bash
ffmpeg -i input.mp4 -c:v libx265 -preset medium -crf 28 -c:a aac -b:a 128k output-hevc.mp4
```

### 指定目标码率（可控体积）

单次码控：

```bash
ffmpeg -i input.mp4 -c:v libx264 -b:v 1500k -maxrate 1500k -bufsize 3000k -c:a aac -b:a 128k output-1500k.mp4
```

双遍码控（更稳定）：

```bash
ffmpeg -y -i input.mp4 -c:v libx264 -b:v 1500k -pass 1 -an -f mp4 /dev/null
ffmpeg -i input.mp4 -c:v libx264 -b:v 1500k -pass 2 -c:a aac -b:a 128k -movflags +faststart output-2pass.mp4
```

### 降分辨率/帧率（显著减小体积）

```bash
ffmpeg -i input.mp4 -vf "scale=-2:720,fps=30" -c:v libx264 -crf 23 -preset medium -c:a aac -b:a 128k output-720p.mp4
```

### 直接从 M3U8 压缩

```bash
ffmpeg -i data/playlist.m3u8 -c:v libx264 -crf 23 -preset medium -c:a aac -b:a 128k output.mp4
```

小贴士：增加兼容性可加 `-pix_fmt yuv420p`；只封装不压缩可用 `-c copy`。

## 故障排除

### 网络错误

如果出现 "Client network socket disconnected" 错误：
1. 检查代理是否正常运行
2. 重新运行命令，断点续传会跳过已下载的片段

### 代理连接失败

确保本地代理服务（如Clash、V2Ray等）正在运行并监听7890端口。

## 文件结构

```
m3u8/
├── cli.js               # 一键下载→合并→压缩 CLI（输出单文件）
├── download.js          # 优化的下载脚本（支持断点续传）
├── index.js             # 基于 m3u8-dln 的下载脚本
├── package.json
├── data/                # 下载输出目录
│   ├── playlist.m3u8   # M3U8播放列表
│   └── *.ts            # 视频片段文件
└── README.md
```

## 许可证

MIT
