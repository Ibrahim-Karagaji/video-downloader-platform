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

function findCookiesSource() {
  const candidates = [
    process.env.COOKIES_FILE,
    '/etc/secrets/cookies.txt',
    path.join(path.resolve(), 'cookies.txt')
  ].filter(Boolean);

  for (const file of candidates) {
    try {
      if (fs.existsSync(file) && fs.statSync(file).size > 0) {
        return { type: 'file', value: file };
      }
    } catch {}
  }

  const raw = process.env.YOUTUBE_COOKIES || process.env.COOKIES;
  if (raw && raw.trim()) {
    return { type: 'env', value: raw.trim() };
  }

  return null;
}

function prepareYtdlpArgs() {
  const args = [
    '--js-runtimes', 'node',
    '--socket-timeout', '20'
  ];
  let tempCookies = null;

  const source = findCookiesSource();
  if (source) {
    tempCookies = path.join(os.tmpdir(), `cookies_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.txt`);
    try {
      if (source.type === 'file') {
        fs.copyFileSync(source.value, tempCookies);
      } else {
        fs.writeFileSync(tempCookies, source.value + '\n');
      }
      args.push('--cookies', tempCookies);
    } catch (err) {
      console.error('Failed to prepare cookies file:', err.message);
      tempCookies = null;
    }
  }

  const cleanup = () => {
    if (tempCookies) {
      try { fs.unlinkSync(tempCookies); } catch {}
    }
  };

  return { args, cleanup };
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

    const trackingParams = ['si', 'utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'igsh'];
    trackingParams.forEach(p => parsed.searchParams.delete(p));
    return parsed.toString();
  } catch {
    return clean;
  }
}

app.get('/api/health', (req, res) => {
  const ytdlp = getWorkingYtdlpCmd();
  res.json({
    status: 'ok',
    ytdlpAvailable: !!ytdlp,
    ffmpegAvailable: hasFfmpeg(),
    cookiesLoaded: !!findCookiesSource()
  });
});

function formatArabicError(raw) {
  if (!raw || typeof raw !== 'string') {
    return 'حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى.';
  }

  const lower = raw.toLowerCase();

  if (lower.includes('truncated') || lower.includes('incomplete youtube id') || lower.includes('invalid url')) {
    return 'رابط الفيديو غير مكتمل أو ناقص، يرجى التأكد من نسخ الرابط بالكامل.';
  }
  if (lower.includes('private video') || lower.includes('this video is private')) {
    return 'هذا الفيديو خاص ولا يمكن تنزيله.';
  }
  if (lower.includes('confirm your age') || lower.includes('age-restricted') || lower.includes('inappropriate for some users')) {
    return 'هذا الفيديو مقيد بالفئات العمرية ويتطلب تسجيل الدخول.';
  }
  if (lower.includes('sign in') || lower.includes('not a bot') || lower.includes('login required')) {
    return 'تتطلب المنصة تسجيل الدخول لتنزيل هذا الفيديو.';
  }
  if (lower.includes('members-only') || lower.includes('premium')) {
    return 'هذا الفيديو مخصص للمشتركين فقط.';
  }
  if (lower.includes('copyright') || lower.includes('not available in your country') || lower.includes('geo')) {
    return 'هذا الفيديو محظور بسبب حقوق النشر أو القيود الجغرافية.';
  }
  if (lower.includes('video unavailable') || lower.includes('does not exist') || lower.includes('http error 404')) {
    return 'الفيديو غير متاح أو تم حذفه من المنصة.';
  }
  if (lower.includes('timed out') || lower.includes('timeout')) {
    return 'استغرق الاتصال بالخادم وقتاً أطول من المتوقع، يرجى المحاولة مرة أخرى.';
  }
  if (lower.includes('unsupported url') || lower.includes('no video formats') || lower.includes('requested format is not available')) {
    return 'عذراً، لم يتم العثور على وسائط قابلة للتحميل في هذا الرابط.';
  }

  return 'تعذر معالجة هذا الرابط، يرجى التأكد من صحة الرابط وأن الفيديو متاح للعامة.';
}

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
  if (lowerUrl.includes('facebook.com') || lowerUrl.includes('fb.watch') || lowerExt.includes('facebook')) return 'facebook';
  if (lowerUrl.includes('reddit.com') || lowerUrl.includes('redd.it') || lowerExt.includes('reddit')) return 'reddit';
  if (lowerUrl.includes('pinterest.com') || lowerUrl.includes('pin.it') || lowerExt.includes('pinterest')) return 'pinterest';
  if (lowerUrl.includes('vimeo.com') || lowerExt.includes('vimeo')) return 'vimeo';
  return 'generic';
}

