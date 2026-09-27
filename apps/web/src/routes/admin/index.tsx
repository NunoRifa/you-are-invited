import React, { useEffect, useState } from 'react';
import { Download, ExternalLink, ShieldCheck, ArrowLeft, RefreshCw } from 'lucide-react';

interface AdminInvitationItem {
  id: string;
  slug: string;
  title: string;
  templateKey: string;
  createdAt: number;
}

export const AdminDashboard: React.FC = () => {
  const [invitations, setInvitations] = useState<AdminInvitationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadInvitations = () => {
    setLoading(true);
    fetch('/api/admin/invitations')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setInvitations(data);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadInvitations();
  }, []);

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 font-sans p-6 md:p-12">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <a href="/" className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 mb-2">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali ke Website</span>
            </a>
            <h1 className="font-serif text-3xl font-bold text-stone-900">Dashboard Pengelola Undangan</h1>
            <p className="text-xs text-stone-600 mt-1">Kelola undangan pernikahan, pantau RSVP, dan unduh data tamu.</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadInvitations}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-stone-300 rounded-lg text-xs font-medium text-stone-700 hover:bg-stone-50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Muat Ulang</span>
            </button>
          </div>
        </div>

        {/* Invitations Table */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
          <div className="p-6 border-b border-stone-200 flex items-center justify-between">
            <h2 className="font-bold text-sm text-stone-800">Daftar Undangan Aktif</h2>
            <span className="text-xs font-semibold px-2.5 py-1 bg-amber-50 text-amber-800 rounded-full border border-amber-200">
              {invitations.length} Undangan
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-xs text-stone-500">Memuat data undangan...</div>
          ) : invitations.length === 0 ? (
            <div className="p-12 text-center text-xs text-stone-500">Belum ada undangan yang dibuat.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="p-4">Judul Undangan</th>
                    <th className="p-4">Slug / URL</th>
                    <th className="p-4">Template Terpilih</th>
                    <th className="p-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {invitations.map((inv) => (
                    <tr key={inv.id} className="hover:bg-stone-50/50">
                      <td className="p-4 font-semibold text-stone-900">{inv.title}</td>
                      <td className="p-4 font-mono text-stone-600">/i/{inv.slug}</td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 font-mono text-[11px]">
                          {inv.templateKey}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <a
                          href={`/api/admin/invitations/${inv.id}/wishes/export`}
                          download
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-medium"
                          title="Unduh data RSVP & Ucapan ke CSV"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Export CSV</span>
                        </a>
                        <a
                          href={`/i/${inv.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-medium"
                        >
                          <span>Buka</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Security & Multi-tenant status banner */}
        <div className="mt-8 p-4 rounded-xl bg-amber-50/60 border border-amber-200 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900">
            <p className="font-semibold">Arsitektur Multi-Tenant Aktif</p>
            <p className="text-stone-600 mt-0.5">
              Setiap undangan terisolasi berdasarkan <code className="font-mono bg-amber-100/70 px-1 rounded">invitation_id</code>.
              Data template dinamis disimpan pada tabel <code className="font-mono bg-amber-100/70 px-1 rounded">invitation_template_fields</code> tanpa perlu migrasi skema database saat menambahkan template baru.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
