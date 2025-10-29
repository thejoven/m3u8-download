# M3U8 视频下载工具

一个支持断点续传或一键合并压缩的 M3U8/HLS 下载工具。

[![Twitter Follow](https://img.shields.io/twitter/follow/thejoven_com?style=social)](https://x.com/thejoven_com)

**[中文文档](README_zh.md)** | **[English Documentation](README.md)**

## 功能特性

- 支持HTTP代理下载（默认127.0.0.1:7890，可通过环境变量或.env文件配置）
- 代理禁用选项：使用 `--no-proxy` 参数禁用代理
- 配置文件支持：创建 `.env` 文件进行持久化设置
- 基于哈希的文件夹结构：每个下载任务使用唯一文件夹 `data/{hash}/`
- 断点续传（手动模式）：自动跳过已下载的片段
- 一键模式：直接下载→合并→压缩，输出单文件到 `data/{hash}/`
- 并发下载（手动模式）：默认8个并发连接（可配置）
- 进度显示与错误容错

## 安装依赖

```bash
npm install
```

## 使用方法

### 一键下载→合并→压缩（推荐）

输出文件：`data/{hash}/<自动生成文件名>.mp4`（可用 `--name` 指定）

```bash
node cli.js "<M3U8_URL>"

# 可选参数
# --name <file>            指定输出基础文件名（不含扩展名）
# --codec <h264|hevc>      视频编码（默认 h264；hevc 为更高压缩比）
# --h265                   等价于 --codec hevc
# --crf <num>              质量/体积平衡（默认 23；越小越清晰）
# --preset <p>             编码速度/效率（默认 medium）
# --audio-bitrate <rate>   音频码率（默认 128k）
# --no-proxy               禁用代理使用
```

示例：

```bash
# 基本用法
node cli.js "https://example.com/playlist.m3u8" --name my-video --h265 --crf 26 --preset slow

# 禁用代理
node cli.js "https://example.com/playlist.m3u8" --no-proxy

# 使用自定义代理（通过 .env 文件）
# 创建 .env 文件并设置：HTTP_PROXY=http://your-proxy:8080
node cli.js "https://example.com/playlist.m3u8"
```

如果作为全局 CLI 安装（或 `npm link` 本仓库），可直接使用：

```bash
m3u8-one "<M3U8_URL>"
```

### 下载视频片段（手动模式）

```bash
node download.js "<M3U8_URL>"

# 禁用代理
node download.js "<M3U8_URL>" --no-proxy
```

### 示例

```bash
node download.js "https://prod-fastly-us-west-1.video.pscp.tv/Transcoding/v1/hls/o6U3UX5qItJ7V-Jmh9HGBb7uuyNgUHZnemnmw-l24VrxJ2Q5ytrb9q_39wwQVGPdsAGqDXXdy85iKfpfGbvybA/transcode/us-west-1/periscope-replay-direct-prod-us-west-1-public/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsInZlcnNpb24iOiIyIn0.eyJFbmNvZGVyU2V0dGluZyI6ImVuY29kZXJfc2V0dGluZ18xMDgwcDYwXzEwIiwiSGVpZ2h0IjoxMDgwLCJIaWdoRnJhbWVSYXRlIjp0cnVlLCJLYnBzIjo4MDAwLCJXaWR0aCI6MTkyMH0.OBq8EsoF4c8ydlmfZFxJzACPHYFjmjUaSER2wvsfHso/playlist_16685069917841765633.m3u8?type=replay"
```

## 输出

- 一键模式：生成单个 `data/{hash}/<name>.mp4`
- 手动模式：片段与播放列表保存在 `data/{hash}/`（`playlist.m3u8` 与若干 `.ts`）
- 基于哈希的文件夹：每个URL生成唯一的哈希文件夹，便于文件管理

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

### 默认代理
- HTTP/HTTPS代理：`http://127.0.0.1:7890`

### 禁用代理
使用 `--no-proxy` 参数禁用代理：
```bash
node cli.js "<M3U8_URL>" --no-proxy
node download.js "<M3U8_URL>" --no-proxy
node index.js "<M3U8_URL>" --no-proxy
```

### 通过环境变量设置自定义代理
在运行前设置环境变量：
```bash
export HTTP_PROXY=http://your-proxy:8080
export HTTPS_PROXY=http://your-proxy:8080
node cli.js "<M3U8_URL>"
```

### 传统方法（编辑源代码）
如需修改源代码中的代理设置，请编辑相应文件中的这几行：

```javascript
process.env.GLOBAL_AGENT_HTTP_PROXY = 'http://127.0.0.1:7890';
process.env.GLOBAL_AGENT_HTTPS_PROXY = 'http://127.0.0.1:7890';
```

## 通过 .env 文件配置

要进行持久化配置，请在项目根目录创建 `.env` 文件：

```bash
cp .env.example .env
# 编辑 .env 文件设置您的偏好
```

### 可用配置选项

```env
# 代理配置
DISABLE_PROXY=false                    # 设置为 "true" 默认禁用代理
HTTP_PROXY=http://127.0.0.1:7890       # HTTP 代理地址
HTTPS_PROXY=http://127.0.0.1:7890      # HTTPS 代理地址

# 下载配置
OUTPUT_DIR=data                         # 输出目录
CONCURRENT_DOWNLOADS=8                  # 并发下载数

# 视频编码默认值（仅 cli.js 使用）
DEFAULT_CODEC=h264                      # 默认视频编码器（h264 或 hevc）
DEFAULT_CRF=23                          # 默认 CRF 值
DEFAULT_PRESET=medium                   # 默认编码预设
DEFAULT_AUDIO_BITRATE=128k              # 默认音频码率
```

### 优先级顺序
1. **命令行参数**（最高优先级）
2. **.env 文件配置**
3. **代码默认值**（最低优先级）

### 使用示例

```bash
# 使用 .env 配置
node cli.js "https://example.com/playlist.m3u8"

# 覆盖 .env 配置
node cli.js "https://example.com/playlist.m3u8" --no-proxy --codec h264
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
├── .env.example         # 配置文件模板
├── .env                 # 用户配置文件（从 .env.example 创建）
├── data/                # 下载输出目录
│   ├── {hash1}/        # 任务1的哈希文件夹
│   │   ├── playlist.m3u8
│   │   └── *.ts
│   ├── {hash2}/        # 任务2的哈希文件夹
│   │   ├── playlist.m3u8
│   │   └── *.ts
│   └── ...
└── README.md
```

## 许可证

MIT

