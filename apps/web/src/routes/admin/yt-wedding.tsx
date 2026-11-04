import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, Video, Trash2, Upload, Eye, EyeOff, Save, ShieldCheck, X } from 'lucide-react';

export interface YtSettingsState {
  heroCaption: string;
  communityIntro: string;
  eventIntro: string;
  galleryIntro: string;
  giftIntro: string;
  musicLabel: string;
  shippingAddress: string;
  heroVideoAssetId: string | null;
  heroVideoUrl: string | null;
  showGallery: boolean;
  showGift: boolean;
}

export interface YtWeddingSettingsPanelProps {
  settings: YtSettingsState;
  onChange: (changes: Partial<YtSettingsState>) => void;
  onSave: () => Promise<void>;
  saving: boolean;
  uploading: boolean;
  onUploadHeroVideo: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  onRemoveHeroVideo: () => Promise<void>;
}

export const YtWeddingSettingsPanel: React.FC<YtWeddingSettingsPanelProps> = ({
  settings,
  onChange,
  onSave,
  saving,
  uploading,
  onUploadHeroVideo,
  onRemoveHeroVideo,
}) => {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-red-200 bg-red-50/50 p-4">
        <h2 className="text-sm font-semibold text-red-950 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-red-700" />
          Pengaturan Khusus Tema YouTube Wedding
        </h2>
        <p className="mt-1 text-xs text-stone-600 leading-relaxed">
          Semua konfigurasi teks, intro bagian, visibilitas section, dan video hero untuk tema YouTube.
        </p>
      </div>

      {/* Hero Video Upload */}
      <article className="space-y-3 rounded-xl border border-stone-200 p-4">
        <div className="flex items-center justify-between border-b border-stone-100 pb-2">
          <div>
            <h3 className="font-semibold text-stone-800 text-sm flex items-center gap-1.5">
              <Video className="w-4 h-4 text-stone-700" />
              Hero Video (Opsional, MP4)
            </h3>
            <p className="text-xs text-stone-500">Video latar/hero pengganti gambar cover YouTube (maks 20 MiB)</p>
          </div>
        </div>

        {settings.heroVideoUrl ? (
          <div className="space-y-3">
            <div className="rounded-lg overflow-hidden border border-stone-300 bg-black max-w-sm">
              <video
                src={settings.heroVideoUrl}
                controls
                className="w-full max-h-48 object-contain"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-stone-900 px-3 py-2 text-xs font-semibold text-white hover:bg-stone-800">
                <Upload size={14} />
                <span>{uploading ? 'Mengunggah…' : 'Ganti Video MP4'}</span>
                <input
                  type="file"
                  accept="video/mp4"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => void onUploadHeroVideo(e)}
                />
              </label>
              <button
                type="button"
                onClick={() => void onRemoveHeroVideo()}
                className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-800"
              >
                <Trash2 size={13} /> Hapus Video
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="h-20 w-24 shrink-0 rounded-lg border border-dashed border-stone-300 bg-stone-50 flex items-center justify-center text-stone-400">
              <Video size={24} />
            </div>
            <div className="space-y-1">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-stone-900 px-3 py-2 text-xs font-semibold text-white hover:bg-stone-800">
                <Upload size={14} />
                <span>{uploading ? 'Mengunggah…' : 'Upload Video MP4'}</span>
                <input
                  type="file"
                  accept="video/mp4"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => void onUploadHeroVideo(e)}
                />
              </label>
              <p className="text-[11px] text-stone-500">Belum ada video. Tampilan akan menggunakan foto hero tengah.</p>
            </div>
          </div>
        )}
      </article>

      {/* Intro Texts */}
      <article className="space-y-3 rounded-xl border border-stone-200 p-4">
        <h3 className="font-semibold text-stone-800 text-sm border-b border-stone-100 pb-2">
          Teks Kustom &amp; Intro Section
        </h3>

        <div className="space-y-3">
          <label className="block text-xs font-medium text-stone-700">
            Hero Caption (yt_hero_caption)
            <input
              type="text"
              value={settings.heroCaption}
              onChange={(e) => onChange({ heroCaption: e.target.value })}
              placeholder="Contoh: Official Wedding Stream & Celebration"
              className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100"
            />
          </label>

          <label className="block text-xs font-medium text-stone-700">
            Music Label (yt_music_label)
            <input
              type="text"
              value={settings.musicLabel}
              onChange={(e) => onChange({ musicLabel: e.target.value })}
              placeholder="Contoh: Payung Teduh - Akad (Official Audio)"
              className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100"
            />
          </label>

          <label className="block text-xs font-medium text-stone-700">
            Community Intro (yt_community_intro)
            <textarea
              rows={2}
              value={settings.communityIntro}
              onChange={(e) => onChange({ communityIntro: e.target.value })}
              placeholder="Teks pengantar di bagian komunitas / quote..."
              className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100"
            />
          </label>

          <label className="block text-xs font-medium text-stone-700">
            Event Intro (yt_event_intro)
            <textarea
              rows={2}
              value={settings.eventIntro}
              onChange={(e) => onChange({ eventIntro: e.target.value })}
              placeholder="Teks pengantar jadwal acara pernikahan..."
              className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100"
            />
          </label>

          <label className="block text-xs font-medium text-stone-700">
            Gallery Intro (yt_gallery_intro)
            <textarea
              rows={2}
              value={settings.galleryIntro}
              onChange={(e) => onChange({ galleryIntro: e.target.value })}
              placeholder="Teks pengantar dokumentasi galeri foto..."
              className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100"
            />
          </label>

          <label className="block text-xs font-medium text-stone-700">
            Gift Intro (yt_gift_intro)
            <textarea
              rows={2}
              value={settings.giftIntro}
              onChange={(e) => onChange({ giftIntro: e.target.value })}
              placeholder="Teks pengantar tanda kasih / wedding gift..."
              className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100"
            />
          </label>

          <label className="block text-xs font-medium text-stone-700">
            Alamat Pengiriman Kado Fisik (yt_shipping_address)
            <textarea
              rows={3}
              value={settings.shippingAddress}
              onChange={(e) => onChange({ shippingAddress: e.target.value })}
              placeholder="Alamat lengkap penerima kiriman kado fisik..."
              className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100"
            />
          </label>
        </div>
      </article>

      {/* Visibility Toggles */}
      <article className="space-y-3 rounded-xl border border-stone-200 p-4">
        <h3 className="font-semibold text-stone-800 text-sm border-b border-stone-100 pb-2">
          Visibilitas Bagian (Section Toggles)
        </h3>

        <div className="space-y-2">
          <label className="flex items-center justify-between rounded-lg border border-stone-200 p-3 bg-stone-50 cursor-pointer">
            <span className="text-xs font-medium text-stone-800 flex items-center gap-2">
              {settings.showGallery ? <Eye size={15} className="text-emerald-600" /> : <EyeOff size={15} className="text-stone-400" />}
              Tampilkan Bagian Galeri (yt_show_gallery)
            </span>
            <input
              type="checkbox"
              checked={settings.showGallery}
              onChange={(e) => onChange({ showGallery: e.target.checked })}
              className="h-4 w-4 rounded border-stone-300 text-red-600 focus:ring-red-500"
            />
          </label>

          <label className="flex items-center justify-between rounded-lg border border-stone-200 p-3 bg-stone-50 cursor-pointer">
            <span className="text-xs font-medium text-stone-800 flex items-center gap-2">
              {settings.showGift ? <Eye size={15} className="text-emerald-600" /> : <EyeOff size={15} className="text-stone-400" />}
              Tampilkan Bagian Wedding Gift (yt_show_gift)
            </span>
            <input
              type="checkbox"
              checked={settings.showGift}
              onChange={(e) => onChange({ showGift: e.target.checked })}
              className="h-4 w-4 rounded border-stone-300 text-red-600 focus:ring-red-500"
            />
          </label>
        </div>
      </article>

      <div>
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
        >
          <Save size={15} />
          {saving ? 'Menyimpan Pengaturan…' : 'Simpan Pengaturan YouTube'}
        </button>
      </div>
    </div>
  );
};