app.post('/api/info', async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string' || !url.trim().startsWith('http')) {
    return res.status(400).json({ error: 'يرجى إدخال رابط فيديو يبدأ بـ http:// أو https://' });
  }

  const cleanUrl = normalizeVideoUrl(url);

  const ytMatch = cleanUrl.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/);
  if (ytMatch) {
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
          url: cleanUrl
        });
      }
    } catch {}
  }

  const ytdlp = getWorkingYtdlpCmd();
  if (!ytdlp) {
    return res.status(500).json({ error: 'محرك التحميل غير متوفر حالياً على الخادم' });
  }

  const { args: extraArgs, cleanup } = prepareYtdlpArgs();
  const args = [
    ...ytdlp.argsPrefix,
    '--dump-json',
    '--no-playlist',
    '--no-warnings',
    ...extraArgs,
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

  child.on('error', (err) => {
    cleanup();
    console.error('yt-dlp spawn error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'تعذر تشغيل محرك التحميل على الخادم.' });
    }
  });

  child.on('close', (code) => {
    cleanup();
    if (res.headersSent) return;

    if (code !== 0) {
      console.error('yt-dlp info error:', stderrData);
      return res.status(500).json({ error: formatArabicError(stderrData) });
    }

    try {
      const data = JSON.parse(stdoutData.trim());
      res.json({
        id: data.id,
        title: data.title || 'فيديو بدون عنوان',
        thumbnail: data.thumbnail || (data.thumbnails && data.thumbnails[data.thumbnails.length - 1]?.url) || null,
        duration: formatDuration(data.duration),
        uploader: data.uploader || data.channel || data.creator || null,
        platform: detectPlatform(cleanUrl, data.extractor),
        url: cleanUrl
      });
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr);
      res.status(500).json({ error: 'تعذر قراءة بيانات الفيديو.' });
    }
  });
});

function buildFormatArgs(quality, ffmpegInstalled) {
  if (quality === 'mp3') {
    return ffmpegInstalled
      ? ['-f', 'bestaudio/best', '-x', '--audio-format', 'mp3']
      : ['-f', 'bestaudio[ext=m4a]/bestaudio/best'];
  }

  if (ffmpegInstalled) {
    const height = ['1080', '720', '480'].includes(quality) ? quality : null;
    const selector = height
      ? `bestvideo[height<=${height}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=${height}]+bestaudio/best[height<=${height}]/best`
      : 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best';
    return ['-f', selector, '--merge-output-format', 'mp4'];
  }

  const height = ['1080', '720', '480'].includes(quality) ? quality : null;
  const selector = height
    ? `best[height<=${height}][vcodec!=none][acodec!=none]/best[vcodec!=none][acodec!=none]/best`
    : 'best[vcodec!=none][acodec!=none]/best';
  return ['-f', selector];
}

const activeJobs = new Map();

