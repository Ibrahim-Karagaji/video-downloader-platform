# 🎬 Universal Video Downloader | منزّل الفيديوهات الشامل

A modern, fast, and simple React + Express video downloader that allows downloading videos from **YouTube, X (Twitter), Snapchat, TikTok, Instagram, Facebook, Reddit, and 1000+ platforms** in any quality or format (MP4 1080p/720p/480p, MP3 Audio, etc.).

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Install yt-dlp (Core Downloader Engine)
The backend uses `yt-dlp` to extract and stream videos from all platforms:
```bash
pip install yt-dlp
```

### 3. Run the App
```bash
npm run dev
```
This runs both:
- **Express Backend API** on `http://localhost:5000`
- **React Frontend (Vite)** on `http://localhost:3000`

Open `http://localhost:3000` in your browser.

---

## 🌟 Features
- ⚡ **Any Platform**: Supports YouTube, X / Twitter, Snapchat, TikTok, Instagram, Facebook, Vimeo, Reddit, and more.
- 🎚️ **Any Format & Quality (أي صيغة وجودة)**:
  - 🎥 Best Available Quality (MP4)
  - 🎥 Full HD 1080p
  - 🎥 HD 720p
  - 🎥 SD 480p / 360p
  - 🎵 Audio Only MP3
  - 🎵 Audio Only M4A
- 📋 **One-Click Paste**: Automatic clipboard paste button.
- 🖼️ **Video Preview**: Live thumbnail, title, author, duration, and platform detection.
- ⚡ **Direct Browser Streaming**: Doesn't waste local hard drive storage on temp files; streams directly to the browser's download manager.
- 🌙 **Modern Dark UI**: Beautiful responsive design with Tailwind CSS and Lucide icons.

