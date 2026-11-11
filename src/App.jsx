import React, { useState, useEffect } from 'react';
import { DownloadCloud, Clipboard, X, Loader2, AlertCircle, Sun, Moon } from 'lucide-react';
import VideoCard from './components/VideoCard';

export default function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [videoData, setVideoData] = useState(null);

  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('theme') || 'dark';
    } catch {
      return 'dark';
    }
  });

  const isDark = theme === 'dark';

  useEffect(() => {
    try {
      localStorage.setItem('theme', theme);
    } catch {}

    if (isDark) {
      document.documentElement.classList.add('dark');
      document.body.style.backgroundColor = '#0b0f19';
      document.body.style.color = '#ffffff';
    } else {
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '#f8fafc';
      document.body.style.color = '#0f172a';
    }
  }, [theme, isDark]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
        setError(null);
      }
    } catch {
    }
  };

  const handleClear = () => {
    setUrl('');
    setError(null);
    setVideoData(null);
  };

  const handleFetch = async (e) => {
    if (e) e.preventDefault();
    const cleanUrl = url.trim();
    if (!cleanUrl) return;

    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      setError('يرجى إدخال رابط يبدأ بـ https:// أو http://');
      return;
    }

    setLoading(true);
    setError(null);
    setVideoData(null);

    try {
      const apiBase = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/$/, '') : '';
      const res = await fetch(`${apiBase}/api/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cleanUrl }),
        signal: AbortSignal.timeout(60000)
      });

      if (res.ok) {
        const data = await res.json();
        setVideoData(data);
        setLoading(false);
        return;
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'تعذر جلب تفاصيل هذا الفيديو.');
      }
    } catch (err) {
      if (err.name === 'AbortError' || err.message?.includes('timed out') || err.message?.includes('timeout')) {
        setError('استغرق فحص الرابط وقتاً أطول من المتوقع، يرجى المحاولة مرة أخرى.');
      } else {
        setError(err.message || 'تعذر الاتصال بالخادم.');
      }
      setLoading(false);
    }
  };

  return (
    <div
      dir="rtl"
      className={`h-screen h-[100dvh] w-full overflow-hidden flex flex-col justify-between p-3 sm:p-5 transition-colors duration-200 select-none ${
        isDark ? 'bg-[#0b0f19] text-white' : 'bg-[#f8fafc] text-slate-900'
      }`}
    >
      <header className="w-full max-w-lg mx-auto flex justify-between items-center py-1 flex-shrink-0">
        <span className={`text-xs font-bold ${
          isDark ? 'text-slate-400' : 'text-slate-500'
        }`}>
          منزّل الفيديوهات
        </span>

        <button
          onClick={toggleTheme}
          type="button"
          aria-label={isDark ? 'التحويل للوضع الفاتح' : 'التحويل للوضع الليلي'}
          title={isDark ? 'التحويل للوضع الفاتح' : 'التحويل للوضع الليلي'}
          className={`p-2 rounded-full border shadow-sm transition-all duration-200 active:scale-90 flex items-center justify-center ${
            isDark
              ? 'bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-800'
              : 'bg-white border-slate-200 text-indigo-600 hover:bg-slate-100'
          }`}
        >
          {isDark ? (
            <Sun className="w-4 h-4 transition-transform duration-300 hover:rotate-90" />
          ) : (
            <Moon className="w-4 h-4 transition-transform duration-300 hover:-rotate-12" />
          )}
        </button>
      </header>

      <main className="w-full max-w-lg mx-auto my-auto flex-1 flex flex-col justify-center items-center text-center space-y-2 sm:space-y-3 min-h-0">
        
        <div className="space-y-0.5">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            تحميل أي فيديو
          </h1>
          <p className={`text-[11px] sm:text-xs ${
            isDark ? 'text-slate-400' : 'text-slate-600'
          }`}>
            ضع رابط الفيديو من يوتيوب، تويتر، سناب شات، تيك توك أو أي منصة
          </p>
        </div>

        <form onSubmit={handleFetch} className="w-full">
          <div className={`flex items-center border rounded-2xl p-1 shadow-md gap-1 transition-all ${
            isDark
              ? 'bg-slate-900 border-slate-700 focus-within:border-indigo-500'
              : 'bg-white border-slate-300 focus-within:border-indigo-500 shadow-slate-200'
          }`}>
            
            <input
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (error) setError(null);
              }}
              placeholder="ضع رابط الفيديو هنا..."
              dir="ltr"
              className={`w-full bg-transparent px-2.5 py-1.5 text-xs sm:text-sm focus:outline-none text-right ${
                isDark 
                  ? 'text-white placeholder-slate-500' 
                  : 'text-slate-900 placeholder-slate-400'
              }`}
            />

            {url && (
              <button
                type="button"
                onClick={handleClear}
                className={`p-1 rounded-lg transition ${
                  isDark ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'
                }`}
                title="مسح"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={handlePaste}
              className={`flex items-center gap-1 text-[11px] px-2 py-1.5 rounded-xl border transition flex-shrink-0 ${
                isDark
                  ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900'
              }`}
              title="لصق من الحافظة"
            >
              <Clipboard className="w-3 h-3" />
              <span>لصق</span>
            </button>

            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-1.5 px-3.5 sm:px-4 rounded-xl transition flex-shrink-0 text-xs shadow-sm active:scale-95"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>بحث...</span>
                </>
              ) : (
                <>
                  <DownloadCloud className="w-3.5 h-3.5" />
                  <span>تنزيل</span>
                </>
              )}
            </button>
          </div>
        </form>

        {error && (
          <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-[11px] sm:text-xs flex items-center justify-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {videoData && (
          <div className="w-full animate-fadeIn">
            <VideoCard video={videoData} isDark={isDark} />
          </div>
        )}

      </main>

      <footer className={`w-full text-center py-1 text-[10px] flex-shrink-0 ${
        isDark ? 'text-slate-600' : 'text-slate-400'
      }`}>
        تنزيل الفيديوهات والصوتيات بسهولة وبأي صيغة
      </footer>
    </div>
  );
}
