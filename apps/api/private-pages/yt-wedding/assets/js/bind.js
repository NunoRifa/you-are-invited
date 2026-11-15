/* Bind approved invitation data without interpreting guest-supplied markup. */
function bindYTWedding(root, payload, guestName, preview) {
  const invitation = payload.invitation || {};
  const couples = Array.isArray(payload.couples) ? payload.couples : [];
  const groom = couples.find(c => c.role === 'groom') || payload.couple?.groom || {};
  const bride = couples.find(c => c.role === 'bride') || payload.couple?.bride || {};
  const fields = payload.templateFields || {};
  const setting = key => fields[`yt_${key}`] || fields[key];
  const blankImage = 'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=';
  const missing = preview ? '[Belum diisi]' : '';
  const value = v => typeof v === 'string' && v.trim() ? v.trim() : missing;
  const name = c => typeof (c.displayName || c.fullName) === 'string' ? (c.displayName || c.fullName).trim() : '';
  const text = (selector, content) => {
    const el = root.querySelector?.(selector);
    if (el) el.textContent = content;
  };
  const all = (selector, content) => root.querySelectorAll?.(selector).forEach(el => { el.textContent = content; });
  const validAsset = url => typeof url === 'string' && /^\/api\/assets\/[a-zA-Z0-9_-]+$/.test(url);
  const validMap = url => typeof url === 'string' && /^https:\/\/(?:www\.)?(?:google\.(?:com|co\.id)\/maps(?:\/|\?)|maps\.google\.(?:com|co\.id)\/|goo\.gl\/maps\/|maps\.app\.goo\.gl\/)/i.test(url);
  const picture = (selector, url) => {
    root.querySelectorAll?.(selector).forEach(el => {
      el.src = validAsset(url) ? url : blankImage;
      if (!validAsset(url)) el.alt = missing;
    });
  };
  const coupleName = invitation.coupleDisplayName?.trim() || [name(groom), name(bride)].filter(Boolean).join(' & ') || missing;
  text('#guest-name', typeof guestName === 'string' ? guestName.slice(0, 120).replace(/[\u0000-\u001f\u007f]/g, '').trim() || '—' : '—');
  text('#welcome-cover h1', coupleName);
  text('#hero-post h2', `${coupleName} · Save the Date 💍`);
  text('#hero-post > .px-3 > p', value(setting('hero_caption')));
  text('#hero-post .font-bold.text-\\[15px\\]', coupleName);
  all('#mempelai-post > div:first-child .font-bold, #event-post > div:first-child .font-bold, #gallery-post > div:first-child .font-bold, #penutup-post > div:first-child .font-medium', coupleName);
  all('#mempelai-post > div:first-child .text-yt-gray, #event-post > div:first-child .text-yt-gray, #gallery-post > div:first-child .text-yt-gray, #penutup-post > div:first-child .text-yt-gray', missing);
  text('#angpao-post .font-light', value(setting('gift_intro') || `Berikan dukungan & tanda kasih untuk ${coupleName}`));
  text('#music-artist', `Untuk ${coupleName} · Tap buat dengerin`);
  const lineage = (c, prefix) => {
    const parents = [c.fatherName, c.motherName].filter(Boolean).join(' & ');
    return parents ? `${prefix} dari ${parents}` : missing;
  };
  for (const [role, person, pos, prefix] of [['groom', groom, 1, 'Putra'], ['bride', bride, 2, 'Putri']]) {
    text(`#mempelai-post .grid.grid-cols-2 > div:nth-child(${pos}) h3`, value(person.displayName || person.fullName));
    text(`#mempelai-post .grid.grid-cols-2 > div:nth-child(${pos}) p`, lineage(person, prefix));
    text(`#penutup-post .bg-yt-card .${pos === 1 ? 'mb-4' : 'mt-4'} .font-bold`, value(person.displayName || person.fullName));
    text(`#penutup-post .bg-yt-card .${pos === 1 ? 'mb-4' : 'mt-4'} .text-yt-gray`, lineage(person, prefix));
    picture(`#mempelai-post .grid.grid-cols-2 > div:nth-child(${pos}) img`, person.photoUrl);
    if (root.documentElement?.dataset) root.documentElement.dataset[role === 'bride' ? 'bride' : 'groom'] = value(person.displayName || person.fullName);
  }
  text('#mempelai-post .text-\\[14px\\].leading-relaxed .font-light', value(setting('community_intro') || invitation.openingGreetingText));
  text('#event-post .text-\\[14px\\].leading-relaxed .font-light', value(setting('event_intro')));
  text('#gallery-post .text-\\[14px\\].leading-relaxed .font-light', value(setting('gallery_intro')));
  text('#penutup-post > .px-4.mb-3', value(invitation.closingText));
  const quote = root.querySelector?.('#hero-post .bg-yt-card p.font-light');
  if (quote?.firstChild) quote.firstChild.textContent = value(invitation.quoteText);
  const citation = quote?.querySelector?.('span');
  if (citation) citation.textContent = `— ${value(invitation.quoteSource)}`;
  text('#music-label', value(setting('music_label') || 'Musik Latar'));
  picture('#welcome-cover img, #hero-post img, #mempelai-post > div:first-child img, #event-post > div:first-child img, #gallery-post > div:first-child img, #penutup-post > div:first-child img, #form-rsvp img', invitation.heroPhotoUrl || invitation.coverPhotoUrl);
  const video = root.querySelector?.('#hero-post .aspect-video');
  if (video && validAsset(invitation.heroVideoUrl) && typeof video.querySelector === 'function') {
    const img = video.querySelector('img');
    if (img && typeof document !== 'undefined') {
      const player = document.createElement('video');
      player.className = img.className;
      player.src = invitation.heroVideoUrl;
      player.controls = true;
      player.playsInline = true;
      player.poster = validAsset(invitation.heroPhotoUrl) ? invitation.heroPhotoUrl : '';
      img.replaceWith(player);
      video.querySelectorAll?.('.absolute, [class*="bottom-"]')?.forEach(el => {
        if (el !== player) el.style.display = 'none';
      });
    }
  }
  const dates = [];
  const events = Array.isArray(payload.events) ? payload.events : [];
  for (const type of ['akad', 'resepsi']) {
    const card = root.querySelector?.(`[data-event="${type}"]`);
    const event = events.find(e => (e.label || '').toLowerCase().includes(type)) || (events.length === 2 ? events[['akad', 'resepsi'].indexOf(type)] : null);
    if (!event) { if (card?.style) card.style.display = preview ? '' : 'none'; continue; }
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(event.date || '');
    const time = /^(\d{2}):(\d{2})/.exec(event.startTime || '');
    if (match && time) {
      const timestamp = Date.UTC(+match[1], +match[2] - 1, +match[3], +time[1] - 7, +time[2]);
      const check = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]));
      if (check.getUTCFullYear() === +match[1] && check.getUTCMonth() === +match[2] - 1 && check.getUTCDate() === +match[3] && +time[1] < 24 && +time[2] < 60) dates.push(timestamp);
    }
    const lines = card?.querySelectorAll?.('.space-y-1\\.5 p') || [];
    if (lines[0]) { const icon = lines[0].querySelector?.('i'); lines[0].textContent = ` ${value(event.date)}`; if (icon) lines[0].prepend(icon); }
    if (lines[1]) { const icon = lines[1].querySelector?.('i'); lines[1].textContent = ` ${value(event.startTime)}${event.endTimeLabel ? ` - ${event.endTimeLabel}` : ''} WIB`; if (icon) lines[1].prepend(icon); }
    if (lines[2]) { const icon = lines[2].querySelector?.('i'); lines[2].textContent = ` ${value(event.venueName)}${event.venueAddress ? `, ${event.venueAddress}` : ''}`; if (icon) lines[2].prepend(icon); }
    const link = card?.querySelector?.('a');
    if (link) {
      if (validMap(event.mapsUrl)) { link.href = event.mapsUrl; link.rel = 'noopener noreferrer'; }
      else { link.removeAttribute?.('href'); link.setAttribute?.('aria-disabled', 'true'); }
    }
  }
  const counter = root.querySelector?.('[data-countdown-target]');
  if (counter && dates.length) {
    const target = new Date(Math.min(...dates)).toISOString();
    counter.setAttribute?.('data-countdown-target', target);
    if (counter.dataset) counter.dataset.countdownTarget = target;
    const tick = () => {
      const left = Math.max(0, Math.floor((Date.parse(target) - Date.now()) / 1000));
      for (const [key, seconds, modulo] of [['days', 86400, Infinity], ['hours', 3600, 24], ['minutes', 60, 60], ['seconds', 1, 60]]) {
        const el = counter.querySelector?.(`[data-countdown="${key}"]`);
        if (el) el.textContent = String(Math.floor(left / seconds) % modulo).padStart(2, '0');
      }
    };
    tick();
    if (typeof window !== 'undefined') window.setInterval(tick, 1000);
  } else {
    if (counter) {
      for (const el of counter.querySelectorAll?.('[data-countdown]') || []) el.textContent = '00';
      counter.removeAttribute?.('data-countdown-target');
    }
    const section = root.querySelector?.('#countdown-post');
    if (section?.style) section.style.display = preview ? '' : 'none';
  }
  const images = (Array.isArray(payload.gallery) ? payload.gallery : []).map(item => item?.url).filter(validAsset);
  if (typeof window !== 'undefined') window.galleryImages = images;
  const showGallerySetting = setting('show_gallery');
  const showGallery = showGallerySetting !== 'false' && showGallerySetting !== false;
  const gallerySection = root.querySelector?.('#gallery-post');
  if (gallerySection?.style) gallerySection.style.display = (showGallery && images.length) || preview ? '' : 'none';
  const grid = root.querySelector?.('#gallery-grid');
  if (grid && typeof document !== 'undefined') {
    grid.replaceChildren();
    images.slice(0, 4).forEach((url, index) => {
      const img = document.createElement('img');
      img.src = url;
      img.alt = `Galeri ${index + 1}`;
      img.className = 'w-full aspect-square object-cover';
      if (index === 3 && images.length > 4) {
        const cell = document.createElement('div'); cell.className = 'relative'; cell.append(img);
        const overlay = document.createElement('div'); overlay.className = 'absolute inset-0 bg-black/60 flex items-center justify-center transition hover:bg-black/40';
        const label = document.createElement('span'); label.className = 'text-white font-bold text-[24px]'; label.textContent = `+${images.length - 4}`;
        overlay.append(label); cell.append(overlay); grid.append(cell);
      } else grid.append(img);
    });
  }
  text('#gallery-total', String(images.length));
  text('#gallery-post .text-\\[14px\\].leading-relaxed .font-light', setting('gallery_intro') || (images.length ? `${images.length} photos` : missing));
  const accounts = Array.isArray(payload.giftAccounts) ? payload.giftAccounts : [];
  const accountPane = root.querySelector?.('#rekening-sheet .overflow-y-auto');
  if (accountPane && typeof document !== 'undefined') {
    accountPane.querySelector?.('.border-dashed')?.remove();
    accountPane.querySelectorAll?.('.ytw-rekening-card').forEach(el => el.remove());
    accounts.forEach(account => {
      const card = document.createElement('div'); card.className = 'ytw-rekening-card bg-yt-card border border-yt-border rounded-xl p-4 mb-3';
      const provider = document.createElement('p'); provider.className = 'font-bold text-[14px]'; provider.textContent = value(account.providerName);
      const number = document.createElement('p'); number.className = 'text-yt-text text-[14px]'; number.textContent = value(account.accountNumber);
      const holder = document.createElement('p'); holder.className = 'text-yt-gray text-[12px]'; holder.textContent = value(account.holderName);
      const button = document.createElement('button'); button.type = 'button'; button.className = 'bg-yt-blue text-black font-medium py-2 px-5 rounded-full text-[14px]'; button.textContent = 'Salin Nomor Rekening';
      button.addEventListener('click', () => window.copyRek(account.accountNumber));
      card.append(provider, number, holder, button); accountPane.append(card);
    });
    if (setting('shipping_address')) {
      const address = document.createElement('p'); address.className = 'ytw-rekening-card text-yt-gray text-[13px]'; address.textContent = setting('shipping_address'); accountPane.append(address);
    }
  }
  const audio = root.querySelector?.('#bg-music source');
  const musicUrl = payload.musicUrl || invitation.musicUrl;
  if (audio && validAsset(musicUrl)) { audio.src = musicUrl; audio.parentElement?.load?.(); }
  const musicButton = root.querySelector?.('#btn-musicToggle');
  if (musicButton) musicButton.dataset.musicAvailable = validAsset(musicUrl) ? 'true' : 'false';
  const online = root.querySelector?.('[data-rsvp-opt="online"]');
  const streamUrl = payload.livestream?.streamUrl;
  let validStream = false;
  try { const parsed = new URL(streamUrl); validStream = parsed.protocol === 'https:' && !['localhost', '127.0.0.1'].includes(parsed.hostname) && parsed.hostname.includes('.'); } catch (_) {}
  if (online?.style && !validStream) online.style.display = 'none';
  const form = root.querySelector?.('#form-rsvp');
  if (form && typeof invitation.slug === 'string') form.dataset.invitationSlug = invitation.slug;
  const onlineRadio = online?.querySelector?.('input');
  if (onlineRadio?.checked && online?.style?.display === 'none') {
    onlineRadio.checked = false;
    form?.querySelector?.('[data-rsvp-opt="offline"] input')?.click?.();
  }
  const paxRow = root.querySelector?.('#rsvp-pax-row');
  form?.querySelectorAll?.('[name="status"]').forEach(input => input.addEventListener?.('change', () => {
    if (paxRow?.style) paxRow.style.display = input.checked && input.value === 'Hadir di Lokasi' ? '' : 'none';
  }));
  const showGiftSetting = setting('show_gift');
  const showGift = showGiftSetting !== 'false' && showGiftSetting !== false;
  const gift = root.querySelector?.('#angpao-post');
  if (gift?.style) gift.style.display = (showGift && (accounts.length || setting('shipping_address'))) || preview ? '' : 'none';
  const wishes = Array.isArray(payload.wishes) ? payload.wishes : [];
  text('#ucapan-sheet h3 span', String(wishes.length));
  all('#hero-post .bg-yt-card .flex.items-center.gap-2, #hero-post .bg-yt-card div.font-bold', `${wishes.length} Komentar`);
  const ucapanList = root.querySelector?.('#ucapan-list');
  if (ucapanList && typeof document !== 'undefined') {
    ucapanList.querySelectorAll?.('.ytw-comment-item')?.forEach(el => el.remove?.());
    const emptyState = ucapanList.querySelector?.('.flex.flex-col.items-center');
    if (emptyState?.style) emptyState.style.display = wishes.length ? 'none' : '';
    wishes.forEach(wish => {
      const card = document.createElement('div');
      card.className = 'ytw-comment-item flex gap-3 px-4 py-3 border-b border-yt-border/40';
      const avatar = document.createElement('div');
      avatar.className = 'w-8 h-8 rounded-full bg-gradient-to-br from-yt-blue/30 to-yt-red/30 flex items-center justify-center shrink-0 text-[11px] font-bold text-yt-text uppercase';
      const initial = (wish.guestName || '?').trim().charAt(0) || '?';
      avatar.textContent = initial;
      const content = document.createElement('div');
      content.className = 'flex-1 text-[13px]';
      const header = document.createElement('div');
      header.className = 'flex items-center gap-2 mb-0.5';
      const name = document.createElement('span');
      name.className = 'font-bold text-yt-text';
      name.textContent = wish.guestName || 'Tamu';
      header.append(name);
      if (wish.attendanceStatus) {
        const badge = document.createElement('span');
        badge.className = 'text-[11px] text-yt-gray';
        badge.textContent = wish.attendanceStatus === 'attending' ? '• Hadir' : wish.attendanceStatus === 'not_attending' ? '• Tidak Hadir' : '';
        if (badge.textContent) header.append(badge);
      }
      const msg = document.createElement('p');
      msg.className = 'text-yt-text leading-snug break-words';
      msg.textContent = wish.message || '';
      content.append(header, msg);
      card.append(avatar, content);
      ucapanList.append(card);
    });
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.bindYTWedding = bindYTWedding;
  document.addEventListener('DOMContentLoaded', async () => {
    const segments = location.pathname.split('/').filter(Boolean);
    const preview = segments[0] === 'api' && segments[1] === 'admin';
    const id = preview ? segments[3] : null;
    const slug = preview ? null : segments[1];
    const url = preview ? `/api/admin/invitations/${encodeURIComponent(id || '')}/preview/data` : `/api/invitations/${encodeURIComponent(slug || '')}`;
    try {
      const response = window.__INVITATION_PAYLOAD__ ? null : await fetch(url, { credentials: 'same-origin' });
      if (response && !response.ok) throw new Error('Unavailable');
      const payload = window.__INVITATION_PAYLOAD__ || await response.json();
      const guestName = new URLSearchParams(location.search).get('to') || '';
      bindYTWedding(document, payload, guestName, preview);
      document.documentElement.dataset.invitationReady = 'true';
    } catch (_) {
      const cover = document.querySelector('#welcome-cover');
      if (cover) { cover.textContent = 'Undangan belum tersedia.'; cover.setAttribute('role', 'alert'); }
    }
  });
}
