import React, { useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, User, Calendar, Film, Image as ImageIcon, Loader2 } from 'lucide-react';
import { MediaItemData } from '../types';
import { resolveMediaUrl } from '../api';

interface LightboxModalProps {
  items: MediaItemData[];
  currentIndex: number;
  onClose: () => void;
  onSelectIndex: (index: number) => void;
  qualityLabel?: string;
}

export const LightboxModal: React.FC<LightboxModalProps> = ({
  items,
  currentIndex,
  onClose,
  onSelectIndex,
  qualityLabel,
}) => {
  const item = items[currentIndex];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        onSelectIndex(currentIndex - 1);
      } else if (e.key === 'ArrowRight' && currentIndex < items.length - 1) {
        onSelectIndex(currentIndex + 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, items.length, onClose, onSelectIndex]);

  if (!item) return null;

  const mediaUrl = resolveMediaUrl(item.displayUrl);
  const posterUrl = resolveMediaUrl(item.thumbnailUrl);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Top Bar */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-black/50 border-b border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 text-sm text-slate-300">
          <span className="inline-flex items-center gap-1.5 font-medium text-white">
            {item.type === 'video' ? <Film className="w-4 h-4 text-indigo-400" /> : <ImageIcon className="w-4 h-4 text-emerald-400" />}
            {currentIndex + 1} / {items.length}
          </span>
          {qualityLabel && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/10 text-indigo-200 border border-white/15">
              Jakość: {qualityLabel}
            </span>
          )}
        </div>

        <button
          onClick={onClose}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
          aria-label="Zamknij podgląd"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="relative flex-1 flex items-center justify-center p-4 overflow-hidden">
        {currentIndex > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelectIndex(currentIndex - 1);
            }}
            className="absolute left-4 z-10 p-3 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/15 transition"
            aria-label="Poprzedni"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        <div
          className="max-w-5xl max-h-full flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          {item.type === 'video' ? (
            item.status === 'ready' ? (
              <video
                key={mediaUrl}
                src={mediaUrl}
                poster={posterUrl || undefined}
                controls
                autoPlay
                playsInline
                className="max-h-[78vh] max-w-[90vw] rounded-lg shadow-2xl bg-black"
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-10 bg-slate-900/90 border border-slate-700 rounded-2xl text-center max-w-md">
                <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mb-3" />
                <h4 className="text-lg font-semibold text-white mb-1">
                  {item.status === 'failed' ? 'Błąd konwersji wideo' : 'Trwa przetwarzanie filmu...'}
                </h4>
                <p className="text-sm text-slate-400">
                  {item.status === 'failed'
                    ? item.errorMessage || 'Nie udało się przekonwertować pliku wideo.'
                    : 'Film znajduje się w kolejce konwersji FFmpeg. Za chwilę będzie gotowy do odtworzenia.'}
                </p>
              </div>
            )
          ) : (
            <img
              src={mediaUrl}
              alt={item.caption || item.originalFilename}
              className="max-h-[78vh] max-w-[90vw] object-contain rounded-lg shadow-2xl select-none"
            />
          )}
        </div>

        {currentIndex < items.length - 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelectIndex(currentIndex + 1);
            }}
            className="absolute right-4 z-10 p-3 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/15 transition"
            aria-label="Następny"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Footer Info */}
      <div
        className="px-6 py-4 bg-black/60 border-t border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          {item.caption && <p className="text-base text-white font-medium mb-1">{item.caption}</p>}
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-slate-400" />
              {item.authorName || 'Gość weselny / imprezowy'}
            </span>
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {new Date(item.createdAt).toLocaleString('pl-PL')}
            </span>
            {item.width && item.height && (
              <span>
                {item.width} × {item.height} px
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
