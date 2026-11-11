const PUBLIC_APIS = [
  'https://cobalt-api.kwiatekm.pl',
  'https://api.cobalt.tools',
  'https://capi.wuk.sh'
];

export async function downloadVideo({ url, quality = 'best', isAudio = false }) {
  const cleanUrl = url.trim();

  try {
    const healthCheck = await fetch('/api/health', { signal: AbortSignal.timeout(1200) });
    if (healthCheck.ok) {
      const downloadEndpoint = `/api/download?url=${encodeURIComponent(cleanUrl)}&quality=${encodeURIComponent(quality)}`;
      triggerBrowserDownload(downloadEndpoint);
      return { success: true, mode: 'local' };
    }
  } catch {
  }

  let qualityArg = '720';
  if (quality === '1080') qualityArg = '1080';
  else if (quality === '480') qualityArg = '480';
  else if (quality === 'best') qualityArg = 'max';

  const payload = {
    url: cleanUrl,
    videoQuality: qualityArg,
    downloadMode: isAudio ? 'audio' : 'auto',
    youtubeVideoCodec: 'h264'
  };

  let lastError = null;

  for (const apiUrl of PUBLIC_APIS) {
    try {
      const response = await fetch(`${apiUrl}/`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000)
      });

      if (!response.ok) continue;

      const data = await response.json();

      if (data.status === 'tunnel' || data.status === 'redirect') {
        triggerBrowserDownload(data.url);
        return { success: true, mode: 'cloud' };
      } else if (data.status === 'picker' && data.picker && data.picker.length > 0) {
        triggerBrowserDownload(data.picker[0].url);
        return { success: true, mode: 'cloud' };
      } else if (data.text) {
        throw new Error(data.text);
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('تعذر معالجة الرابط، يرجى التأكد من أن الفيديو متاح للعامة.');
}

function triggerBrowserDownload(url) {
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('target', '_blank');
  link.setAttribute('rel', 'noopener noreferrer');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
