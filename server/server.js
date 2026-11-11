import express from 'express';
import cors from 'cors';
import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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

function hasFfmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function getExtraYtdlpArgs() {
  const extra = [
    '--extractor-args', 'youtube:player_client=android',
    '--extractor-args', 'twitter:api=syndication',
    '--extractor-args', 'tiktok:app_version=20.2.1',
    '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    '--add-header', 'Accept:text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    '--add-header', 'Accept-Language:en-US,en;q=0.9,ar;q=0.8',
    '--add-header', 'Sec-Fetch-Mode:navigate',
    '--geo-bypass',
    '--no-check-certificates',
    '--socket-timeout', '15',
    '--extractor-retries', '2'
  ];

  const localCookies = path.join(path.resolve(), 'cookies.txt');
  if (fs.existsSync(localCookies)) {
    extra.push('--cookies', localCookies);
  } else if (process.env.YOUTUBE_COOKIES || process.env.COOKIES) {
    const rawCookies = process.env.YOUTUBE_COOKIES || process.env.COOKIES;
    const tempCookies = path.join(os.tmpdir(), 'yt_env_cookies.txt');
    try {
      fs.writeFileSync(tempCookies, rawCookies.trim());
      extra.push('--cookies', tempCookies);
    } catch {}
  }

  return extra;
}

function normalizeVideoUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const clean = rawUrl.trim();

  try {
    const parsed = new URL(clean);
    
    if (parsed.hostname === 'youtu.be') {
      const vidId = parsed.pathname.replace(/^\//, '').split('/')[0];
      if (vidId) return `https://www.youtube.com/watch?v=${vidId}`;
    }

    if (parsed.hostname.includes('youtube.com')) {
      if (parsed.pathname.startsWith('/shorts/')) {
        const vidId = parsed.pathname.split('/shorts/')[1]?.split('/')[0]?.split('?')[0];
        if (vidId) return `https://www.youtube.com/watch?v=${vidId}`;
      }
      const vidId = parsed.searchParams.get('v');
      if (vidId) return `https://www.youtube.com/watch?v=${vidId}`;
    }

    const trackingParams = ['si', 'utm_source', 'utm_medium', 'utm_campaign', 's', 't', 'fbclid', 'igsh'];
    trackingParams.forEach(p => parsed.searchParams.delete(p));
    return parsed.toString();
  } catch {
    return clean;
  }
}

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

