import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

const bundle = path.resolve(__dirname, '../../private-pages/yt-wedding');
const html = readFileSync(path.join(bundle, 'index.html'), 'utf8');
const bindCode = readFileSync(path.join(bundle, 'assets/js/bind.js'), 'utf8');

// Removing these source controls is a user-visible regression, not a redesign permission.
describe('yt-wedding source fidelity', () => {
  it('keeps interactive modal content out of scroll entrance delays while retaining page animation', () => {
    const script = readFileSync(path.join(bundle, 'assets/js/wk-anim.js'), 'utf8');
    const elements = ['rsvp-modal', 'ucapan-modal', 'hero-post'].map(id => {
      const openingTag = html.match(new RegExp(`<div id="${id}"[^>]*>`))?.[0] || '';
      const attributes = new Map<string, string>();
      return {
        className: '', style: { setProperty: () => {} },
        hasAttribute: (name: string) => attributes.has(name),
        setAttribute: (name: string, value: string) => attributes.set(name, value),
        closest: () => openingTag.includes('data-wk-anim-skip') ? {} : null,
        classList: { add: () => {} }, attributes,
      };
    });
    const document = {
      readyState: 'complete',
      querySelector: () => null,
      querySelectorAll: (selector: string) => selector.startsWith('img:') ? elements : [],
    };
    new Function('window', 'document', 'getComputedStyle', script)({}, document, () => ({ position: 'static' }));
    expect(elements[0].attributes.has('data-wk-anim')).toBe(false);
    expect(elements[1].attributes.has('data-wk-anim')).toBe(false);
    expect(elements[2].attributes.get('data-wk-anim')).toBe('fade');
  });

  it('places every toast above interactive sheets including reused notifications', () => {
    const nodes = new Map<string, any>();
    const element = () => {
      const node: any = { style: {} as Record<string, string>, className: '', textContent: '', setAttribute: () => {}, addEventListener: () => {} };
      node.classList = {
        add: (name: string) => { if (!node.className.split(/\s+/).includes(name)) node.className = `${node.className} ${name}`.trim(); },
        remove: (name: string) => { node.className = node.className.split(/\s+/).filter((token: string) => token !== name).join(' '); },
        replace: (oldName: string, newName: string) => { if (node.className.split(/\s+/).includes(oldName)) { node.classList.remove(oldName); node.classList.add(newName); return true; } return false; },
      };
      return node;
    };
    for (const name of ['rsvp', 'ucapan', 'kontribusi', 'rekening']) nodes.set(`${name}-modal`, element());
    const window: any = {};
    let toastTimerCallback: (() => void) | undefined;
    const document = {
      addEventListener: (event: string, callback: () => void) => { if (event === 'DOMContentLoaded') callback(); },
      getElementById: (id: string) => nodes.get(id), querySelector: () => null, querySelectorAll: () => [],
      createElement: element, body: { style: {}, append: (node: any) => nodes.set(node.id, node) },
    };
    const script = readFileSync(path.join(bundle, 'assets/js/app.js'), 'utf8');
    new Function('window', 'document', 'fetch', 'requestAnimationFrame', 'setTimeout', 'clearTimeout', script)(
      window, document, async () => ({ ok: true, json: async () => ({ enabled: false }) }), (cb: () => void) => cb(), (cb: () => void) => { toastTimerCallback = cb; return 1; }, () => {},
    );
    window.openRekening();
    window.showToast('Berhasil disalin');
    const toast = nodes.get('toast-notification');
    expect(Number(toast.style.zIndex)).toBeGreaterThan(Number(nodes.get('rekening-modal').style.zIndex));
    expect(toast.style.opacity).toBe('1');
    window.showToast('Gagal menyalin');
    expect(nodes.get('toast-notification')).toBe(toast);
    expect(toast.textContent).toBe('Gagal menyalin');
    expect(toast.style.opacity).toBe('1');
    expect(Number(toast.style.zIndex)).toBeGreaterThan(10000);
    toastTimerCallback?.();
    expect(toast.style.opacity).toBe('0');
  });

  it('retains original still-image hero progress and timestamp chrome', () => {
    const hero = html.slice(html.indexOf('id="hero-post"'), html.indexOf('id="mempelai-post"'));
    expect(hero).toContain('absolute bottom-0 left-0 w-full h-1 bg-white/30');
    expect(hero).toContain('h-full bg-yt-red w-1/3 relative');
    expect(hero).toContain('1:24 / 4:05');
  });

  it('retains original music mini-player pulse bar and play/close icons', () => {
    const player = html.slice(html.indexOf('id="btn-musicToggle"'));
    expect(player).toContain('absolute top-0 left-0 w-full h-[2px] bg-yt-gray/30');
    expect(player).toContain('h-full bg-yt-red w-1/3 animate-pulse');
    expect(player).toContain('fa-solid fa-play');
    expect(player).toContain('fa-solid fa-xmark');
  });

  it('keeps original custom stylesheet rules exactly (ignoring checkout line endings)', () => {
    const css = readFileSync(path.join(bundle, 'assets/css/style.css'), 'utf8').replace(/\r\n/g, '\n');
    expect(createHash('sha256').update(css).digest('hex')).toBe('50eb436a9eeb9806e64bd06d6917ca19e85f87a76354ec1a09cd418eb9b331c1');
  });

  it('renders a single custom-named event instead of silently dropping valid event data', () => {
    const title = { textContent: 'Akad Nikah' };
    const card = { style: { display: 'none' }, querySelector: (selector: string) => selector === 'h3' ? title : null, querySelectorAll: () => [] };
    const otherCard = { style: { display: '' }, querySelector: () => null, querySelectorAll: () => [] };
    const root = {
      querySelector: (selector: string) => selector === '[data-event="akad"]' ? card : selector === '[data-event="resepsi"]' ? otherCard : null,
      querySelectorAll: () => [],
    };
    const bind = new Function(`${bindCode}; return bindYTWedding`)();
    bind(root, { invitation: {}, events: [{ id: 'custom', label: 'Acara Keluarga', date: '2026-12-20', startTime: '09:00' }], gallery: [] }, '', false);
    expect(card.style.display).toBe('');
    expect(title.textContent).toBe('Acara Keluarga');
    expect(otherCard.style.display).toBe('none');
  });

  it('formats event date and time like source without duplicating timezone', () => {
    const lines = Array.from({ length: 3 }, () => ({ textContent: '', querySelector: () => null }));
    const card = { style: { display: '' }, querySelector: () => null, querySelectorAll: () => lines };
    const root = { querySelector: (selector: string) => selector === '[data-event="akad"]' ? card : null, querySelectorAll: () => [] };
    const bind = new Function(`${bindCode}; return bindYTWedding`)();
    bind(root, { invitation: {}, events: [{ label: 'Akad Nikah', date: '2026-12-20', startTime: '08:00', endTimeLabel: '10:00 WIB', venueName: 'Gedung Verona' }], gallery: [] }, '', false);
    expect(lines[0].textContent.trim()).toBe('Minggu, 20 Desember 2026');
    expect(lines[1].textContent.trim()).toBe('08.00 - 10.00 WIB');
  });

  it('applies valid focal axes only to hero still image with independent safe defaults', () => {
    const bind = new Function(`${bindCode}; return bindYTWedding`)();
    for (const [x, y, expected] of [
      ['0', '27.5', '0% 27.5%'], [undefined, undefined, '50% 50%'],
      ['', null, '50% 50%'], ['101', '0', '50% 0%'],
      ['-1', '100', '50% 100%'], ['Infinity', 'NaN', '50% 50%'],
      ['0; color:red', '20', '50% 20%'], [false, [], '50% 50%'],
    ]) {
      const hero = { style: { objectPosition: '' } };
      const avatar = { style: { objectPosition: '40% 60%' } };
      const root = { querySelector: (s: string) => s === '#hero-post .aspect-video > img' ? hero : null, querySelectorAll: () => [] };
      bind(root, { templateFields: { yt_hero_photo_position_x: x, yt_hero_photo_position_y: y } }, '', false);
      expect(hero.style.objectPosition).toBe(expected);
      expect(avatar.style.objectPosition).toBe('40% 60%');
    }
  });

  it('renders existing parent salutations literally in profile and closing', () => {
    const nodes = new Map<string, { textContent: string }>();
    for (const [pos, suffix] of [[1, 'mb-4'], [2, 'mt-4']]) {
      nodes.set(`#mempelai-post .grid.grid-cols-2 > div:nth-child(${pos}) p`, { textContent: '' });
      nodes.set(`#penutup-post .bg-yt-card .${suffix} .text-yt-gray`, { textContent: '' });
    }
    const bind = new Function(`${bindCode}; return bindYTWedding`)();
    bind({ querySelector: (s: string) => nodes.get(s), querySelectorAll: () => [] }, { couples: [
      { role: 'groom', fatherName: 'Bapak Ayah Contoh', motherName: 'Ibu Bunda Contoh' },
      { role: 'bride', fatherName: 'Bapak Ayah Sampel', motherName: 'Ibu Bunda Sampel' },
    ] }, '', false);
    expect([...nodes.values()].map(n => n.textContent)).toEqual([
      'Putra dari Bapak Ayah Contoh & Ibu Bunda Contoh', 'Putra dari Bapak Ayah Contoh & Ibu Bunda Contoh',
      'Putri dari Bapak Ayah Sampel & Ibu Bunda Sampel', 'Putri dari Bapak Ayah Sampel & Ibu Bunda Sampel',
    ]);
  });

  it('preserves verification icons when inserting couple name', () => {
    const icon = { className: 'fa-solid fa-circle-check' };
    const node = { textContent: 'Sample name' };
    const heading = { firstChild: node, children: [icon], textContent: '', querySelector: () => icon };
    const root = { querySelector: (selector: string) => selector === '#hero-post .font-bold.text-\\[15px\\]' ? heading : null, querySelectorAll: () => [] };
    const bind = new Function(`${bindCode}; return bindYTWedding`)();
    bind(root, { invitation: { coupleDisplayName: 'Riska & Rafli' }, events: [], gallery: [] }, '', false);
    expect(node.textContent).toBe('Riska & Rafli');
    expect(heading.children).toEqual([icon]);
  });
});
