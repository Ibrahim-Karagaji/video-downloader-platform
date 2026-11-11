import express from 'express';
import cors from 'cors';
import { spawn, execSync } from 'child_process';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Detect whether yt-dlp is available via direct binary or python -m yt_dlp
function getWorkingYtdlpCmd() {
  try {
    execSync('yt-dlp --version', { stdio: 'ignore' });
    return { cmd: 'yt-dlp', argsPrefix: [] };
  } catch {
    try {
      execSync('python -m yt_dlp --version', { stdio: 'ignore' });
      return { cmd: 'python', argsPrefix: ['-m', 'yt_dlp'] };
    } catch {
      try {
        execSync('py -m yt_dlp --version', { stdio: 'ignore' });
        return { cmd: 'py', argsPrefix: ['-m', 'yt_dlp'] };
      } catch {
        return null;
      }
    }
  }
}

// Detect whether ffmpeg is available
function hasFfmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  const ytdlp = getWorkingYtdlpCmd();
  const ffmpeg = hasFfmpeg();
  res.json({
    status: 'ok',
    ytdlpAvailable: !!ytdlp,
    ffmpegAvailable: ffmpeg,
    engine: ytdlp ? (ytdlp.cmd === 'yt-dlp' ? 'yt-dlp binary' : 'python yt_dlp module') : 'Not found'
  });
});

// Clean filename for Content-Disposition header
function sanitizeFilename(name) {
  return (name || 'video')
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

// Format duration helper (seconds to HH:MM:SS or MM:SS)
function formatDuration(sec) {
  if (!sec || isNaN(sec)) return null;
  const s = Math.floor(sec);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Detect platform from URL or extractor
function detectPlatform(url, extractor) {
  const lowerUrl = (url || '').toLowerCase();
  const lowerExt = (extractor || '').toLowerCase();

  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be') || lowerExt.includes('youtube')) return 'youtube';
  if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com') || lowerExt.includes('twitter')) return 'x';
  if (lowerUrl.includes('snapchat.com') || lowerExt.includes('snapchat')) return 'snapchat';
  if (lowerUrl.includes('tiktok.com') || lowerExt.includes('tiktok')) return 'tiktok';
  if (lowerUrl.includes('instagram.com') || lowerExt.includes('instagram')) return 'instagram';
  if (lowerUrl.includes('facebook.com') || lowerUrl.includes('fb.watch') || lowerExt.includes('facebook')) return 'facebook';
  if (lowerUrl.includes('reddit.com') || lowerExt.includes('reddit')) return 'reddit';
  if (lowerUrl.includes('pinterest.com') || lowerExt.includes('pinterest')) return 'pinterest';
  if (lowerUrl.includes('vimeo.com') || lowerExt.includes('vimeo')) return 'vimeo';
  return 'generic';
}

// 1. Get video metadata and formats
app.post('/api/info', async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string' || !url.trim().startsWith('http')) {
    return res.status(400).json({ error: 'Please provide a valid video URL starting with http:// or https://' });
  }

  const ytdlp = getWorkingYtdlpCmd();
  if (!ytdlp) {
    return res.status(500).json({
      error: 'yt-dlp is not installed on the system. Please run: pip install yt-dlp',
      code: 'YTDLP_MISSING'
    });
  }

  const cleanUrl = url.trim();
  const args = [
    ...ytdlp.argsPrefix,
    '--dump-json',
    '--no-playlist',
    '--no-warnings',
    cleanUrl
  ];

  let stdoutData = '';
  let stderrData = '';

  const child = spawn(ytdlp.cmd, args);

  child.stdout.on('data', (chunk) => {
    stdoutData += chunk.toString();
  });

  child.stderr.on('data', (chunk) => {
    stderrData += chunk.toString();
  });

  child.on('close', (code) => {
    if (code !== 0) {
      console.error('yt-dlp info error:', stderrData);
      return res.status(500).json({
        error: stderrData.split('\n')[0] || 'Failed to fetch video information. Ensure the video is public and supported.',
        details: stderrData
      });
    }

    try {
      const data = JSON.parse(stdoutData.trim());
      
      const title = data.title || 'Untitled Video';
      const thumbnail = data.thumbnail || (data.thumbnails && data.thumbnails[data.thumbnails.length - 1]?.url) || null;
      const duration = formatDuration(data.duration);
      const uploader = data.uploader || data.channel || data.creator || 'Unknown';
      const platform = detectPlatform(cleanUrl, data.extractor);

      // Predefined quality & format options
      const options = [
        { id: 'best', label: 'Best Quality (MP4 Video)', ext: 'mp4', type: 'video', quality: 'Best Available' },
        { id: '1080', label: 'Full HD 1080p (MP4)', ext: 'mp4', type: 'video', quality: '1080p' },
        { id: '720', label: 'HD 720p (MP4)', ext: 'mp4', type: 'video', quality: '720p' },
        { id: '480', label: 'SD 480p (MP4)', ext: 'mp4', type: 'video', quality: '480p' },
        { id: '360', label: 'Low 360p (MP4)', ext: 'mp4', type: 'video', quality: '360p' },
        { id: 'mp3', label: 'Audio Only (MP3)', ext: 'mp3', type: 'audio', quality: 'Best Audio' },
        { id: 'm4a', label: 'Audio Only (M4A)', ext: 'm4a', type: 'audio', quality: 'Original Audio' }
      ];

      res.json({
        id: data.id,
        title,
        thumbnail,
        duration,
        uploader,
        platform,
        url: cleanUrl,
        formats: options
      });
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr);
      res.status(500).json({ error: 'Failed to parse video metadata' });
    }
  });
});

