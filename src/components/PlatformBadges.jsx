import React from 'react';
import { 
  Youtube, 
  Twitter, 
  Instagram, 
  Video, 
  Share2, 
  PlaySquare, 
  Music2, 
  Globe 
} from 'lucide-react';

export const platforms = [
  { name: 'YouTube', icon: Youtube, color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/20' },
  { name: 'X / Twitter', icon: Twitter, color: 'text-sky-400', bg: 'bg-sky-400/10 border-sky-400/20' },
  { name: 'Snapchat', icon: Video, color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/20' },
  { name: 'TikTok', icon: Music2, color: 'text-pink-400', bg: 'bg-pink-400/10 border-pink-400/20' },
  { name: 'Instagram', icon: Instagram, color: 'text-fuchsia-400', bg: 'bg-fuchsia-400/10 border-fuchsia-400/20' },
  { name: 'Facebook', icon: Share2, color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/20' },
  { name: 'Vimeo & Others', icon: Globe, color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20' }
];

export default function PlatformBadges() {
  return (
    <div className="w-full max-w-3xl mx-auto mt-6">
      <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold text-center mb-3">
        Supported Platforms & Services • المنصات المدعومة
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {platforms.map((p) => {
          const Icon = p.icon;
          return (
            <div
              key={p.name}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium backdrop-blur-sm transition-all duration-200 hover:scale-105 ${p.bg}`}
            >
              <Icon className={`w-3.5 h-3.5 ${p.color}`} />
              <span className="text-slate-300">{p.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

