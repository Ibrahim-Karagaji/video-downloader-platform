export async function downloadVideo({ url, quality = 'best', title = 'video' }) {
  const cleanUrl = url.trim();
  const apiBase = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/$/, '') : '';

  let isAlive = false;
  try {
    const healthCheck = await fetch(`${apiBase}/api/health`, { signal: AbortSignal.timeout(3000) });
    if (healthCheck.ok) {
      isAlive = true;
    }
  } catch (err) {
    isAlive = false;
  }

  if (!isAlive) {
    throw new Error('الخادم غير متصل حالياً. يرجى التأكد من تشغيل الخادم.');
  }

  const endpoint = `${apiBase}/api/download?url=${encodeURIComponent(cleanUrl)}&quality=${encodeURIComponent(quality)}&title=${encodeURIComponent(title || 'video')}`;

  let iframe = document.getElementById('downloader-frame');
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'downloader-frame';
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
  }
  iframe.src = endpoint;

  return { success: true };
}
