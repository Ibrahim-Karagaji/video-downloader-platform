export async function downloadVideo({ url, quality = 'best', title = 'video', onProgress }) {
  const cleanUrl = url.trim();
  const apiBase = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/$/, '') : '';

  const startRes = await fetch(`${apiBase}/api/download/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: cleanUrl, quality, title })
  });

  if (!startRes.ok) {
    const err = await startRes.json().catch(() => ({}));
    throw new Error(err.error || 'تعذر بدء عملية التحميل من الخادم.');
  }

  const { jobId } = await startRes.json();

  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const progRes = await fetch(`${apiBase}/api/download/progress/${jobId}`);
        if (!progRes.ok) return;

        const data = await progRes.json();
        if (onProgress) {
          onProgress(data);
        }

        if (data.status === 'ready') {
          clearInterval(interval);
          const downloadUrl = `${apiBase}/api/download/file/${jobId}`;
          
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.setAttribute('download', '');
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);

          resolve({ success: true });
        } else if (data.status === 'error') {
          clearInterval(interval);
          reject(new Error(data.error || 'فشلت معالجة الفيديو'));
        }
      } catch (err) {
        clearInterval(interval);
        reject(err);
      }
    }, 600);
  });
}
