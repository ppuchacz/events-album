import React, { useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { QrCode, Download, Copy, Check, ExternalLink } from 'lucide-react';

interface QrCodeCardProps {
  slug: string;
  eventTitle: string;
}

export const QrCodeCard: React.FC<QrCodeCardProps> = ({ slug, eventTitle }) => {
  const [copied, setCopied] = useState(false);
  const qrWrapperRef = useRef<HTMLDivElement>(null);

  const guestUrl = `${window.location.origin}/e/${slug}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(guestUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback copy
    }
  };

  const handleDownloadPng = () => {
    const canvas = qrWrapperRef.current?.querySelector('canvas');
    if (!canvas) return;

    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `kod-qr-${slug}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
          <QrCode className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">Kod QR dla gości</h3>
          <p className="text-xs text-slate-500">Wydrukuj i postaw na stołach, aby goście łatwo dodawali zdjęcia</p>
        </div>
      </div>

      <div
        ref={qrWrapperRef}
        className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-xl border border-slate-200/80 mb-4"
      >
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
          <QRCodeCanvas
            value={guestUrl}
            size={200}
            level="H"
            includeMargin={true}
          />
        </div>
        <p className="mt-3 font-semibold text-slate-800 text-sm text-center">{eventTitle}</p>
        <p className="mt-1 text-xs text-indigo-600 font-mono break-all text-center">{guestUrl}</p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleDownloadPng}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition shadow-sm"
          >
            <Download className="w-4 h-4" />
            Pobierz kod QR (PNG)
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition"
            title="Kopiuj link"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Skopiowano' : 'Kopiuj link'}
          </button>
        </div>

        <a
          href={`/e/${slug}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium transition"
        >
          <ExternalLink className="w-4 h-4" />
          Otwórz stronę dla gości w nowej karcie
        </a>
      </div>
    </div>
  );
};
