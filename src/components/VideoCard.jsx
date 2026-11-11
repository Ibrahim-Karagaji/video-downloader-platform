import React, { useState } from 'react';
import { Download, Film, Music, CheckCircle2, AlertCircle } from 'lucide-react';
import { downloadVideo } from '../services/downloader';

const formatOptions = [
  { id: 'best', label: 'فيديو (أعلى جودة)', ext: 'MP4', isAudio: false },
  { id: '1080', label: 'فيديو 1080p', ext: 'MP4', isAudio: false },
  { id: '720', label: 'فيديو 720p', ext: 'MP4', isAudio: false },
  { id: '480', label: 'فيديو 480p', ext: 'MP4', isAudio: false },
  { id: 'mp3', label: 'صوت فقط (MP3)', ext: 'MP3', isAudio: true }
];

export default function VideoCard({ video, isDark = true }) {
  const [selectedFormat, setSelectedFormat] = useState('best');
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(null);

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadError(null);

    const isAudio = selectedFormat === 'mp3';

    try {
      await downloadVideo({
        url: video.url,
        quality: selectedFormat,
        isAudio
      });
    } catch (err) {
      setDownloadError(err.message || 'حدث خطأ أثناء محاولة التنزيل.');
    } finally {
      setTimeout(() => {
        setDownloading(false);
      }, 3500);
    }
  };

  return (
    <div
      dir="rtl"
      className={`w-full max-w-lg mx-auto mt-2 sm:mt-3 rounded-2xl p-3 sm:p-4 shadow-md border transition-all duration-200 text-right ${
        isDark 
          ? 'bg-slate-900 border-slate-800 text-white shadow-black/40' 
          : 'bg-white border-slate-200 text-slate-900 shadow-slate-200'
      }`}
    >
      <div className="flex gap-3 items-center">
        {video.thumbnail && (
          <img
            src={video.thumbnail}
            alt=""
            className={`w-20 sm:w-28 aspect-video rounded-lg object-cover flex-shrink-0 border ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
            }`}
          />
        )}
        <div className="min-w-0 flex-1">
          <h3 className={`font-bold text-xs sm:text-sm line-clamp-2 leading-snug ${
            isDark ? 'text-white' : 'text-slate-900'
          }`}>
            {video.title}
          </h3>
          {video.duration && (
            <span className={`text-[10px] sm:text-xs mt-0.5 inline-block ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}>
              المدة: {video.duration}
            </span>
          )}
        </div>
      </div>

      <div className="mt-3">
        <label className={`block text-[11px] sm:text-xs font-semibold mb-1.5 ${
          isDark ? 'text-slate-300' : 'text-slate-700'
        }`}>
          اختر الصيغة والجودة:
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {formatOptions.map((fmt) => {
            const isSelected = selectedFormat === fmt.id;
            return (
              <button
                key={fmt.id}
                type="button"
                onClick={() => setSelectedFormat(fmt.id)}
                className={`flex items-center justify-between py-1.5 px-2.5 rounded-xl border text-[11px] sm:text-xs transition-all ${
                  isSelected
                    ? 'bg-indigo-600 border-indigo-600 text-white font-bold shadow-sm'
                    : isDark
                      ? 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  {fmt.isAudio ? (
                    <Music className="w-3 h-3 flex-shrink-0" />
                  ) : (
                    <Film className="w-3 h-3 flex-shrink-0" />
                  )}
                  <span className="truncate">{fmt.label}</span>
                </div>
                <span className={`text-[9px] uppercase font-mono px-1 rounded ml-1 ${
                  isSelected 
                    ? 'bg-indigo-700 text-white' 
                    : isDark
                      ? 'bg-slate-900 text-slate-400' 
                      : 'bg-slate-200 text-slate-600'
                }`}>
                  {fmt.ext}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {downloadError && (
        <div className="mt-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] sm:text-xs flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{downloadError}</span>
        </div>
      )}

      <button
        onClick={handleDownload}
        disabled={downloading}
        className={`w-full mt-3 flex items-center justify-center gap-2 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-md active:scale-[0.99] ${
          downloading
            ? 'bg-emerald-600 text-white cursor-wait'
            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
        }`}
      >
        {downloading ? (
          <>
            <CheckCircle2 className="w-3.5 h-3.5 animate-spin" />
            <span>جاري التحميل...</span>
          </>
        ) : (
          <>
            <Download className="w-3.5 h-3.5" />
            <span>تحميل الفيديو</span>
          </>
        )}
      </button>
    </div>
  );
}