app.post('/api/download/start', (req, res) => {
  const { url, quality = 'best', title = 'video' } = req.body;

  if (!url || typeof url !== 'string' || !url.trim().startsWith('http')) {
    return res.status(400).json({ error: 'يرجى إدخال رابط فيديو صالح' });
  }

  const ytdlp = getWorkingYtdlpCmd();
  if (!ytdlp) {
    return res.status(500).json({ error: 'محرك التحميل غير متوفر على الخادم' });
  }

  const cleanUrl = normalizeVideoUrl(url);
  const safeTitle = sanitizeFilename(title);

  const tempDir = os.tmpdir();
  const jobId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const outTemplate = path.join(tempDir, `vdl_${jobId}.%(ext)s`);

  const { args: extraArgs, cleanup } = prepareYtdlpArgs();
  const args = [
    ...ytdlp.argsPrefix,
    '--no-playlist',
    '--newline',
    '--progress',
    ...extraArgs,
    ...buildFormatArgs(quality, hasFfmpeg()),
    '-o', outTemplate,
    cleanUrl
  ];

  const job = {
    id: jobId,
    status: 'downloading',
    percent: 0,
    speed: '',
    eta: '',
    error: null,
    filePath: null,
    filename: null
  };
  activeJobs.set(jobId, job);

  const child = spawn(ytdlp.cmd, args);
  let stderrData = '';

  const parseProgress = (chunk) => {
    const lines = chunk.toString().split(/[\r\n]+/);
    for (const line of lines) {
      const match = line.match(/\[download\]\s+(\d+(?:\.\d+)?)%(?:\s+of\s+~?\s*([^\s]+))?(?:\s+at\s+([^\s]+))?(?:\s+ETA\s+([^\s]+))?/);
      if (match) {
        job.percent = Math.min(Math.round(parseFloat(match[1])), 99);
        if (match[3]) job.speed = match[3];
        if (match[4]) job.eta = match[4];
      }
    }
  };

  child.stdout.on('data', parseProgress);
  child.stderr.on('data', (d) => {
    stderrData += d.toString();
    parseProgress(d);
  });

  child.on('error', (err) => {
    cleanup();
    console.error('yt-dlp spawn error:', err);
    job.status = 'error';
    job.error = 'تعذر تشغيل محرك التحميل على الخادم.';
  });

  child.on('close', (code) => {
    cleanup();

    if (code !== 0) {
      console.error('yt-dlp download error:', stderrData);
      job.status = 'error';
      job.error = formatArabicError(stderrData);
      return;
    }

    try {
      const targetFile = fs.readdirSync(tempDir).find(f => f.startsWith(`vdl_${jobId}.`) && !f.endsWith('.part'));

      if (!targetFile) {
        job.status = 'error';
        job.error = 'تعذر العثور على الملف الذي تم تنزيله، يرجى المحاولة مرة أخرى.';
        return;
      }

      const fullPath = path.join(tempDir, targetFile);
      const ext = path.extname(fullPath).replace('.', '') || 'mp4';
      job.filePath = fullPath;
      job.filename = `${safeTitle}.${ext}`;
      job.percent = 100;
      job.status = 'ready';
    } catch (e) {
      console.error('File lookup error:', e);
      job.status = 'error';
      job.error = 'حدث خطأ أثناء معالجة وحفظ الملف.';
    }
  });

  setTimeout(() => {
    if (job.filePath) {
      try { fs.unlinkSync(job.filePath); } catch {}
    }
    activeJobs.delete(jobId);
  }, 10 * 60 * 1000);

  res.json({ jobId });
});

app.get('/api/download/progress/:jobId', (req, res) => {
  const job = activeJobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'عملية التحميل غير موجودة أو انتهت صلاحيتها.' });
  }
  res.json({
    status: job.status,
    percent: job.percent,
    speed: job.speed,
    eta: job.eta,
    error: job.error
  });
});

app.get('/api/download/file/:jobId', (req, res) => {
  const job = activeJobs.get(req.params.jobId);
  if (!job || job.status !== 'ready' || !job.filePath) {
    return res.status(404).send('الملف غير موجود أو لم يجهز بعد.');
  }

  res.download(job.filePath, job.filename, () => {
    try {
      if (fs.existsSync(job.filePath)) {
        fs.unlinkSync(job.filePath);
      }
    } catch {}
    activeJobs.delete(req.params.jobId);
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
  console.log(`🍪 Cookies loaded: ${findCookiesSource() ? 'yes' : 'no'}`);
});