export interface PublicationControlBarProps {
  isPublished: boolean;
  userRole: 'owner' | 'super_admin' | null;
  isYtWedding: boolean;
  onOpenPublishModal: () => void;
  onUnpublish: () => Promise<void>;
  publishing: boolean;
}

export const PublicationControlBar: React.FC<PublicationControlBarProps> = ({
  isPublished,
  userRole,
  isYtWedding,
  onOpenPublishModal,
  onUnpublish,
  publishing,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-stone-50 px-6 py-3">
      <div className="flex items-center gap-2.5">
        <span className="text-xs font-medium text-stone-600">Status Undangan:</span>
        {isPublished ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 size={13} className="text-emerald-600" />
            Terbit (Publik)
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <AlertTriangle size={13} className="text-amber-600" />
            Draft (Belum Terbit)
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {isPublished ? (
          <button
            type="button"
            onClick={() => void onUnpublish()}
            disabled={publishing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-50 disabled:opacity-60"
          >
            {publishing ? 'Memproses…' : 'Tarik dari Publik (Unpublish)'}
          </button>
        ) : isYtWedding ? (
          userRole === 'super_admin' ? (
            <button
              type="button"
              onClick={onOpenPublishModal}
              disabled={publishing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
            >
              <ShieldCheck size={14} />
              Publikasikan Undangan
            </button>
          ) : (
            <span className="text-[11px] text-stone-500 italic">
              (Hanya super_admin yang berwenang menerbitkan template ini)
            </span>
          )
        ) : (
          <button
            type="button"
            onClick={onOpenPublishModal}
            disabled={publishing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            Publikasikan Undangan
          </button>
        )}
      </div>
    </div>
  );
};

export interface YtPublicationModalProps {
  isOpen: boolean;
  slug: string;
  isYtWedding: boolean;
  onClose: () => void;
  onConfirmPublish: (
    attestations: {
      assetsLicensed: boolean;
      youtubeIdentityReviewed: boolean;
      visualParityChecked: boolean;
      linksVerified: boolean;
    },
    confirmation: string
  ) => Promise<void>;
  publishing: boolean;
  errorReasons: string[];
}

export const YtPublicationModal: React.FC<YtPublicationModalProps> = ({
  isOpen,
  slug,
  isYtWedding,
  onClose,
  onConfirmPublish,
  publishing,
  errorReasons,
}) => {
  const [assetsLicensed, setAssetsLicensed] = useState(false);
  const [youtubeIdentityReviewed, setYoutubeIdentityReviewed] = useState(false);
  const [visualParityChecked, setVisualParityChecked] = useState(false);
  const [linksVerified, setLinksVerified] = useState(false);
  const [confirmation, setConfirmation] = useState('');

  if (!isOpen) return null;

  const allAttested = isYtWedding
    ? assetsLicensed && youtubeIdentityReviewed && visualParityChecked && linksVerified
    : true;
  const confirmationValid = confirmation.trim() === 'PUBLISH' || confirmation.trim() === slug;
  const canSubmit = allAttested && confirmationValid && !publishing;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    void onConfirmPublish(
      {
        assetsLicensed,
        youtubeIdentityReviewed,
        visualParityChecked,
        linksVerified,
      },
      confirmation.trim()
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-stone-200 overflow-hidden">
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4 bg-stone-50">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-red-700" />
            <h3 className="text-base font-bold text-stone-900">
              Konfirmasi Publikasi Undangan
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorReasons.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 space-y-1.5 text-xs text-red-900">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                Persyaratan publikasi belum terpenuhi:
              </p>
              <ul className="list-disc pl-5 space-y-0.5">
                {errorReasons.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            </div>
          )}

          {isYtWedding && (
            <div className="space-y-2.5">
              <p className="text-xs font-semibold text-stone-800">
                Verifikasi 4 Gerbang Kesiapan Hukum &amp; Visual (Wajib Centang Semua):
              </p>

              <label className="flex items-start gap-2.5 rounded-lg border border-stone-200 p-2.5 bg-stone-50/70 text-xs text-stone-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={assetsLicensed}
                  onChange={(e) => setAssetsLicensed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-stone-300 text-red-600 focus:ring-red-500"
                />
                <span>
                  <strong>Hak Distribusi Aset:</strong> Seluruh aset foto, musik, dan video adalah materi berlisensi sah atau milik klien sendiri.
                </span>
              </label>

              <label className="flex items-start gap-2.5 rounded-lg border border-stone-200 p-2.5 bg-stone-50/70 text-xs text-stone-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={youtubeIdentityReviewed}
                  onChange={(e) => setYoutubeIdentityReviewed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-stone-300 text-red-600 focus:ring-red-500"
                />
                <span>
                  <strong>Identitas YouTube:</strong> Elemen visual YouTube telah ditinjau dan tidak menyesatkan publik atau memalsukan metrik streaming/pembayaran.
                </span>
              </label>

              <label className="flex items-start gap-2.5 rounded-lg border border-stone-200 p-2.5 bg-stone-50/70 text-xs text-stone-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={visualParityChecked}
                  onChange={(e) => setVisualParityChecked(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-stone-300 text-red-600 focus:ring-red-500"
                />
                <span>
                  <strong>Paritas Visual 1:1:</strong> Telah memverifikasi tampilan visual pada desktop, tablet, dan smartphone sesuai template.
                </span>
              </label>

              <label className="flex items-start gap-2.5 rounded-lg border border-stone-200 p-2.5 bg-stone-50/70 text-xs text-stone-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={linksVerified}
                  onChange={(e) => setLinksVerified(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-stone-300 text-red-600 focus:ring-red-500"
                />
                <span>
                  <strong>Tautan Aktif:</strong> Google Maps dan livestream telah diverifikasi dengan URL aktif dan bukan placeholder (# atau example.com).
                </span>
              </label>
            </div>
          )}

          <div className="space-y-1 pt-1">
            <label className="block text-xs font-semibold text-stone-800">
              Ketik <code className="font-mono bg-stone-100 px-1 py-0.5 rounded text-red-700">{slug}</code> atau{' '}
              <code className="font-mono bg-stone-100 px-1 py-0.5 rounded text-red-700">PUBLISH</code> untuk konfirmasi:
            </label>
            <input
              type="text"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder={`Ketik ${slug} atau PUBLISH`}
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 font-mono"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-200">
            <button
              type="button"
              onClick={onClose}
              disabled={publishing}
              className="rounded-lg border border-stone-300 px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-lg bg-red-700 px-4 py-2 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-40"
            >
              {publishing ? 'Memproses Publikasi…' : 'Konfirmasi & Publikasikan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
