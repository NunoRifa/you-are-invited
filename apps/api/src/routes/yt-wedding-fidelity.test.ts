import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

const bundle = path.resolve(__dirname, '../../private-pages/yt-wedding');
const html = readFileSync(path.join(bundle, 'index.html'), 'utf8');
const bindCode = readFileSync(path.join(bundle, 'assets/js/bind.js'), 'utf8');

// Removing these source controls is a user-visible regression, not a redesign permission.
describe('yt-wedding source fidelity', () => {
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
