import React, { useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink, Plus, RefreshCw, Save, Trash2, Eye, EyeOff } from 'lucide-react';
import { bankProviders, getBankProvider, otherProviderName } from '../../features/gift/bank-providers.js';

interface EditorPayload {
  invitation: { id: string; slug: string; title: string; hashtag: string | null; openingGreetingText: string | null; closingText: string | null; quoteText: string | null; quoteSource: string | null; coverGuestLabelDefault: string };
  couples: Array<{ id: string; role: string; fullName: string; displayName: string; fatherName: string | null; motherName: string | null; birthOrderLabel: string | null; instagramHandle: string | null }>;
  events: Array<{ id: string; label: string; date: string; startTime: string; endTimeLabel: string | null; venueName: string; venueAddress: string; mapsUrl: string | null }>;
  giftAccounts: Array<{ id: string; holderName: string; accountNumber: string; providerName: string; sortOrder: number }>;
  wishes: Array<{ id: string; guestName: string; message: string; attendanceStatus: string; isHidden: boolean }>;
}

const tabs = ['Umum', 'Mempelai', 'Acara', 'Wedding Gift', 'Ucapan'];

export const InvitationEditor: React.FC<{ invitationId: string; onNavigate: (path: string) => void; onLogout: () => void }> = ({ invitationId, onNavigate, onLogout }) => {
  const [payload, setPayload] = useState<EditorPayload | null>(null);
  const [activeTab, setActiveTab] = useState(tabs[0]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [previewVersion, setPreviewVersion] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/invitations/${invitationId}`, { credentials: 'include' });
      if (response.status === 401) { onLogout(); throw new Error('Sesi admin tidak valid. Silakan login kembali.'); }
      if (!response.ok) throw new Error('Gagal memuat undangan. Pastikan API tersedia.');
      setPayload(await response.json());
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Gagal memuat data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [invitationId]);

  const patchInvitation = (field: keyof EditorPayload['invitation'], value: string) => {
    setPayload((current) => current ? { ...current, invitation: { ...current.invitation, [field]: value } } : current);
  };

  const save = async () => {
    if (!payload) return;
    setSaving(true);
    setNotice('');
    try {
      const response = await fetch(`/api/admin/invitations/${invitationId}`, {
        method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload.invitation),
      });
      if (!response.ok) throw new Error('Gagal menyimpan perubahan.');
      setNotice('Perubahan tersimpan.');
      setPreviewVersion((version) => version + 1);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Gagal menyimpan.');
    } finally {
      setSaving(false);
    }
  };

  const saveGift = async (gift: EditorPayload['giftAccounts'][number]) => {
    const isNew = gift.id.startsWith('draft-');
    const response = await fetch(isNew
      ? `/api/admin/invitations/${invitationId}/gift-accounts`
      : `/api/admin/invitations/${invitationId}/gift-accounts/${gift.id}`, {
      method: isNew ? 'POST' : 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(gift),
    });
    if (!response.ok) throw new Error('Gagal menyimpan rekening.');
    return isNew ? await response.json() as { id: string } : null;
  };

  const addGift = () => setPayload((current) => current ? {
    ...current,
    giftAccounts: [...current.giftAccounts, { id: `draft-${crypto.randomUUID()}`, holderName: '', accountNumber: '', providerName: '', sortOrder: current.giftAccounts.length + 1 }],
  } : current);

  const deleteGift = async (gift: EditorPayload['giftAccounts'][number]) => {
    if (!window.confirm(`Hapus rekening ${gift.providerName || 'baru'} ini?`)) return;
    if (!gift.id.startsWith('draft-')) {
      const response = await fetch(`/api/admin/invitations/${invitationId}/gift-accounts/${gift.id}`, { method: 'DELETE', credentials: 'include' });
      if (!response.ok) throw new Error('Gagal menghapus rekening.');
    }
    setPayload((current) => current ? { ...current, giftAccounts: current.giftAccounts.filter((item) => item.id !== gift.id) } : current);
    setNotice('Rekening dihapus.');
    setPreviewVersion((version) => version + 1);
  };

  const updateCouple = (id: string, field: string, value: string) => {
    setPayload((current) => current ? {
      ...current,
      couples: current.couples.map((c) => c.id === id ? { ...c, [field]: value } : c),
    } : current);
  };

  const saveCouple = async (couple: EditorPayload['couples'][number]) => {
    const res = await fetch(`/api/admin/invitations/${invitationId}/couples/${couple.id}`, {
      method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(couple),
    });
    if (!res.ok) throw new Error('Gagal menyimpan data mempelai.');
    setNotice(`Data ${couple.displayName || 'mempelai'} tersimpan.`);
    setPreviewVersion((v) => v + 1);
  };

  const updateEvent = (index: number, field: string, value: string) => {
    setPayload((current) => current ? {
      ...current,
      events: current.events.map((e, i) => i === index ? { ...e, [field]: value } : e),
    } : current);
  };

  const addEvent = () => setPayload((current) => current ? {
    ...current,
    events: [...current.events, {
      id: `draft-${crypto.randomUUID()}`,
      label: 'Acara Baru',
      date: new Date().toISOString().split('T')[0],
      startTime: '09:00',
      endTimeLabel: 'Selesai',
      venueName: '',
      venueAddress: '',
      mapsUrl: '',
    }],
  } : current);

  const saveEvent = async (event: EditorPayload['events'][number]) => {
    const isNew = event.id.startsWith('draft-');
    const res = await fetch(isNew
      ? `/api/admin/invitations/${invitationId}/events`
      : `/api/admin/invitations/${invitationId}/events/${event.id}`, {
      method: isNew ? 'POST' : 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
    if (!res.ok) throw new Error('Gagal menyimpan acara.');
    const data = isNew ? await res.json() as { id: string } : null;
    if (data?.id) {
      setPayload((current) => current ? {
        ...current,
        events: current.events.map((e) => e.id === event.id ? { ...e, id: data.id } : e),
      } : current);
    }
    setNotice(`Acara ${event.label} tersimpan.`);
    setPreviewVersion((v) => v + 1);
  };

  const deleteEvent = async (event: EditorPayload['events'][number]) => {
    if (!window.confirm(`Hapus acara "${event.label}" ini?`)) return;
    if (!event.id.startsWith('draft-')) {
      const res = await fetch(`/api/admin/invitations/${invitationId}/events/${event.id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Gagal menghapus acara.');
    }
    setPayload((current) => current ? {
      ...current,
      events: current.events.filter((e) => e.id !== event.id),
    } : current);
    setNotice('Acara dihapus.');
    setPreviewVersion((v) => v + 1);
  };

  const toggleWish = async (wish: EditorPayload['wishes'][number]) => {
    const nextStatus = !wish.isHidden;
    const res = await fetch(`/api/admin/invitations/${invitationId}/wishes/${wish.id}`, {
      method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isHidden: nextStatus }),
    });
    if (!res.ok) throw new Error('Gagal mengubah status ucapan.');
    setPayload((current) => current ? {
      ...current,
      wishes: current.wishes.map((w) => w.id === wish.id ? { ...w, isHidden: nextStatus } : w),
    } : current);
    setNotice(nextStatus ? 'Ucapan disembunyikan dari publik.' : 'Ucapan ditampilkan di publik.');
    setPreviewVersion((v) => v + 1);
  };

  const deleteWish = async (wish: EditorPayload['wishes'][number]) => {
    if (!window.confirm(`Hapus ucapan dari "${wish.guestName}"?`)) return;
    const res = await fetch(`/api/admin/invitations/${invitationId}/wishes/${wish.id}`, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) throw new Error('Gagal menghapus ucapan.');
    setPayload((current) => current ? {
      ...current,
      wishes: current.wishes.filter((w) => w.id !== wish.id),
    } : current);
    setNotice('Ucapan dihapus.');
    setPreviewVersion((v) => v + 1);
  };

  if (loading) return <div className="p-10 text-sm text-stone-600">Memuat editor undangan…</div>;
  if (!payload) return <div className="p-10 text-sm text-red-700">{notice || 'Data undangan tidak ditemukan.'}</div>;

  const updateGift = (index: number, field: keyof EditorPayload['giftAccounts'][number], value: string) => {
    setPayload((current) => current ? { ...current, giftAccounts: current.giftAccounts.map((gift, i) => i === index ? { ...gift, [field]: value } : gift) } : current);
  };

  return <main className="min-h-screen bg-stone-100 text-stone-900">
    <header className="flex items-center justify-between gap-4 border-b border-stone-200 bg-white px-5 py-4">
      <button onClick={() => onNavigate('/admin')} className="inline-flex items-center gap-2 text-sm text-stone-600 hover:text-stone-900"><ArrowLeft size={16}/>Daftar Undangan</button>
      <div className="flex items-center gap-2">
        {notice && <span role="status" className="mr-2 text-xs text-stone-600">{notice}</span>}
        <button onClick={() => { void onLogout(); }} className="rounded-lg border border-stone-300 px-3 py-2 text-sm">Keluar</button>
        <button onClick={() => { void load(); setPreviewVersion((v) => v + 1); }} className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"><RefreshCw size={15}/>Muat Ulang</button>
        <button onClick={() => void save()} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-amber-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"><Save size={15}/>{saving ? 'Menyimpan…' : 'Simpan'}</button>
      </div>
    </header>
    <div className="grid min-h-[calc(100vh-65px)] lg:grid-cols-[minmax(360px,460px)_1fr]">
      <section className="border-r border-stone-200 bg-white">
        <div className="border-b border-stone-200 px-6 py-5"><p className="text-xs uppercase tracking-widest text-stone-500">Editor Undangan</p><h1 className="mt-1 text-xl font-semibold">{payload.invitation.title}</h1></div>
        <nav aria-label="Bagian undangan" className="flex gap-1 overflow-x-auto border-b border-stone-200 px-4 py-3">{tabs.map((tab) => <button key={tab} onClick={() => setActiveTab(tab)} className={`shrink-0 rounded-md px-3 py-2 text-xs font-medium ${activeTab === tab ? 'bg-amber-100 text-amber-950' : 'text-stone-600 hover:bg-stone-100'}`}>{tab}</button>)}</nav>
        <div className="space-y-4 p-6">
          {activeTab === 'Umum' && <>
            <Field label="Judul undangan" value={payload.invitation.title} onChange={(v) => patchInvitation('title', v)} />
            <Field label="Hashtag" value={payload.invitation.hashtag || ''} onChange={(v) => patchInvitation('hashtag', v)} placeholder="#NamaPasanganForever" />
            <Field label="Label default tamu" value={payload.invitation.coverGuestLabelDefault} onChange={(v) => patchInvitation('coverGuestLabelDefault', v)} />
            <Field label="Salam pembuka" value={payload.invitation.openingGreetingText || ''} onChange={(v) => patchInvitation('openingGreetingText', v)} multiline />
            <Field label="Kutipan" value={payload.invitation.quoteText || ''} onChange={(v) => patchInvitation('quoteText', v)} multiline />
            <Field label="Sumber kutipan" value={payload.invitation.quoteSource || ''} onChange={(v) => patchInvitation('quoteSource', v)} />
            <Field label="Teks penutup" value={payload.invitation.closingText || ''} onChange={(v) => patchInvitation('closingText', v)} multiline />
          </>}
          {activeTab === 'Mempelai' && payload.couples.map((person) => (
            <article key={person.id} className="space-y-3 rounded-xl border border-stone-200 p-4">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                <h2 className="font-semibold capitalize text-stone-800">
                  {person.role === 'bride' ? 'Mempelai Wanita' : 'Mempelai Pria'}
                </h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-stone-100 text-stone-600">
                  {person.role}
                </span>
              </div>
              <Field
                label="Nama Lengkap & Gelar"
                value={person.fullName}
                onChange={(v) => updateCouple(person.id, 'fullName', v)}
                placeholder="Contoh: Anggi Azoka Dea Prabowo, S.Kom"
              />
              <Field
                label="Nama Panggilan"
                value={person.displayName}
                onChange={(v) => updateCouple(person.id, 'displayName', v)}
                placeholder="Contoh: Anggi"
              />
              <Field
                label="Label Anak / Urutan Kelahiran"
                value={person.birthOrderLabel || ''}
                onChange={(v) => updateCouple(person.id, 'birthOrderLabel', v)}
                placeholder="Contoh: Putri Pertama / Putra Kedua"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field
                  label="Nama Ayah"
                  value={person.fatherName || ''}
                  onChange={(v) => updateCouple(person.id, 'fatherName', v)}
                  placeholder="Bapak ..."
                />
                <Field
                  label="Nama Ibu"
                  value={person.motherName || ''}
                  onChange={(v) => updateCouple(person.id, 'motherName', v)}
                  placeholder="Ibu ..."
                />
              </div>
              <Field
                label="Akun Instagram"
                value={person.instagramHandle || ''}
                onChange={(v) => updateCouple(person.id, 'instagramHandle', v)}
                placeholder="username_ig (tanpa @)"
              />
              <button
                type="button"
                onClick={() => void saveCouple(person).catch((e) => setNotice(e.message))}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold hover:bg-stone-50"
              >
                Simpan Profil {person.displayName || person.role}
              </button>
            </article>
          ))}

          {activeTab === 'Acara' && <>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-stone-600">{payload.events.length} rangkaian acara</p>
              <button
                type="button"
                onClick={addEvent}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-800 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-900"
              >
                <Plus size={14}/>Tambah Acara
              </button>
            </div>
            {payload.events.map((event, index) => (
              <article key={event.id} className="space-y-3 rounded-xl border border-stone-200 p-4">
                <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                  <h2 className="font-semibold text-stone-800">
                    Acara #{index + 1}: {event.label || 'Baru'}
                  </h2>
                  <button
                    type="button"
                    aria-label={`Hapus acara ${event.label}`}
                    onClick={() => void deleteEvent(event).catch((e) => setNotice(e.message))}
                    className="rounded p-1.5 text-red-700 hover:bg-red-50"
                  >
                    <Trash2 size={16}/>
                  </button>
                </div>
                <Field
                  label="Nama / Label Acara"
                  value={event.label}
                  onChange={(v) => updateEvent(index, 'label', v)}
                  placeholder="Contoh: AKAD NIKAH / RESEPSI"
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field
                    label="Tanggal Acara"
                    value={event.date}
                    onChange={(v) => updateEvent(index, 'date', v)}
                    placeholder="YYYY-MM-DD"
                  />
                  <Field
                    label="Jam Mulai"
                    value={event.startTime}
                    onChange={(v) => updateEvent(index, 'startTime', v)}
                    placeholder="Contoh: 10:00"
                  />
                  <Field
                    label="Label Jam Selesai"
                    value={event.endTimeLabel || ''}
                    onChange={(v) => updateEvent(index, 'endTimeLabel', v)}
                    placeholder="Contoh: Selesai / 15:00 WIB"
                  />
                </div>
                <Field
                  label="Nama Tempat / Gedung"
                  value={event.venueName}
                  onChange={(v) => updateEvent(index, 'venueName', v)}
                  placeholder="Contoh: Ballroom Mall Metropolitan Cileungsi"
                />
                <Field
                  label="Alamat Lengkap Lokasi"
                  value={event.venueAddress}
                  onChange={(v) => updateEvent(index, 'venueAddress', v)}
                  placeholder="Jl. ..."
                  multiline
                />
                <Field
                  label="Tautan Google Maps Lokasi"
                  value={event.mapsUrl || ''}
                  onChange={(v) => updateEvent(index, 'mapsUrl', v)}
                  placeholder="https://maps.app.goo.gl/... atau https://share.google/..."
                />
                <button
                  type="button"
                  onClick={() => void saveEvent(event).catch((e) => setNotice(e.message))}
                  className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold hover:bg-stone-50"
                >
                  Simpan Acara Ini
                </button>
              </article>
            ))}
            {payload.events.length === 0 && (
              <p className="text-sm text-stone-600">Belum ada acara yang ditambahkan.</p>
            )}
          </>}
          {activeTab === 'Wedding Gift' && <>
            <div className="flex items-center justify-between gap-3"><p className="text-sm text-stone-600">{payload.giftAccounts.length} rekening</p><button onClick={addGift} className="inline-flex items-center gap-2 rounded-lg bg-amber-800 px-3 py-2 text-xs font-semibold text-white"><Plus size={14}/>Tambah rekening</button></div>
            {payload.giftAccounts.map((gift, index) => {
              const knownProvider = getBankProvider(gift.providerName);
              const selectValue = knownProvider?.name || otherProviderName;
              return <article key={gift.id} className="space-y-3 rounded-xl border border-stone-200 p-4"><div className="flex items-center justify-between"><h2 className="font-semibold">Rekening {index + 1}</h2><button aria-label={`Hapus rekening ${index + 1}`} onClick={() => void deleteGift(gift).catch((e) => setNotice(e.message))} className="rounded p-2 text-red-700 hover:bg-red-50"><Trash2 size={16}/></button></div>
                <label className="block text-xs font-medium text-stone-700">Bank / provider<select value={selectValue} onChange={(e) => updateGift(index, 'providerName', e.target.value === otherProviderName ? '' : e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-100"><option value="">Pilih bank/provider</option>{bankProviders.map((provider) => <option key={provider.name} value={provider.name}>{provider.name}</option>)}<option value={otherProviderName}>{otherProviderName}</option></select></label>
                {selectValue === otherProviderName && <Field label="Nama provider lainnya" value={knownProvider ? '' : gift.providerName} onChange={(v) => updateGift(index, 'providerName', v)} placeholder="Masukkan nama provider" />}
                <Field label="Nomor rekening" value={gift.accountNumber} onChange={(v) => updateGift(index, 'accountNumber', v)} /><Field label="Atas nama" value={gift.holderName} onChange={(v) => updateGift(index, 'holderName', v)} /><button onClick={() => void saveGift(gift).then((created) => { if (created?.id) setPayload((current) => current ? { ...current, giftAccounts: current.giftAccounts.map((item) => item.id === gift.id ? { ...item, id: created.id } : item) } : current); setNotice('Rekening tersimpan.'); setPreviewVersion((v) => v + 1); }).catch((e) => setNotice(e.message))} className="rounded-lg border border-stone-300 px-3 py-2 text-xs font-semibold">Simpan rekening</button></article>;
            })}
            {payload.giftAccounts.length === 0 && <p className="text-sm text-stone-600">Belum ada rekening hadiah.</p>}
          </>}
          {activeTab === 'Ucapan' && <>
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div>
                <h2 className="font-semibold text-stone-800 text-sm">Moderasi Ucapan & Doa Tamu</h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Total {payload.wishes.length} ucapan ({payload.wishes.filter((w) => !w.isHidden).length} tampil, {payload.wishes.filter((w) => w.isHidden).length} disembunyikan)
                </p>
              </div>
            </div>
            {payload.wishes.map((wish) => (
              <article
                key={wish.id}
                className={`rounded-xl border p-4 space-y-2.5 transition-colors ${
                  wish.isHidden ? 'bg-stone-50/80 border-dashed border-stone-300 opacity-75' : 'bg-white border-stone-200 shadow-xs'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="font-semibold text-stone-900 text-sm">{wish.guestName}</span>
                    <span className={`ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      wish.attendanceStatus === 'attending'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : wish.attendanceStatus === 'not_attending'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {wish.attendanceStatus === 'attending' ? 'Hadir' : wish.attendanceStatus === 'not_attending' ? 'Tidak Hadir' : 'Masih Ragu'}
                    </span>
                    {wish.isHidden && (
                      <span className="ml-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-800">
                        Disembunyikan dari Publik
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void toggleWish(wish).catch((e) => setNotice(e.message))}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border ${
                        wish.isHidden
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                          : 'bg-stone-100 text-stone-700 border-stone-300 hover:bg-stone-200'
                      }`}
                      title={wish.isHidden ? 'Tampilkan kembali di undangan publik' : 'Sembunyikan ucapan ini dari tamu publik'}
                    >
                      {wish.isHidden ? <Eye size={13}/> : <EyeOff size={13}/>}
                      <span>{wish.isHidden ? 'Tampilkan' : 'Sembunyikan'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteWish(wish).catch((e) => setNotice(e.message))}
                      className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 hover:text-red-800"
                      title="Hapus ucapan secara permanen"
                    >
                      <Trash2 size={14}/>
                    </button>
                  </div>
                </div>
                <p className="text-xs text-stone-700 leading-relaxed bg-stone-50/50 p-2.5 rounded-lg border border-stone-100">
                  {wish.message}
                </p>
              </article>
            ))}
            {payload.wishes.length === 0 && (
              <p className="text-sm text-stone-500 text-center py-8">Belum ada ucapan dari tamu undangan.</p>
            )}
          </>}
        </div>
      </section>
      <section className="hidden min-h-0 flex-col bg-stone-200 p-4 lg:flex">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">Live Preview · /i/{payload.invitation.slug}</h2><a className="inline-flex items-center gap-1 text-xs text-stone-700 underline" href={`/i/${payload.invitation.slug}`} target="_blank" rel="noreferrer">Buka tab baru <ExternalLink size={13}/></a></div>
        <iframe key={previewVersion} title={`Preview ${payload.invitation.title}`} src={`/i/${payload.invitation.slug}?preview=${previewVersion}`} className="min-h-[680px] flex-1 rounded-xl border border-stone-300 bg-white shadow-sm" />
      </section>
    </div>
  </main>;
};

function Field({ label, value, onChange, placeholder, multiline = false }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; multiline?: boolean }) {
  const classes = 'mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-100';
  return <label className="block text-xs font-medium text-stone-700">{label}{multiline ? <textarea rows={4} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={classes} /> : <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={classes} />}</label>;
}