function sanitizeFilename(name) {
  return (name || 'video')
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

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

function detectPlatform(url, extractor) {
  const lowerUrl = (url || '').toLowerCase();
  const lowerExt = (extractor || '').toLowerCase();

  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be') || lowerExt.includes('youtube')) return 'youtube';
  if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com') || lowerExt.includes('twitter')) return 'x';
  if (lowerUrl.includes('snapchat.com') || lowerExt.includes('snapchat')) return 'snapchat';
  if (lowerUrl.includes('tiktok.com') || lowerExt.includes('tiktok')) return 'tiktok';
  if (lowerUrl.includes('instagram.com') || lowerExt.includes('instagram')) return 'instagram';
  if (lowerUrl.includes('facebook.com') || lowerUrl.includes('fb.watch') || lowerUrl.includes('fb.com') || lowerExt.includes('facebook')) return 'facebook';
  if (lowerUrl.includes('reddit.com') || lowerUrl.includes('redd.it') || lowerExt.includes('reddit')) return 'reddit';
  if (lowerUrl.includes('pinterest.com') || lowerUrl.includes('pin.it') || lowerExt.includes('pinterest')) return 'pinterest';
  if (lowerUrl.includes('vimeo.com') || lowerExt.includes('vimeo')) return 'vimeo';
  return 'generic';
}

app.post('/api/info', async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string' || !url.trim().startsWith('http')) {
    return res.status(400).json({ error: 'Please provide a valid video URL starting with http:// or https://' });
  }

  const cleanUrl = normalizeVideoUrl(url);

  const ytMatch = cleanUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/))([a-zA-Z0-9_-]{11})/);
  if (ytMatch && ytMatch[1]) {
    try {
      const vidId = ytMatch[1];
      const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${vidId}&format=json`, { signal: AbortSignal.timeout(4000) });
      if (oembedRes.ok) {
        const oembed = await oembedRes.json();
        return res.json({
          id: vidId,
          title: oembed.title || 'YouTube Video',
          thumbnail: `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`,
          duration: null,
          uploader: oembed.author_name || 'YouTube',
          platform: 'youtube',
          url: cleanUrl,
          formats: [
            { id: 'best', label: 'أعلى جودة متاحة (MP4)', ext: 'mp4', type: 'video', quality: 'Best Available' },
            { id: '720', label: 'HD 720p (MP4)', ext: 'mp4', type: 'video', quality: '720p' },
            { id: '480', label: 'SD 480p (MP4)', ext: 'mp4', type: 'video', quality: '480p' },
            { id: 'mp3', label: 'صوت فقط (Audio)', ext: 'mp3', type: 'audio', quality: 'Audio Only' }
          ]
        });
      }
    } catch {}
  }

  const ytdlp = getWorkingYtdlpCmd();
  if (!ytdlp) {
    return res.status(500).json({
      error: 'yt-dlp is not installed on the system. Please run: pip install yt-dlp',
      code: 'YTDLP_MISSING'
    });
  }

  const cleanUrl = normalizeVideoUrl(url);
  const args = [
    ...ytdlp.argsPrefix,
    '--dump-json',
    '--no-playlist',
    '--no-warnings',
    ...getExtraYtdlpArgs(),
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

  child.on('close', async (code) => {
    if (code !== 0) {
      console.error('yt-dlp info error:', stderrData);

      const ytMatch = cleanUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/))([a-zA-Z0-9_-]{11})/);
      if (ytMatch && ytMatch[1]) {
        try {
          const vidId = ytMatch[1];
          const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${vidId}&format=json`, { signal: AbortSignal.timeout(5000) });
          if (oembedRes.ok) {
            const oembed = await oembedRes.json();
            return res.json({
              id: vidId,
              title: oembed.title || 'YouTube Video',
              thumbnail: `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`,
              duration: null,
              uploader: oembed.author_name || 'YouTube',
              platform: 'youtube',
              url: cleanUrl,
              formats: [
                { id: 'best', label: 'أعلى جودة متاحة (MP4)', ext: 'mp4', type: 'video', quality: 'Best Available' },
                { id: '720', label: 'HD 720p (MP4)', ext: 'mp4', type: 'video', quality: '720p' },
                { id: '480', label: 'SD 480p (MP4)', ext: 'mp4', type: 'video', quality: '480p' },
                { id: 'mp3', label: 'صوت فقط (Audio)', ext: 'mp3', type: 'audio', quality: 'Audio Only' }
              ]
            });
          }
        } catch (oembedErr) {
          console.error('oEmbed fallback error:', oembedErr);
        }
      }

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

      const options = [
        { id: 'best', label: 'أعلى جودة متاحة (MP4)', ext: 'mp4', type: 'video', quality: 'Best Available' },
        { id: '1080', label: 'Full HD 1080p (MP4)', ext: 'mp4', type: 'video', quality: '1080p' },
        { id: '720', label: 'HD 720p (MP4)', ext: 'mp4', type: 'video', quality: '720p' },
        { id: '480', label: 'SD 480p (MP4)', ext: 'mp4', type: 'video', quality: '480p' },
        { id: 'mp3', label: 'صوت فقط (Audio)', ext: 'mp3', type: 'audio', quality: 'Audio Only' }
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

  const tempDir = os.tmpdir();
  const fileId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const outTemplate = path.join(tempDir, `vdl_${fileId}.%(ext)s`);

  let formatArg;
  if (ffmpegInstalled) {
    if (quality === '1080') {
      formatArg = 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]/best';
    } else if (quality === '720') {
      formatArg = 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720]/best';
    } else if (quality === '480') {
      formatArg = 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=480]+bestaudio/best[height<=480]/best';
    } else if (quality === 'mp3') {
      formatArg = 'bestaudio/best';
    } else {
      formatArg = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best[ext=mp4]/best';
    }
  } else {
    if (quality === '1080' || quality === '720') {
      formatArg = 'best[height<=1080][vcodec!=none][acodec!=none]/best[ext=mp4][vcodec!=none][acodec!=none]/best[vcodec!=none][acodec!=none]/best';
    } else if (quality === '480') {
      formatArg = 'best[height<=480][vcodec!=none][acodec!=none]/best[height<=480]/best';
    } else if (quality === '360') {
      formatArg = 'best[height<=360][vcodec!=none][acodec!=none]/best[height<=360]/best';
    } else if (quality === 'mp3' || quality === 'm4a') {
      formatArg = 'bestaudio[ext=m4a]/bestaudio/best';
    } else {
      formatArg = 'best[ext=mp4][vcodec!=none][acodec!=none]/best[vcodec!=none][acodec!=none]/best';
    }
  }

  const cleanUrl = normalizeVideoUrl(url);
  const args = [
    ...ytdlp.argsPrefix,
    '--no-playlist',
    '--no-warnings',
    ...getExtraYtdlpArgs(),
    '-f', formatArg,
    '-o', outTemplate,
    cleanUrl
  ];

  const child = spawn(ytdlp.cmd, args);
  let stderrData = '';

  child.stderr.on('data', (data) => {
    stderrData += data.toString();
    console.log(`[yt-dlp download]: ${data.toString().trim()}`);
  });

  child.on('error', (err) => {
    console.error('Spawn error:', err);
    if (!res.headersSent) {
      res.status(500).send('Download failed to start');
    }
  });

  req.on('close', () => {
    if (!child.killed && child.exitCode === null) {
      try { child.kill('SIGINT'); } catch {}
    }
  });

  child.on('close', (code) => {
    if (code !== 0) {
      console.error('yt-dlp exit with code:', code, stderrData);
      if (!res.headersSent) {
        return res.status(500).send(stderrData.split('\n')[0] || 'Download failed');
      }
      return;
    }

    try {
      const allFiles = fs.readdirSync(tempDir);
      const targetFile = allFiles.find(f => f.startsWith(`vdl_${fileId}.`));

      if (!targetFile) {
        if (!res.headersSent) {
          return res.status(500).send('Downloaded file not found on server');
        }
        return;
      }

      const fullPath = path.join(tempDir, targetFile);
      const ext = path.extname(fullPath).replace('.', '') || 'mp4';
      const finalName = `${safeTitle}.${ext}`;

      res.download(fullPath, finalName, (err) => {
        try {
          fs.unlinkSync(fullPath);
        } catch {}
      });
    } catch (fsErr) {
      console.error('Error finding or sending file:', fsErr);
      if (!res.headersSent) {
        res.status(500).send('Error delivering file');
      }
    }
  });
});

const distPath = path.join(path.resolve(), 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`✅ Downloader API Server running on http://localhost:${PORT}`);
});
