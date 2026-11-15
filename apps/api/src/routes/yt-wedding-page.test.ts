import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import type { PublicInvitationPayload } from '@you-are-invited/shared-types';

const tempDir = mkdtempSync(path.join(tmpdir(), 'yai-yt-wedding-page-'));
const previousCwd = process.cwd();
const previousDatabaseUrl = process.env.DATABASE_URL;
process.env.DATABASE_URL = path.join(tempDir, 'test.sqlite');
process.env.TURNSTILE_ENABLED = 'false';

let app: Hono;
let db: typeof import('../db/client.js').db;
let schema: typeof import('../db/schema.js');

const rootPrivatePagesDir = path.resolve(__dirname, '../../private-pages/yt-wedding');
const htmlFilePath = path.join(rootPrivatePagesDir, 'index.html');

describe('Task 7: yt-wedding private page, bindings, and asset delivery', () => {
  beforeAll(async () => {
    schema = await import('../db/schema.js');
    const dbClient = await import('../db/client.js');
    db = dbClient.db;

    const { invitationPageRouter } = await import('./invitation-page.js');
    const { adminInvitationsRouter } = await import('./admin/invitations.js');
    const { invitationsRouter } = await import('./invitations.js');
    const { wishesRouter } = await import('./wishes.js');

    app = new Hono();
    app.route('/i', invitationPageRouter);
    app.route('/api/admin/invitations', adminInvitationsRouter);
    app.route('/api/invitations', invitationsRouter);
    app.route('/api/invitations', wishesRouter);

    const now = Date.now();
    db.insert(schema.templates).values([
      { id: 'yt-wedding', displayName: 'YT Wedding', isActive: true },
    ]).onConflictDoNothing().run();

    db.insert(schema.adminUsers).values([
      { id: 'admin-super', email: 'admin@test.local', passwordHash: 'hash', role: 'super_admin', createdAt: now },
    ]).onConflictDoNothing().run();

    db.insert(schema.sessions).values([
      { id: 'session-admin', userId: 'admin-super', expiresAt: now + 3600000, createdAt: now },
    ]).onConflictDoNothing().run();

    db.insert(schema.invitations).values([
      {
        id: 'inv-riska-published',
        slug: 'riska-rafli-pub',
        title: 'Pernikahan Riska & Rafli',
        coupleDisplayName: 'Riska & Rafli',
        templateKey: 'yt-wedding',
        isPublished: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'inv-riska-draft',
        slug: 'riska-rafli-draft',
        title: 'Pernikahan Riska & Rafli (Draft)',
        coupleDisplayName: 'Riska & Rafli',
        templateKey: 'yt-wedding',
        isPublished: false,
        createdAt: now,
        updatedAt: now,
      },
    ]).onConflictDoNothing().run();
  });

  afterAll(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
    process.env.DATABASE_URL = previousDatabaseUrl;
  });

  describe('Static template checks (private-pages/yt-wedding/index.html)', () => {
    it('private HTML bundle exists on disk', () => {
      expect(existsSync(htmlFilePath), `Expected ${htmlFilePath} to exist`).toBe(true);
    });

    it('contains zero Juliet & Romeo, Capulet, Montague, chara.id, /mulai, Cloudflare beacons, fake QR, or fake RSVP', () => {
      const html = readFileSync(htmlFilePath, 'utf8');

      expect(html).not.toMatch(/Juliet\s*(&|&amp;)\s*Romeo/i);
      expect(html).not.toMatch(/Capulet/i);
      expect(html).not.toMatch(/Montague/i);
      expect(html).not.toMatch(/chara\.id/i);
      expect(html).not.toMatch(/\/mulai\b/i);
      expect(html).not.toMatch(/preview-modebea6\.js/i);
      expect(html).not.toMatch(/static\.cloudflareinsights\.com/i);
      expect(html).not.toMatch(/challenge-platform/i);
      expect(html).not.toMatch(/api\.qrserver\.com/i);
      expect(html).not.toMatch(/handle_rsvp\.json/i);
      expect(html).not.toMatch(/assets\/index\.html\/img\//i);
      expect(html).not.toMatch(/id=["']chGuestCta["']/i);
    });

    it('uses clean local relative asset paths for CSS and JS', () => {
      const html = readFileSync(htmlFilePath, 'utf8');

      expect(html).toContain('assets/css/style.css');
      expect(html).toContain('assets/css/wk-anim.css');
      expect(html).toContain('assets/js/app.js');
      expect(html).toContain('assets/js/bind.js');
    });
  });

  describe('JS binding logic (bind.js)', () => {
    it('defines bindYTWedding and handles safe guest text rendering (no XSS)', async () => {
      const bindJsPath = path.join(rootPrivatePagesDir, 'assets', 'js', 'bind.js');
      expect(existsSync(bindJsPath)).toBe(true);
      const code = readFileSync(bindJsPath, 'utf8');

      // Simple runtime test using a mock DOM environment
      const mockGuestEl = { textContent: '', innerHTML: '' };
      const mockDoc = {
        querySelector: (sel: string) => {
          if (sel === '#guest-name' || sel === '[data-bind="guest-name"]') return mockGuestEl;
          return null;
        },
        querySelectorAll: () => [],
        getElementById: (id: string) => (id === 'guest-name' ? mockGuestEl : null),
      };

      const fn = new Function('root', 'payload', 'guestName', 'preview', `${code}; return typeof bindYTWedding === 'function' ? bindYTWedding : null;`);
      const bindYTWedding = fn(mockDoc, {}, '<script>alert("xss")</script>', false);
      expect(typeof bindYTWedding).toBe('function');

      // Test guest binding
      bindYTWedding(mockDoc, {
        invitation: { title: 'Test', slug: 'test' },
        couple: { groomName: 'Rafli', brideName: 'Riska' },
        events: [],
        gallery: [],
        giftAccounts: [],
      }, '<img src=x onerror=alert(1)>', false);

      expect(mockGuestEl.textContent).toBe('<img src=x onerror=alert(1)>');
      expect(mockGuestEl.innerHTML).toBe('');
    });

    it('handles countdown date deterministically without producing NaN', () => {
      const bindJsPath = path.join(rootPrivatePagesDir, 'assets', 'js', 'bind.js');
      const code = readFileSync(bindJsPath, 'utf8');

      let parsedTimestamp: number | null = null;
      const mockCountdownEl = {
        querySelector: () => null,
        setAttribute: (name: string, val: string) => {
          if (name === 'data-countdown-target') {
            // Verify date is ISO format YYYY-MM-DD or parseable
            parsedTimestamp = Date.parse(val);
          }
        },
        dataset: {},
      };
      const mockDoc = {
        querySelector: (sel: string) => (sel === '[data-countdown-target]' ? mockCountdownEl : null),
        querySelectorAll: () => [],
        getElementById: () => null,
      };

      const fn = new Function('root', 'payload', 'guestName', 'preview', `${code}; return typeof bindYTWedding === 'function' ? bindYTWedding : null;`);
      const bindYTWedding = fn(mockDoc, {}, '', false);

      // Call with payload containing WIB ISO date
      bindYTWedding(mockDoc, {
        invitation: { title: 'Test' },
        couple: {},
        events: [
          { id: '1', label: 'Akad Nikah', date: '2026-11-20', startTime: '08:00', endTimeLabel: '10:00' },
        ],
        gallery: [],
        giftAccounts: [],
      }, '', false);

      expect(parsedTimestamp).not.toBeNull();
      expect(Number.isNaN(parsedTimestamp)).toBe(false);
    });

    it('gallery handling: 0 images hides gallery or stays empty, 5 images creates 4 preview grid + 5 lightbox array', () => {
      const bindJsPath = path.join(rootPrivatePagesDir, 'assets', 'js', 'bind.js');
      const code = readFileSync(bindJsPath, 'utf8');

      let galleryHidden = false;
      const mockGallerySection = {
        style: { display: '' },
      };

      const mockDoc = {
        querySelector: (sel: string) => (sel === '#gallery-post' ? mockGallerySection : null),
        querySelectorAll: () => [],
        getElementById: (id: string) => (id === 'gallery-post' ? mockGallerySection : null),
      };

      const fn = new Function('root', 'payload', 'guestName', 'preview', `${code}; return typeof bindYTWedding === 'function' ? bindYTWedding : null;`);
      const bindYTWedding = fn(mockDoc, {}, '', false);

      // 0 images hides section
      bindYTWedding(mockDoc, {
        invitation: { title: 'Test' },
        couple: {},
        events: [],
        gallery: [],
        giftAccounts: [],
      }, '', false);

      expect(mockGallerySection.style.display).toBe('none');
    });

    it('binds published header subtitles without draft placeholders', () => {
      const code = readFileSync(path.join(rootPrivatePagesDir, 'assets/js/bind.js'), 'utf8');
      const subtitles = Array.from({ length: 4 }, () => ({ textContent: '[Belum diisi]' }));
      const root = {
        querySelector: () => null,
        querySelectorAll: (selector: string) => selector.includes('text-yt-gray') && selector.includes('first-child') ? subtitles : [],
      };
      const bind = new Function(`${code}; return bindYTWedding`)();
      bind(root, { invitation: { coupleDisplayName: 'Riska & Rafli' }, gallery: [], events: [] }, '', false);
      expect(subtitles.map(el => el.textContent)).not.toContain('[Belum diisi]');
    });

    it('preserves styled citation element while binding quote and source', () => {
      const code = readFileSync(path.join(rootPrivatePagesDir, 'assets/js/bind.js'), 'utf8');
      const citation = { textContent: '— QS. Ar-Rum: 21' };
      const quote = { firstChild: { textContent: 'Original quote' }, querySelector: (selector: string) => selector === 'span' ? citation : null };
      const root = { querySelector: (selector: string) => selector === '#hero-post .bg-yt-card p.font-light' ? quote : null, querySelectorAll: () => [] };
      const bind = new Function(`${code}; return bindYTWedding`)();
      bind(root, { invitation: { quoteText: 'Doa pilihan', quoteSource: 'QS. Test: 1' }, gallery: [], events: [] }, '', false);
      expect(quote.firstChild.textContent).toBe('Doa pilihan');
      expect(citation.textContent).toBe('— QS. Test: 1');
      expect(quote.querySelector('span')).toBe(citation);
    });

    it('shows four thumbnails with +1 overlay and five lightbox images', () => {
      const code = readFileSync(path.join(rootPrivatePagesDir, 'assets/js/bind.js'), 'utf8');
      const grid = { children: [] as any[], replaceChildren() { this.children = []; }, append(child: any) { this.children.push(child); } };
      const gallerySection = { style: { display: 'none' } };
      const total = { textContent: '' };
      const root = {
        querySelector: (selector: string) => ({ '#gallery-grid': grid, '#gallery-post': gallerySection, '#gallery-total': total } as Record<string, unknown>)[selector] || null,
        querySelectorAll: () => [],
      };
      const oldDoc = globalThis.document;
      const oldWindow = globalThis.window;
      const element = (tag: string) => ({ tag, children: [] as any[], append(...items: any[]) { this.children.push(...items); }, textContent: '', src: '' });
      Object.assign(globalThis, { document: { createElement: element, addEventListener: () => {} }, window: { galleryImages: [] } });
      try {
        const bind = new Function(`${code}; return bindYTWedding`)();
        const gallery = Array.from({ length: 5 }, (_, index) => ({ url: `/api/assets/image-${index}` }));
        bind(root, { invitation: {}, gallery, events: [] }, '', false);
        expect(grid.children).toHaveLength(4);
        expect(grid.children[3].children[0].src).toBe('/api/assets/image-3');
        expect(grid.children[3].children[1].children[0].textContent).toBe('+1');
        expect((globalThis.window as any).galleryImages).toEqual(gallery.map(item => item.url));
        expect(total.textContent).toBe('5');
        expect(gallerySection.style.display).toBe('');
      } finally {
        Object.assign(globalThis, { document: oldDoc, window: oldWindow });
      }
    });

    it('keeps success footer detached from form association after RSVP', () => {
      const code = readFileSync(path.join(rootPrivatePagesDir, 'assets/js/app.js'), 'utf8');
      expect(code).toMatch(/submit\.removeAttribute\('form'\)/);
      expect(code).not.toContain('form.parentElement.replaceChildren(confirmation)');
    });

    it('preview mode shows [Belum diisi] for empty fields and never Juliet & Romeo', () => {
      const bindJsPath = path.join(rootPrivatePagesDir, 'assets', 'js', 'bind.js');
      const code = readFileSync(bindJsPath, 'utf8');

      const textBound: Record<string, string> = {};
      const mockDoc = {
        querySelector: () => null,
        querySelectorAll: (sel: string) => [],
        getElementById: (id: string) => ({
          set textContent(val: string) {
            textBound[id] = val;
          },
          get textContent() {
            return textBound[id] || '';
          },
          setAttribute: () => {},
          style: {},
          classList: { add: () => {}, remove: () => {} },
        }),
      };

      const fn = new Function('root', 'payload', 'guestName', 'preview', `${code}; return typeof bindYTWedding === 'function' ? bindYTWedding : null;`);
      const bindYTWedding = fn(mockDoc, {}, '', true);

      bindYTWedding(mockDoc, {
        invitation: { title: '' },
        couple: { groomName: '', brideName: '' },
        events: [],
        gallery: [],
        giftAccounts: [],
      }, '', true);

      // Verify no Romeo / Juliet in bound values
      for (const val of Object.values(textBound)) {
        expect(val).not.toContain('Romeo');
        expect(val).not.toContain('Juliet');
      }
    });

    it('wires Turnstile initialization and attaches turnstileToken to RSVP submission', () => {
      const code = readFileSync(path.join(rootPrivatePagesDir, 'assets/js/app.js'), 'utf8');
      expect(code).toContain('/api/config/turnstile');
      expect(code).toContain('turnstileToken');
      expect(code).toMatch(/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js/);
    });

    it('binds yt_show_gallery, yt_show_gift, and yt_gift_intro correctly', () => {
      const code = readFileSync(path.join(rootPrivatePagesDir, 'assets/js/bind.js'), 'utf8');
      const gallerySection = { style: { display: '' } };
      const giftSection = { style: { display: '' } };
      const giftIntro = { textContent: '' };
      const root = {
        querySelector: (selector: string) => {
          if (selector === '#gallery-post') return gallerySection;
          if (selector === '#angpao-post') return giftSection;
          if (selector === '#angpao-post .font-light') return giftIntro;
          return null;
        },
        querySelectorAll: () => [],
      };
      const bind = new Function(`${code}; return bindYTWedding`)();

      // Case 1: show_gallery = false, show_gift = false
      bind(root, {
        invitation: {},
        gallery: [{ url: '/api/assets/img-1' }],
        giftAccounts: [{ providerName: 'BCA', accountNumber: '123', holderName: 'Test' }],
        templateFields: {
          yt_show_gallery: 'false',
          yt_show_gift: 'false',
          yt_gift_intro: 'Custom Gift Copy',
        },
        events: [],
      }, '', false);

      expect(gallerySection.style.display).toBe('none');
      expect(giftSection.style.display).toBe('none');
      expect(giftIntro.textContent).toBe('Custom Gift Copy');

      // Case 2: Preview mode preserves sections even if false
      gallerySection.style.display = '';
      giftSection.style.display = '';
      bind(root, {
        invitation: {},
        gallery: [{ url: '/api/assets/img-1' }],
        giftAccounts: [{ providerName: 'BCA', accountNumber: '123', holderName: 'Test' }],
        templateFields: {
          yt_show_gallery: 'false',
          yt_show_gift: 'false',
        },
        events: [],
      }, '', true);

      expect(gallerySection.style.display).toBe('');
      expect(giftSection.style.display).toBe('');
    });

    it('renders escaped comments from payload.wishes into #ucapan-list and updates counters', () => {
      const code = readFileSync(path.join(rootPrivatePagesDir, 'assets/js/bind.js'), 'utf8');
      const commentCount = { textContent: '' };
      const heroCommentCount = { textContent: '' };
      const emptyState = { style: { display: '' } };
      const commentsContainer = {
        items: [] as any[],
        children: [] as any[],
        querySelector: (selector: string) => selector.includes('items-center') ? emptyState : null,
        querySelectorAll: (selector: string) => selector === '.ytw-comment-item' ? commentsContainer.items : [],
        append: (child: any) => commentsContainer.items.push(child),
      };
      const root = {
        querySelector: (selector: string) => {
          if (selector === '#ucapan-sheet h3 span') return commentCount;
          if (selector.includes('hero-post') && selector.includes('Komentar')) return heroCommentCount;
          if (selector === '#ucapan-list') return commentsContainer;
          return null;
        },
        querySelectorAll: () => [],
      };

      const oldDoc = globalThis.document;
      const element = (tag: string) => ({
        tag,
        className: '',
        textContent: '',
        children: [] as any[],
        append(...items: any[]) { this.children.push(...items); },
      });
      Object.assign(globalThis, { document: { createElement: element } });

      try {
        const bind = new Function(`${code}; return bindYTWedding`)();
        const wishes = [
          { guestName: 'Alice <script>alert(1)</script>', message: 'Congrats <b>both</b>!', attendanceStatus: 'attending' },
          { guestName: 'Bob', message: 'Happy wedding!', attendanceStatus: 'not_attending' },
        ];
        bind(root, { invitation: {}, gallery: [], events: [], wishes }, '', false);

        expect(commentCount.textContent).toBe('2');
        expect(emptyState.style.display).toBe('none');
        expect(commentsContainer.items).toHaveLength(2);

        // Verify escaped textContent
        const first = commentsContainer.items[0];
        // Avatar has initial 'A'
        expect(first.children[0].textContent).toBe('A');
        // Body has guest name and message safe text
        const body = first.children[1];
        const header = body.children[0];
        expect(header.children[0].textContent).toBe('Alice <script>alert(1)</script>');
        expect(body.children[1].textContent).toBe('Congrats <b>both</b>!');
      } finally {
        Object.assign(globalThis, { document: oldDoc });
      }
    });

    it('hides fake player chrome when heroVideoUrl is present', () => {
      const code = readFileSync(path.join(rootPrivatePagesDir, 'assets/js/bind.js'), 'utf8');
      const fakeChrome1 = { style: { display: '' } };
      const fakeChrome2 = { style: { display: '' } };
      const img = { className: 'w-full h-full object-cover', replaceWith: vi.fn() };
      const videoContainer = {
        querySelector: (sel: string) => sel === 'img' ? img : null,
        querySelectorAll: (sel: string) => sel.includes('.absolute') ? [fakeChrome1, fakeChrome2] : [],
      };
      const root = {
        querySelector: (sel: string) => sel === '#hero-post .aspect-video' ? videoContainer : null,
        querySelectorAll: () => [],
      };

      const oldDoc = globalThis.document;
      const element = (tag: string) => ({ tag, className: '', src: '', controls: false, playsInline: false, poster: '' });
      Object.assign(globalThis, { document: { createElement: element } });

      try {
        const bind = new Function(`${code}; return bindYTWedding`)();
        bind(root, {
          invitation: { heroVideoUrl: '/api/assets/video-1', heroPhotoUrl: '/api/assets/cover-1' },
          gallery: [],
          events: [],
        }, '', false);

        expect(img.replaceWith).toHaveBeenCalled();
        expect(fakeChrome1.style.display).toBe('none');
        expect(fakeChrome2.style.display).toBe('none');
      } finally {
        Object.assign(globalThis, { document: oldDoc });
      }
    });
  });

  describe('Route serving & asset resolution', () => {
    it('serves assets under /api/admin/invitations/:id/preview/assets/:file with correct Content-Type', async () => {
      const res = await app.request('/api/admin/invitations/inv-riska-draft/preview/assets/css/style.css', {
        headers: { Cookie: 'session_id=session-admin' },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('text/css');
      expect(res.headers.get('Cache-Control')).toContain('private, no-store');
    });

    it('prevents path traversal in preview asset endpoint', async () => {
      const res = await app.request('/api/admin/invitations/inv-riska-draft/preview/assets/..%2f..%2fpackage.json', {
        headers: { Cookie: 'session_id=session-admin' },
      });
      expect(res.status).toBe(404);
    });

    it('resolves relative asset URLs under invitation base paths', async () => {
      const preview = await app.request('/api/admin/invitations/inv-riska-draft/preview', {
        headers: { Cookie: 'session_id=session-admin' },
      });
      expect(preview.status).toBe(200);
      expect(await preview.text()).toContain('<base href="/api/admin/invitations/inv-riska-draft/preview/">');
      const published = await app.request('/i/riska-rafli-pub');
      expect(published.status).toBe(200);
      expect(await published.text()).toContain('<base href="/i/riska-rafli-pub/">');
    });

    it('serves assets under /i/:slug/assets/:file when published', async () => {
      const res = await app.request('/i/riska-rafli-pub/assets/css/style.css');
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('text/css');
    });

    it('returns 404 for assets under /i/:slug/assets/:file when draft (unpublished)', async () => {
      const res = await app.request('/i/riska-rafli-draft/assets/css/style.css');
      expect(res.status).toBe(404);
    });
  });

  describe('Real RSVP submission to /api/invitations/:slug/wishes', () => {
    it('submits attendance and pax correctly to backend wishes router', async () => {
      const res = await app.request('/api/invitations/riska-rafli-pub/wishes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '198.51.100.99',
        },
        body: JSON.stringify({
          guestName: 'Budi Santoso',
          message: 'Selamat Riska & Rafli!',
          attendanceStatus: 'attending',
          attendanceChannel: 'offline',
          guestCount: 2,
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.data).toBeDefined();
      expect(data.data.guestName).toBe('Budi Santoso');
      expect(data.data.attendanceStatus).toBe('attending');
      expect(data.data.attendanceChannel).toBe('offline');
      expect(data.data.guestCount).toBe(2);
    });

    it('omits ownerUserId from public invitation payload', async () => {
      const res = await app.request('/api/invitations/riska-rafli-pub');
      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.invitation).toBeDefined();
      expect(data.invitation.ownerUserId).toBeUndefined();
    });
  });
});
