document.addEventListener('DOMContentLoaded', () => {
  const get = id => document.getElementById(id);
  const modalIds = ['rsvp', 'ucapan', 'kontribusi', 'rekening'];
  const open = name => {
    const modal = get(`${name}-modal`);
    if (!modal) return;
    modal.classList.remove('hidden');
    requestAnimationFrame(() => modal.classList.add('modal-open'));
    document.body.style.overflow = 'hidden';
  };
  const close = name => {
    const modal = get(`${name}-modal`);
    if (!modal) return;
    modal.classList.remove('modal-open');
    setTimeout(() => modal.classList.add('hidden'), 300);
    document.body.style.overflow = '';
  };
  for (const name of modalIds) {
    get(`${name}-backdrop`)?.addEventListener('click', () => close(name));
    get(`btn-close-${name}`)?.addEventListener('click', () => close(name));
  }
  get('fab-rsvp-center')?.addEventListener('click', () => open('rsvp'));
  get('fab-rsvp')?.addEventListener('click', () => open('rsvp'));
  document.querySelector('.btn-nav-ucapan')?.addEventListener('click', () => open('ucapan'));
  window.openUcapan = () => open('ucapan');
  window.openKontribusi = () => open('kontribusi');
  window.closeKontribusi = () => close('kontribusi');
  window.openRekening = () => open('rekening');
  window.closeRekening = () => close('rekening');
  document.querySelectorAll('.nav-item[data-target]').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(nav => { nav.classList.remove('text-yt-text'); nav.classList.add('text-yt-gray'); });
      item.classList.replace('text-yt-gray', 'text-yt-text');
      const target = item.dataset.target;
      if (target === 'hero-container') window.scrollTo({ top: 0, behavior: 'smooth' });
      else {
        const element = get(target);
        if (element) window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY - 56, behavior: 'smooth' });
      }
    });
  });
  let toastTimer;
  window.showToast = message => {
    let toast = get('toast-notification');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast-notification';
      toast.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 bg-yt-text text-yt-bg font-semibold px-5 py-2.5 rounded-full text-[14px] shadow-xl z-[400] opacity-0 pointer-events-none transition-all duration-400';
      toast.setAttribute('role', 'status');
      document.body.append(toast);
    }
    toast.textContent = message;
    toast.classList.replace('opacity-0', 'opacity-100');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.replace('opacity-100', 'opacity-0'), 3000);
  };
  window.copyRek = async number => {
    try { await navigator.clipboard.writeText(number); window.showToast('✓ Berhasil Disalin'); }
    catch (_) { window.showToast('Gagal menyalin. Silakan salin secara manual.'); }
  };
  const audio = get('bg-music');
  const musicButton = get('btn-musicToggle');
  const icon = musicButton?.querySelector('.fa-play, .fa-pause');
  function syncMusic() {
    icon?.classList.toggle('fa-play', audio?.paused !== false);
    icon?.classList.toggle('fa-pause', audio?.paused === false);
  }
  async function revealInvitation() {
    if (document.documentElement.dataset.invitationReady !== 'true') return;
    const cover = get('welcome-cover');
    if (cover.classList.contains('hidden') || cover.style.opacity === '0') return;
    cover.style.opacity = '0';
    cover.style.pointerEvents = 'none';
    setTimeout(() => cover.classList.add('hidden'), 700);
    if (audio?.querySelector('source[src]')?.getAttribute('src')) {
      musicButton?.classList.remove('translate-y-[100%]', 'pointer-events-none');
      musicButton?.classList.add('translate-y-0', 'pointer-events-auto');
      try { await audio.play(); } catch (_) { window.showToast('Ketuk pemutar untuk musik.'); }
      syncMusic();
    }
  }
  get('btn-open-invitation')?.addEventListener('click', revealInvitation);
  get('btn-cover-play')?.addEventListener('click', revealInvitation);
  musicButton?.addEventListener('click', async event => {
    if (event.target.closest('.fa-xmark')) {
      audio?.pause(); musicButton.classList.remove('translate-y-0', 'pointer-events-auto'); musicButton.classList.add('translate-y-[100%]', 'pointer-events-none'); return;
    }
    if (!audio?.querySelector('source[src]')?.getAttribute('src')) return;
    if (audio.paused) { try { await audio.play(); } catch (_) { window.showToast('Audio tidak tersedia.'); } }
    else audio.pause();
    syncMusic();
  });
  const paxInput = get('rsvp-pax-input');
  const paxDisplay = get('rsvp-pax-display');
  function stepPax(delta) {
    if (!paxInput) return;
    paxInput.value = String(Math.max(1, Math.min(10, Number(paxInput.value || 1) + delta)));
    if (paxDisplay) paxDisplay.textContent = paxInput.value;
  }
  get('rsvp-pax-dec')?.addEventListener('click', () => stepPax(-1));
  get('rsvp-pax-inc')?.addEventListener('click', () => stepPax(1));

  const turnstileReady = (async () => {
    try {
      const res = await fetch('/api/config/turnstile');
      const cfg = res.ok ? await res.json() : null;
      if (!cfg || !cfg.enabled || !cfg.siteKey) return null;
      return new Promise(resolve => {
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        script.onload = () => {
          if (!window.turnstile) return resolve(null);
          const holder = get('ytw-turnstile') || document.createElement('div');
          if (!holder.parentElement) {
            holder.style.display = 'none';
            (document.body || document.documentElement).appendChild(holder);
          }
          let token = '';
          let pending = null;
          const widgetId = window.turnstile.render(holder, {
            sitekey: cfg.siteKey,
            action: 'wishes',
            callback: t => { token = t; if (pending) { pending(t); pending = null; } },
            'expired-callback': () => { token = ''; },
            'error-callback': () => { token = ''; if (pending) { pending(''); pending = null; } },
          });
          resolve({
            getToken: () => new Promise(res => {
              if (token) { const t = token; token = ''; res(t); return; }
              pending = res;
              try { window.turnstile.execute(widgetId); } catch (_) { pending = null; res(''); }
            }),
            reset: () => { token = ''; try { window.turnstile.reset(widgetId); } catch (_) {} },
          });
        };
        script.onerror = () => resolve(null);
        document.head.appendChild(script);
      });
    } catch (_) { return null; }
  })();

  async function getTurnstileToken() {
    try {
      const widget = await turnstileReady;
      return widget ? await widget.getToken() : '';
    } catch (_) { return ''; }
  }

  const form = get('form-rsvp');
  form?.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = get('btn-post-rsvp');
    if (submit.disabled) return;
    const status = form.querySelector('[name="status"]:checked')?.value;
    const guestCount = Number(paxInput?.value || 1);
    const body = {
      guestName: (form.elements.fullName.value || '').trim(),
      message: (form.elements.notes.value || '').trim(),
      attendanceStatus: status === 'Tidak Hadir' ? 'not_attending' : 'attending',
      ...(status === 'Tidak Hadir' ? {} : { attendanceChannel: status === 'Hadir Online' ? 'online' : 'offline', guestCount: status === 'Hadir Online' ? 1 : guestCount }),
      website_hp: '',
    };
    if (!body.guestName || !body.message || guestCount < 1 || guestCount > 10 || !Number.isInteger(guestCount)) { window.showToast('Lengkapi nama, ucapan, dan jumlah tamu (1–10).'); return; }
    const slug = form.dataset.invitationSlug;
    if (!slug || !/^[a-zA-Z0-9_-]+$/.test(slug)) { window.showToast('Undangan tidak tersedia.'); return; }
    submit.disabled = true;
    const label = submit.textContent;
    submit.textContent = 'Mengirim...';
    try {
      const turnstileToken = await getTurnstileToken();
      if (turnstileToken) body.turnstileToken = turnstileToken;
      const response = await fetch(`/api/invitations/${encodeURIComponent(slug)}/wishes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal mengirim RSVP.');
      (await turnstileReady)?.reset?.();

      const ucapanList = get('ucapan-list');
      if (ucapanList) {
        const emptyState = ucapanList.querySelector('.flex.flex-col.items-center');
        if (emptyState?.style) emptyState.style.display = 'none';
        const card = document.createElement('div');
        card.className = 'ytw-comment-item flex gap-3 px-4 py-3 border-b border-yt-border/40';
        const avatar = document.createElement('div');
        avatar.className = 'w-8 h-8 rounded-full bg-gradient-to-br from-yt-blue/30 to-yt-red/30 flex items-center justify-center shrink-0 text-[11px] font-bold text-yt-text uppercase';
        avatar.textContent = (body.guestName || '?').trim().charAt(0) || '?';
        const content = document.createElement('div');
        content.className = 'flex-1 text-[13px]';
        const header = document.createElement('div');
        header.className = 'flex items-center gap-2 mb-0.5';
        const name = document.createElement('span');
        name.className = 'font-bold text-yt-text';
        name.textContent = body.guestName;
        header.append(name);
        if (body.attendanceStatus) {
          const badge = document.createElement('span');
          badge.className = 'text-[11px] text-yt-gray';
          badge.textContent = body.attendanceStatus === 'attending' ? '• Hadir' : '• Tidak Hadir';
          header.append(badge);
        }
        const msg = document.createElement('p');
        msg.className = 'text-yt-text leading-snug break-words';
        msg.textContent = body.message;
        content.append(header, msg);
        card.append(avatar, content);
        const trigger = ucapanList.firstElementChild;
        if (trigger?.nextSibling) ucapanList.insertBefore(card, trigger.nextSibling);
        else ucapanList.append(card);
        const countSpan = document.querySelector('#ucapan-sheet h3 span');
        if (countSpan) countSpan.textContent = String(Number(countSpan.textContent || 0) + 1);
        document.querySelectorAll('#hero-post .bg-yt-card .flex.items-center.gap-2, #hero-post .bg-yt-card div.font-bold').forEach(el => {
          el.textContent = `${countSpan?.textContent || 1} Komentar`;
        });
      }

      const confirmation = document.createElement('div');
      confirmation.className = 'px-5 pt-6 pb-4 text-center';
      const title = document.createElement('h4'); title.className = 'text-yt-text font-bold text-[17px] mb-2 leading-tight'; title.textContent = 'Konfirmasi diterima';
      const message = document.createElement('p'); message.className = 'text-yt-gray text-[13px] leading-snug mb-5'; message.textContent = `${body.guestName}, terima kasih atas konfirmasi dan doa Anda.`;
      confirmation.append(title, message);
      form.replaceChildren(confirmation);
      submit.removeAttribute('form');
      submit.disabled = false;
      submit.textContent = 'Tutup'; submit.type = 'button'; submit.addEventListener('click', () => close('rsvp'));
      window.showToast('Konfirmasi RSVP terkirim.');
    } catch (error) {
      (await turnstileReady)?.reset?.();
      window.showToast(error instanceof Error ? error.message : 'Ada gangguan jaringan. Coba lagi.');
      submit.disabled = false; submit.textContent = label;
    }
  });
  get('form-kontribusi')?.addEventListener('submit', event => { event.preventDefault(); window.showToast('Kontribusi belum tersedia.'); });
  const modal = get('gallery-modal');
  const galleryImage = get('gallery-main-img');
  let currentIndex = 0;
  let transitionTimer;
  function showImage() {
    const images = window.galleryImages || [];
    if (!images.length || !galleryImage) return;
    galleryImage.classList.add('opacity-0');
    clearTimeout(transitionTimer);
    transitionTimer = setTimeout(() => {
      galleryImage.src = images[currentIndex];
      get('gallery-counter').textContent = String(currentIndex + 1);
      get('gallery-total').textContent = String(images.length);
      galleryImage.classList.remove('opacity-0');
    }, 200);
  }
  window.openGallery = index => {
    const images = window.galleryImages || [];
    if (!images.length || !modal) return;
    currentIndex = Number.isInteger(index) && index >= 0 && index < images.length ? index : 0;
    showImage(); modal.classList.remove('hidden'); modal.classList.add('flex');
    requestAnimationFrame(() => { modal.classList.remove('opacity-0', 'pointer-events-none'); modal.classList.add('opacity-100', 'pointer-events-auto'); });
    document.body.style.overflow = 'hidden';
  };
  window.closeGallery = () => {
    if (!modal) return;
    modal.classList.remove('opacity-100', 'pointer-events-auto'); modal.classList.add('opacity-0', 'pointer-events-none');
    setTimeout(() => { modal.classList.remove('flex'); modal.classList.add('hidden'); }, 300);
    document.body.style.overflow = '';
  };
  window.nextGalleryImage = () => { if (window.galleryImages?.length) { currentIndex = (currentIndex + 1) % window.galleryImages.length; showImage(); } };
  window.prevGalleryImage = () => { if (window.galleryImages?.length) { currentIndex = (currentIndex - 1 + window.galleryImages.length) % window.galleryImages.length; showImage(); } };
  document.addEventListener('keydown', event => {
    if (!modal?.classList.contains('flex')) return;
    if (event.key === 'Escape') window.closeGallery();
    if (event.key === 'ArrowLeft') window.prevGalleryImage();
    if (event.key === 'ArrowRight') window.nextGalleryImage();
  });
});