// 2. Direct streaming download endpoint
app.get('/api/download', (req, res) => {
  const { url, quality = 'best', title = 'video' } = req.query;

  if (!url || typeof url !== 'string' || !url.trim().startsWith('http')) {
    return res.status(400).send('Invalid URL');
  }

  const ytdlp = getWorkingYtdlpCmd();
  if (!ytdlp) {
    return res.status(500).send('yt-dlp is not installed');
  }

  const safeTitle = sanitizeFilename(title);
  const ffmpegInstalled = hasFfmpeg();
  let ext = 'mp4';
  let formatArg = 'best[ext=mp4]/best';

  if (ffmpegInstalled) {
    if (quality === '1080') {
      formatArg = 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080]/best';
      ext = 'mp4';
    } else if (quality === '720') {
      formatArg = 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720]/best';
      ext = 'mp4';
    } else if (quality === '480') {
      formatArg = 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480]/best';
      ext = 'mp4';
    } else if (quality === '360') {
      formatArg = 'bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/best[height<=360]/best';
      ext = 'mp4';
    } else if (quality === 'mp3') {
      formatArg = 'bestaudio/best';
      ext = 'mp3';
    } else if (quality === 'm4a') {
      formatArg = 'bestaudio[ext=m4a]/bestaudio/best';
      ext = 'm4a';
    } else {
      formatArg = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best';
      ext = 'mp4';
    }
  } else {
    // Progressive formats that have both video + audio bundled into one stream without requiring ffmpeg muxing
    if (quality === '720' || quality === '1080') {
      formatArg = 'best[height<=1080][ext=mp4]/best[ext=mp4]/best';
      ext = 'mp4';
    } else if (quality === '480') {
      formatArg = 'best[height<=480][ext=mp4]/best[ext=mp4]/best';
      ext = 'mp4';
    } else if (quality === '360') {
      formatArg = 'best[height<=360][ext=mp4]/best[ext=mp4]/best';
      ext = 'mp4';
    } else if (quality === 'mp3' || quality === 'm4a') {
      formatArg = 'bestaudio[ext=m4a]/bestaudio/best';
      ext = quality === 'mp3' ? 'mp3' : 'm4a';
    } else {
      formatArg = 'best[ext=mp4]/best';
      ext = 'mp4';
    }
  }

  const filename = `${safeTitle}.${ext}`;
  const asciiFallback = safeTitle.replace(/[^\x20-\x7E]/g, '').trim() || 'video';

  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${asciiFallback}.${ext}"; filename*=UTF-8''${encodeURIComponent(filename)}`
  );
  res.setHeader(
    'Content-Type',
    quality.includes('mp3') ? 'audio/mpeg' : quality.includes('m4a') ? 'audio/mp4' : 'video/mp4'
  );

  const args = [
    ...ytdlp.argsPrefix,
    '-o', '-',
    '--no-playlist',
    '-f', formatArg,
    url
  ];

  const child = spawn(ytdlp.cmd, args);

  child.stdout.pipe(res);

  child.stderr.on('data', (data) => {
    // yt-dlp outputs progress to stderr
    console.log(`[yt-dlp download]: ${data.toString().trim()}`);
  });

  child.on('error', (err) => {
    console.error('Spawn error:', err);
    if (!res.headersSent) {
      res.status(500).send('Download failed to start');
    }
  });

  req.on('close', () => {
    if (!child.killed) {
      child.kill('SIGINT');
    }
  });
});

app.listen(PORT, () => {
  console.log(`✅ Downloader API Server running on http://localhost:${PORT}`);
});

