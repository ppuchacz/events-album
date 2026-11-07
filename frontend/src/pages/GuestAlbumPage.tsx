import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Camera,
  Upload,
  Play,
  Film,
  Image as ImageIcon,
  CalendarOff,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Wifi,
  RefreshCw,
  User,
  Plus,
  X,
} from 'lucide-react';
import { api, resolveMediaUrl } from '../api';
import { GuestEventResponse, MediaItemData } from '../types';
import { LightboxModal } from '../components/LightboxModal';

export const GuestAlbumPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<GuestEventResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFoundError, setNotFoundError] = useState<string | null>(null);

  // Upload state
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [authorName, setAuthorName] = useState('');
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lightbox state
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const fetchAlbum = useCallback(async (silent = false) => {
    if (!slug) return;
    if (!silent) setLoading(true);
    try {
      const response = await api.getPublicEvent(slug);
      setData(response);
      setNotFoundError(null);
    } catch (err: any) {
      setNotFoundError(err.message || 'Nie udało się załadować albumu wydarzenia.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchAlbum(false);
  }, [fetchAlbum]);

  // Poll every 4 seconds if any video is pending or processing in RabbitMQ worker
  useEffect(() => {
    if (!data?.media) return;
    const hasProcessing = data.media.some((m) => m.status === 'pending' || m.status === 'processing');
    if (!hasProcessing) return;

    const timer = setInterval(() => {
      fetchAlbum(true);
    }, 4000);
    return () => clearInterval(timer);
  }, [data?.media, fetchAlbum]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const filesArray = Array.from(e.target.files);
    setSelectedFiles((prev) => [...prev, ...filesArray]);
    setUploadError(null);
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug || selectedFiles.length === 0) return;

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const res = await api.uploadGuestMedia(slug, selectedFiles, authorName, caption);
      const count = res.uploaded.length;
      const hasVideo = res.uploaded.some((i) => i.type === 'video');
      setUploadSuccess(
        hasVideo
          ? `Przesłano ${count} plik(ów)! Filmy zostały przekazane do konwersji i pojawią się po przetworzeniu.`
          : `Pomyślnie dodano ${count} zdjęć do albumu!`
      );
      setSelectedFiles([]);
      setCaption('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchAlbum(true);
    } catch (err: any) {
      setUploadError(err.message || 'Błąd podczas wysyłania plików.');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-600">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-3" />
        <p className="text-sm font-medium">Wczytywanie albumu wydarzenia...</p>
      </div>
    );
  }

  if (notFoundError || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 max-w-md w-full">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Nie znaleziono wydarzenia</h1>
          <p className="text-sm text-slate-600 mb-6">{notFoundError}</p>
          <Link
            to="/login"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition"
          >
            Panel organizatora
          </Link>
        </div>
      </div>
    );
  }

  // When event page is disabled or outside active dates
  if (!data.isAvailable) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-indigo-50/40 p-4 text-center">
        <div className="bg-white rounded-3xl shadow-md border border-slate-200 p-8 max-w-lg w-full">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
            <CalendarOff className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">{data.event.title}</h1>
          <p className="text-base text-slate-600 mb-4">
            {data.reason || 'Strona wydarzenia jest obecnie nieaktywna.'}
          </p>
          {(data.event.activeFrom || data.event.activeTo) && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 space-y-1">
              {data.event.activeFrom && (
                <div>Początek dostępności: {new Date(data.event.activeFrom).toLocaleString('pl-PL')}</div>
              )}
              {data.event.activeTo && (
                <div>Koniec dostępności: {new Date(data.event.activeTo).toLocaleString('pl-PL')}</div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  const { event, media } = data;

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Hero Header */}
      <header className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-10 sm:py-14">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-indigo-200 text-xs font-medium mb-3 border border-white/15">
                <Camera className="w-3.5 h-3.5" />
                <span>Wspólny album zdjęć i filmów</span>
                {event.displayQualityLabel && (
                  <>
                    <span className="opacity-40">•</span>
                    <span className="inline-flex items-center gap-1" title="Jakość dopasowana do łącza na miejscu uroczystości">
                      <Wifi className="w-3 h-3" />
                      Tryb: {event.displayQualityLabel}
                    </span>
                  </>
                )}
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">{event.title}</h1>
              {event.description && (
                <p className="mt-2 text-indigo-100 max-w-2xl text-sm sm:text-base">{event.description}</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {event.allowUploads ? (
                <button
                  type="button"
                  onClick={() => setShowUploadPanel((prev) => !prev)}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white text-indigo-900 hover:bg-indigo-50 font-semibold text-sm shadow-lg transition"
                >
                  <Upload className="w-4 h-4 text-indigo-600" />
                  {showUploadPanel ? 'Ukryj formularz dodawania' : 'Dodaj zdjęcia lub filmy'}
                </button>
              ) : (
                <span className="px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-xs text-indigo-100">
                  Dodawanie nowych materiałów jest obecnie wyłączone
                </span>
              )}

              <button
                type="button"
                onClick={() => fetchAlbum(false)}
                className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white border border-white/15 transition"
                title="Odśwież galerię"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 mt-6">
        {/* Upload Success Banner */}
        {uploadSuccess && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3 text-emerald-800 text-sm">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{uploadSuccess}</span>
            </div>
            <button onClick={() => setUploadSuccess(null)} className="text-emerald-600 hover:text-emerald-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Upload Drawer / Panel */}
        {event.allowUploads && showUploadPanel && (
          <div className="mb-8 bg-white rounded-3xl shadow-md border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Upload className="w-5 h-5 text-indigo-600" />
                Prześlij zdjęcia i filmy z imprezy
              </h2>
              <button
                type="button"
                onClick={() => setShowUploadPanel(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {uploadError && (
              <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={handleFileChange}
                  className="hidden"
                  id="guest-media-upload"
                />
                <label
                  htmlFor="guest-media-upload"
                  className="flex flex-col items-center justify-center border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/40 hover:bg-indigo-50/80 rounded-2xl p-6 cursor-pointer transition text-center"
                >
                  <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-2">
                    <Plus className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-semibold text-slate-800">
                    Kliknij, aby wybrać zdjęcia lub filmy z telefonu / komputera
                  </span>
                  <span className="text-xs text-slate-500 mt-1">
                    Obsługiwane formaty: JPG, PNG, WEBP, GIF, MP4, MOV, WEBM
                  </span>
                </label>
              </div>

              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Wybrane pliki ({selectedFiles.length}):
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedFiles.map((file, idx) => (
                      <div
                        key={`${file.name}-${idx}`}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-medium"
                      >
                        {file.type.startsWith('video/') ? (
                          <Film className="w-3.5 h-3.5 text-indigo-600" />
                        ) : (
                          <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                        )}
                        <span className="max-w-[180px] truncate">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeSelectedFile(idx)}
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Twoje imię / podpis (opcjonalnie)
                  </label>
                  <input
                    type="text"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder="np. Ciocia Kasia i Wujek Tomek"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Krótki opis / życzenia (opcjonalnie)
                  </label>
                  <input
                    type="text"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="np. Pierwszy taniec Młodej Pary!"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={uploading || selectedFiles.length === 0}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold shadow-sm transition"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Wysyłanie plików...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Wyślij do albumu ({selectedFiles.length})
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Gallery Grid */}
        {media.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
              <Camera className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Album jest jeszcze pusty</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
              Bądź pierwszą osobą, która podzieli się zdjęciem lub filmem z tej uroczystości!
            </p>
            {event.allowUploads && !showUploadPanel && (
              <button
                type="button"
                onClick={() => setShowUploadPanel(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition"
              >
                <Upload className="w-4 h-4" />
                Dodaj pierwsze zdjęcie lub film
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
            {media.map((item: MediaItemData, index: number) => {
              const thumbUrl = resolveMediaUrl(item.thumbnailUrl || item.displayUrl);
              return (
                <div
                  key={item.id}
                  onClick={() => setLightboxIndex(index)}
                  className="group relative aspect-square rounded-2xl overflow-hidden bg-slate-200 border border-slate-200/80 shadow-sm cursor-pointer"
                >
                  {thumbUrl ? (
                    <img
                      src={thumbUrl}
                      alt={item.caption || item.originalFilename}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-400">
                      <Film className="w-10 h-10" />
                    </div>
                  )}

                  {/* Video Play Overlay or Processing Badge */}
                  {item.type === 'video' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/35 transition">
                      {item.status === 'ready' ? (
                        <div className="w-12 h-12 rounded-full bg-white/90 text-indigo-900 flex items-center justify-center shadow-lg group-hover:scale-110 transition">
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        </div>
                      ) : (
                        <div className="px-3 py-1.5 rounded-full bg-black/75 text-white text-xs font-medium flex items-center gap-1.5">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                          <span>Konwersja...</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Bottom gradient metadata */}
                  {(item.authorName || item.caption) && (
                    <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white">
                      {item.caption && <p className="text-xs font-medium line-clamp-1">{item.caption}</p>}
                      {item.authorName && (
                        <p className="text-[11px] text-slate-300 flex items-center gap-1 mt-0.5">
                          <User className="w-3 h-3" />
                          <span className="truncate">{item.authorName}</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Lightbox Modal */}
      {lightboxIndex !== null && (
        <LightboxModal
          items={media}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onSelectIndex={(idx) => setLightboxIndex(idx)}
          qualityLabel={event.displayQualityLabel}
        />
      )}
    </div>
  );
};
