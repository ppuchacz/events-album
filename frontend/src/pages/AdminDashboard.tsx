import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  Settings,
  Eye,
  EyeOff,
  Trash2,
  LogOut,
  Save,
  Wifi,
  Calendar,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Film,
  Image as ImageIcon,
  RefreshCw,
  ExternalLink,
  Play,
  Globe,
} from 'lucide-react';
import { api, getAuthToken, resolveMediaUrl, setAuthToken } from '../api';
import { DisplayQuality, EventAdminData, MediaItemData } from '../types';
import { QrCodeCard } from '../components/QrCodeCard';
import { LightboxModal } from '../components/LightboxModal';

const QUALITY_OPTIONS: Array<{
  key: DisplayQuality;
  label: string;
  badge: string;
  description: string;
}> = [
  {
    key: 'high',
    label: 'Wysoka',
    badge: '1080p Full HD • maks. detale',
    description: 'Najlepsza jakość zdjęć i filmów. Zalecana przy stabilnym łączu Wi-Fi lub dobrym zasięgu 5G/LTE.',
  },
  {
    key: 'medium',
    label: 'Średnia',
    badge: '720p HD • zbalansowana',
    description: 'Optymalny kompromis między jakością obrazu a szybkością ładowania na telefonach gości.',
  },
  {
    key: 'low',
    label: 'Niska',
    badge: '480p SD • oszczędność danych',
    description: 'Szybkie wczytywanie galerii w miejscach o słabszym zasięgu sieci komórkowej.',
  },
  {
    key: 'very_low',
    label: 'Bardzo oszczędna',
    badge: '360p • minimalny transfer',
    description: 'Tryb awaryjny na sale weselne poza miastem z bardzo ograniczonym dostępem do internetu.',
  },
];

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventAdminData | null>(null);
  const [media, setMedia] = useState<MediaItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [filter, setFilter] = useState<'all' | 'visible' | 'hidden'>('all');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [slug, setSlug] = useState('');
  const [allowUploads, setAllowUploads] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [activeFrom, setActiveFrom] = useState('');
  const [activeTo, setActiveTo] = useState('');
  const [displayQuality, setDisplayQuality] = useState<DisplayQuality>('high');

  const syncFormFromEvent = (ev: EventAdminData) => {
    setTitle(ev.title);
    setDescription(ev.description || '');
    setSlug(ev.slug);
    setAllowUploads(ev.allowUploads);
    setIsActive(ev.isActive);
    setActiveFrom(toDatetimeLocalValue(ev.activeFrom));
    setActiveTo(toDatetimeLocalValue(ev.activeTo));
    setDisplayQuality(ev.displayQuality);
  };

  const fetchDashboard = useCallback(async (silent = false) => {
    if (!getAuthToken()) {
      navigate('/login');
      return;
    }
    if (!silent) setLoading(true);
    try {
      const res = await api.getAdminEvent();
      setEvent(res.event);
      setMedia(res.media);
      if (!silent) {
        syncFormFromEvent(res.event);
      }
    } catch (err: any) {
      if (err.message?.includes('401') || err.message?.includes('token')) {
        setAuthToken(null);
        navigate('/login');
      } else {
        setFeedback({ type: 'error', text: err.message || 'Nie udało się pobrać danych panelu.' });
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchDashboard(false);
  }, [fetchDashboard]);

  // Poll when any video is pending/processing
  useEffect(() => {
    const hasProcessing = media.some((m) => m.status === 'pending' || m.status === 'processing');
    if (!hasProcessing) return;
    const timer = setInterval(() => fetchDashboard(true), 4000);
    return () => clearInterval(timer);
  }, [media, fetchDashboard]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const res = await api.updateAdminEvent({
        title,
        description: description.trim() || null,
        slug: slug.trim(),
        allowUploads,
        isActive,
        activeFrom: activeFrom ? new Date(activeFrom).toISOString() : null,
        activeTo: activeTo ? new Date(activeTo).toISOString() : null,
        displayQuality,
      });
      setEvent(res.event);
      setMedia(res.media);
      syncFormFromEvent(res.event);
      setFeedback({ type: 'success', text: 'Ustawienia wydarzenia zostały zapisane!' });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Nie udało się zapisać ustawień.' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleMediaVisibility = async (item: MediaItemData) => {
    try {
      const res = await api.toggleMediaVisibility(item.id, !item.isHidden);
      setMedia((prev) => prev.map((m) => (m.id === item.id ? res.mediaItem : m)));
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Nie udało się zmienić widoczności materiału.' });
    }
  };

  const handleDeleteMedia = async (item: MediaItemData) => {
    if (!window.confirm(`Czy na pewno chcesz trwale usunąć plik "${item.originalFilename}"?`)) {
      return;
    }
    try {
      await api.deleteMedia(item.id);
      setMedia((prev) => prev.filter((m) => m.id !== item.id));
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Nie udało się usunąć materiału.' });
    }
  };

  const handleReprocessMedia = async (item: MediaItemData) => {
    try {
      const res = await api.reprocessMedia(item.id);
      setMedia((prev) => prev.map((m) => (m.id === item.id ? res.mediaItem : m)));
      setFeedback({ type: 'success', text: 'Zlecono ponowne przetworzenie pliku.' });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Błąd ponownego przetwarzania.' });
    }
  };

  const handleLogout = () => {
    setAuthToken(null);
    navigate('/login');
  };

  if (loading || !event) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-600">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-3" />
        <p className="text-sm font-medium">Ładowanie panelu administracyjnego...</p>
      </div>
    );
  }

  const filteredMedia = media.filter((item) => {
    if (filter === 'visible') return !item.isHidden;
    if (filter === 'hidden') return Boolean(item.isHidden);
    return true;
  });

  const hiddenCount = media.filter((m) => m.isHidden).length;
  const visibleCount = media.length - hiddenCount;

  return (
    <div className="min-h-screen bg-slate-100 pb-16">
      {/* Top Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-slate-900">EventAlbum</span>
              <span className="ml-2 px-2 py-0.5 text-xs font-semibold rounded-md bg-indigo-50 text-indigo-700">
                Panel Administracyjny
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={`/e/${event.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs sm:text-sm font-semibold transition"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Strona gości (/e/{event.slug})</span>
            </a>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-medium transition"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Wyloguj</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* Live Status Banner */}
        <div
          className={`mb-6 p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
            event.isCurrentlyVisible
              ? 'bg-emerald-50/90 border-emerald-200 text-emerald-900'
              : 'bg-amber-50/90 border-amber-200 text-amber-900'
          }`}
        >
          <div className="flex items-center gap-3">
            <Globe className={`w-5 h-5 shrink-0 ${event.isCurrentlyVisible ? 'text-emerald-600' : 'text-amber-600'}`} />
            <div>
              <p className="text-sm font-semibold">
                Status strony dla gości:{' '}
                {event.isCurrentlyVisible ? 'AKTYWNA (widoczna dla gości)' : 'NIEAKTYWNA (ukryta przed gośćmi)'}
              </p>
              <p className="text-xs opacity-80">
                {event.isCurrentlyVisible
                  ? `Goście mogą przeglądać galerię w jakości "${event.displayQualityLabel}" ${
                      event.allowUploads ? 'oraz przesyłać nowe zdjęcia i filmy.' : '(przesyłanie plików jest wyłączone).'
                    }`
                  : event.visibilityReason}
              </p>
            </div>
          </div>
        </div>

        {feedback && (
          <div
            className={`mb-6 p-4 rounded-2xl border flex items-center justify-between gap-3 text-sm ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              )}
              <span>{feedback.text}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="text-xs font-semibold underline">
              Zamknij
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Settings Form + QR Code */}
          <div className="lg:col-span-1 space-y-6">
            <form
              onSubmit={handleSaveSettings}
              className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5"
            >
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900">Ustawienia wydarzenia</h2>
                  <p className="text-xs text-slate-500">Adres, widoczność, przesyłanie i jakość</p>
                </div>
              </div>

              {/* Nazwa i opis */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Nazwa uroczystości
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Powitanie / opis dla gości
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none text-sm"
                />
              </div>

              {/* Identyfikator / Slug */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Identyfikator strony (slug)
                </label>
                <div className="flex items-center rounded-xl border border-slate-200 focus-within:border-indigo-500 overflow-hidden bg-slate-50">
                  <span className="pl-3 pr-1 text-xs text-slate-400 font-mono select-none">/e/</span>
                  <input
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                    className="w-full px-2 py-2 bg-white outline-none text-sm font-mono"
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Adres pod którym goście wchodzą na stronę albumu.
                </p>
              </div>

              {/* Toggles: Włączenie strony oraz Wrzucanie materiałów przez gości */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/70 cursor-pointer">
                  <div>
                    <div className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                      <Eye className="w-4 h-4 text-indigo-600" />
                      Widoczność strony dla gości
                    </div>
                    <p className="text-xs text-slate-500">Główny przełącznik aktywności albumu</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/70 cursor-pointer">
                  <div>
                    <div className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                      <Upload className="w-4 h-4 text-indigo-600" />
                      Wysyłanie materiałów przez gości
                    </div>
                    <p className="text-xs text-slate-500">Pozwól gościom dodawać zdjęcia i filmy</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowUploads}
                    onChange={(e) => setAllowUploads(e.target.checked)}
                    className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                  />
                </label>
              </div>

              {/* Zakres dat aktywności */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                    Ramy czasowe aktywności (opcjonalnie)
                  </span>
                  {(activeFrom || activeTo) && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveFrom('');
                        setActiveTo('');
                      }}
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      Wyczyść daty
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Aktywna od:</label>
                    <input
                      type="datetime-local"
                      value={activeFrom}
                      onChange={(e) => setActiveFrom(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Aktywna do:</label>
                    <input
                      type="datetime-local"
                      value={activeTo}
                      onChange={(e) => setActiveTo(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Jakość wyświetlanych zdjęć / filmów */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5 text-indigo-600" />
                  Jakość zdjęć i filmów na stronie gości
                </label>
                <div className="space-y-2">
                  {QUALITY_OPTIONS.map((opt) => {
                    const selected = displayQuality === opt.key;
                    return (
                      <label
                        key={opt.key}
                        className={`block p-3 rounded-xl border cursor-pointer transition ${
                          selected
                            ? 'border-indigo-600 bg-indigo-50/70 ring-1 ring-indigo-600'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="displayQuality"
                              value={opt.key}
                              checked={selected}
                              onChange={() => setDisplayQuality(opt.key)}
                              className="accent-indigo-600"
                            />
                            <span className="text-sm font-semibold text-slate-900">{opt.label}</span>
                          </div>
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                            {opt.badge}
                          </span>
                        </div>
                        <p className="mt-1 pl-6 text-xs text-slate-500">{opt.description}</p>
                      </label>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-sm shadow-sm transition"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Zapisywanie...' : 'Zapisz ustawienia'}
              </button>
            </form>

            {/* QR Code Generator Card */}
            <QrCodeCard slug={event.slug} eventTitle={event.title} />
          </div>

          {/* Right Column: Media Management */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Materiały przesłane przez gości ({media.length})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Zarządzaj widocznością zdjęć i filmów. Kliknij miniaturkę, aby powiększyć lub odtworzyć.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setFilter('all')}
                      className={`px-3 py-1.5 rounded-lg transition ${
                        filter === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'
                      }`}
                    >
                      Wszystkie ({media.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilter('visible')}
                      className={`px-3 py-1.5 rounded-lg transition ${
                        filter === 'visible' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'
                      }`}
                    >
                      Widoczne ({visibleCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilter('hidden')}
                      className={`px-3 py-1.5 rounded-lg transition ${
                        filter === 'hidden' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'
                      }`}
                    >
                      Ukryte ({hiddenCount})
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => fetchDashboard(false)}
                    className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600"
                    title="Odśwież listę"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {filteredMedia.length === 0 ? (
                <div className="py-16 text-center text-slate-500">
                  <Camera className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                  <p className="text-sm font-medium">Brak materiałów w wybranym widoku.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {filteredMedia.map((item, idx) => {
                    const thumbUrl = resolveMediaUrl(item.thumbnailUrl || item.displayUrl);
                    return (
                      <div
                        key={item.id}
                        className={`rounded-2xl border overflow-hidden flex flex-col transition ${
                          item.isHidden
                            ? 'bg-slate-50 border-amber-300 opacity-75'
                            : 'bg-white border-slate-200 hover:shadow-md'
                        }`}
                      >
                        {/* Thumbnail clickable for Lightbox */}
                        <div
                          onClick={() => setLightboxIndex(idx)}
                          className="relative aspect-video bg-slate-900 cursor-pointer overflow-hidden group"
                        >
                          {thumbUrl ? (
                            <img
                              src={thumbUrl}
                              alt={item.originalFilename}
                              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-500">
                              <Film className="w-8 h-8" />
                            </div>
                          )}

                          {/* Type & Status Badges */}
                          <div className="absolute top-2 left-2 flex flex-wrap gap-1.5">
                            <span className="px-2 py-0.5 rounded-md bg-black/70 text-white text-[11px] font-medium inline-flex items-center gap-1">
                              {item.type === 'video' ? (
                                <>
                                  <Film className="w-3 h-3 text-indigo-400" /> Wideo
                                </>
                              ) : (
                                <>
                                  <ImageIcon className="w-3 h-3 text-emerald-400" /> Zdjęcie
                                </>
                              )}
                            </span>

                            {item.status !== 'ready' && (
                              <span
                                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold inline-flex items-center gap-1 ${
                                  item.status === 'failed'
                                    ? 'bg-rose-600 text-white'
                                    : 'bg-indigo-600 text-white'
                                }`}
                              >
                                {item.status !== 'failed' && <Loader2 className="w-3 h-3 animate-spin" />}
                                {item.status === 'pending' && 'W kolejce RabbitMQ'}
                                {item.status === 'processing' && 'Konwersja FFmpeg'}
                                {item.status === 'failed' && 'Błąd konwersji'}
                              </span>
                            )}
                          </div>

                          {item.isHidden && (
                            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-amber-500 text-white text-[11px] font-bold">
                              Ukryty
                            </div>
                          )}

                          {item.type === 'video' && item.status === 'ready' && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/35 transition">
                              <div className="w-10 h-10 rounded-full bg-white/90 text-indigo-900 flex items-center justify-center shadow">
                                <Play className="w-4 h-4 fill-current ml-0.5" />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Metadata & Actions */}
                        <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold text-slate-800 truncate" title={item.originalFilename}>
                              {item.caption || item.originalFilename}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Autor: <span className="font-medium">{item.authorName || 'Gość'}</span>
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {new Date(item.createdAt).toLocaleString('pl-PL')}
                            </p>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => handleToggleMediaVisibility(item)}
                              className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-semibold transition ${
                                item.isHidden
                                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                                  : 'bg-amber-50 hover:bg-amber-100 text-amber-700'
                              }`}
                            >
                              {item.isHidden ? (
                                <>
                                  <Eye className="w-3.5 h-3.5" />
                                  Pokaż na stronie
                                </>
                              ) : (
                                <>
                                  <EyeOff className="w-3.5 h-3.5" />
                                  Ukryj materiał
                                </>
                              )}
                            </button>

                            {item.status === 'failed' && (
                              <button
                                type="button"
                                onClick={() => handleReprocessMedia(item)}
                                className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600"
                                title="Ponów konwersję"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDeleteMedia(item)}
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition"
                              title="Usuń trwale"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox Modal for Admin */}
      {lightboxIndex !== null && (
        <LightboxModal
          items={filteredMedia}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onSelectIndex={(idx) => setLightboxIndex(idx)}
          qualityLabel={event.displayQualityLabel}
        />
      )}
    </div>
  );
};
