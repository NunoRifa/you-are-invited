const fs = require('fs');
const path = require('path');

const TM = 'D:/Nuno/you-are-invited-template';
const OUT_ROOT = 'D:/Nuno/you-are-invited/apps/web/public/templates';
const ASSET_PREFIX = '/template-assets';

const SLUGS = ['raden-motion', 'betawi-motion', 'arjuna-tema-foto'];

// Origins whose files were mirrored into public/template-assets/<host>/...
const MIRRORED_HOSTS = ['webinvite.id', 'unpkg.com', 'cdnjs.cloudflare.com'];

function rewriteAssetUrls(html) {
  let out = html;
  for (const host of MIRRORED_HOSTS) {
    const re = new RegExp(`https?://${host.replace(/\./g, '\\.')}/`, 'g');
    out = out.replace(re, `${ASSET_PREFIX}/${host}/`);
  }
  for (const host of MIRRORED_HOSTS) {
    const re = new RegExp(`(href|src)=(["'])//${host.replace(/\./g, '\\.')}/`, 'g');
    out = out.replace(re, `$1=$2${ASSET_PREFIX}/${host}/`);
  }
  return out;
}

function makeScriptsExecutable(html) {
  let out = html;
  out = out.replace(/<script([^>]*?)\stype=(["'])litespeed\/javascript\2/gi, '<script$1');
  out = out.replace(/<script([^>]*?)\stype=(["'])litespeed\/css\2/gi, '<script$1');
  return out;
}

function neutralizeWordPress(html) {
  let out = html;
  out = out.replace(
    /(<form[^>]*?)action=(["'])https?:\/\/webinvite\.id\/wp-comments-post\.php\2/gi,
    '$1action="#" data-wdp-origin="wp-comments-post"'
  );
  out = out.replace(
    /location\.replace\(location\.pathname\+newSearch\);return/gi,
    '/* wdp: redirect disabled for static hosting */;return'
  );
  // Unhide comment section so guests see RSVP and comments
  out = out.replace(
    /(id=['"]cui-wrap-commnent-[^'"]*['"][^>]*style=['"][^'"]*?)display:\s*none;?/gi,
    '$1display:block !important;'
  );
  out = out.replace(/class="cui-link cui-icon-link cui-icon-link-true auto-load-true"/gi, 'class="cui-link cui-icon-link cui-icon-link-true"');
  out = out.replace(/<div id="cui-box" class="cui-box">/gi, '<div id="cui-box" class="cui-box" style="display: block !important; max-height: 30vh; overflow-y: auto;">');
  out = out.replace(/<ul\s+id="cui-container-comment-[^"]*"/gi, '$& style="display: block !important;"');

  // Strip legacy WordPress WPCP (copy-protector) scripts & styles that break mobile touch, copy & click
  out = out.replace(/<script id="wpcp_disable_selection">[\s\S]*?<\/script>/gi, '');
  out = out.replace(/<script id="wpcp_disable_Right_Click">[\s\S]*?<\/script>/gi, '');
  out = out.replace(/<script id="wpcp_css_disable_selection">[\s\S]*?<\/script>/gi, '');
  out = out.replace(/<script>\s*\(function\(\)\{function stop\(e\)\{e\.preventDefault\(\);[\s\S]*?<\/script>/gi, '');
  out = out.replace(/<style>\s*\.unselectable\s*\{[\s\S]*?<\/style>/gi, '');
  out = out.replace(/<div id="wpcp-error-message"[\s\S]*?<\/style>/gi, '');
  out = out.replace(/\bunselectable\b/g, '');
  out = out.replace(/var litespeed_vary\s*=\s*document\.cookie[\s\S]*?guest\.vary\.php[\s\S]*?<\/script>/gi, '');

  // Rebrand product name: Website Invitation -> You Are Invited
  out = out.replace(/<title>Website Invitation Premium<\/title>/gi, '<title>You Are Invited Premium</title>');
  out = out.replace(/content="Website Invitation Premium"/gi, 'content="You Are Invited Premium"');
  out = out.replace(/"name":\s*"Website Invitation Premium"/gi, '"name": "You Are Invited Premium"');
  out = out.replace(/Website\.Invitation/g, 'You.Are.Invited');
  out = out.replace(/Designed By Website Invitation/g, 'Designed By You Are Invited');

  return out;
}

function injectPolyfill(html) {
  const polyfill = `
<script id="wdp-polyfill">
/* WordPress & LiteSpeed runtime polyfill */
window.wp = window.wp || { i18n: { setLocaleData: function() {}, __: function(s) { return s; } } };
window._ = window._ || {};
window.ElementorProFrontendConfig = window.ElementorProFrontendConfig || {};
window.settingAutoplay = true;
</script>
`;
  return html.replace(/<head[^>]*>/i, '$&\n' + polyfill);
}

function injectHydration(html, slug) {
  const hydration = `
<script id="wdp-hydrate">
/* You Are Invited — Data Hydration & Animation Engine */
(function () {
  var SLUG = ${JSON.stringify(slug)};
  var API = '/api/invitations/' + SLUG;

  function text(sel, val) {
    if (val === undefined || val === null || String(val).trim() === '') return;
    var el = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (el) el.textContent = String(val);
  }
  function html(sel, val) {
    if (val === undefined || val === null || String(val).trim() === '') return;
    var el = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (el) el.innerHTML = String(val);
  }
  function attr(sel, a, val) {
    if (!val) return;
    var el = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (el) el.setAttribute(a, String(val));
  }
  function each(sel, fn) {
    Array.prototype.forEach.call(document.querySelectorAll(sel), fn);
  }

  // --- Animation triggers ---
  function triggerAnimations() {
    // 1. Dispatch LiteSpeed events
    document.dispatchEvent(new Event("DOMContentLiteSpeedLoaded"));
    window.dispatchEvent(new Event("DOMContentLiteSpeedLoaded"));

    // 2. Trigger IntersectionObserver for entrance animations (.muncul, .zoom)
    var animItems = document.querySelectorAll(".muncul, .muncul-kiri, .muncul-kanan, .zoom");
    if (window.IntersectionObserver) {
      var obs = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("active");
          }
        });
      }, { rootMargin: "60px 0px 60px 0px" });
      animItems.forEach(function(it) { obs.observe(it); });
    } else {
      animItems.forEach(function(it) { it.classList.add("active"); });
    }

    // 3. Remove elementor-invisible and trigger entrance animations
    each(".elementor-invisible", function(el) {
      el.classList.remove("elementor-invisible");
      var st = el.getAttribute("data-settings");
      if (st) {
        try {
          var parsed = JSON.parse(st.replace(/&quot;/g, '"'));
          var a = parsed._animation || parsed._animation_mobile;
          if (a && a !== 'none') {
            el.classList.add("animated", a);
          }
        } catch(e) {}
      }
    });

    // 4. Ensure button has openInvi
    var openBtn = document.querySelector('.wdp-button-wrapper button');
    if (openBtn) openBtn.classList.add('openInvi');
  }

  // Run animation triggers on DOM ready & load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", triggerAnimations);
  } else {
    triggerAnimations();
  }
  window.addEventListener("load", triggerAnimations);

  // Re-trigger animations when Buka Undangan is clicked
  document.addEventListener('click', function(e) {
    if (e.target && (e.target.closest('.wdp-button-wrapper button') || e.target.closest('.openInvi'))) {
      setTimeout(triggerAnimations, 300);
      setTimeout(triggerAnimations, 1000);
    }
  });

  // --- Guest name injection ---
  function applyGuestName(defaultLabel) {
    var p = new URLSearchParams(location.search);
    var raw = p.get('to') || p.get('dear') || p.get('kepada');
    var name = raw && raw.trim() ? raw.trim() : (defaultLabel || 'Tamu Undangan');
    each('.namatamu', function(el) { el.textContent = name; });
    return name;
  }

  // --- Fetch invitation data ---
  fetch(API)
    .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function(payload) {
      var inv = payload.invitation || {};
      var couples = payload.couples || [];
      var events = payload.events || [];
      var wishes = payload.wishes || [];
      var wishSummary = payload.wishSummary || { total: 0, attending: 0, notAttending: 0, maybe: 0 };
      var gifts = payload.giftAccounts || [];
      var tf = payload.templateFields || {};

      var groom = couples.find(function(c) { return c.role === 'groom'; }) || couples[0] || {};
      var bride = couples.find(function(c) { return c.role === 'bride'; }) || couples[1] || {};

      applyGuestName(inv.coverGuestLabelDefault);
      window.__WDP_DATA__ = payload;

      var pairDisplayName = inv.coupleDisplayName || ((bride.displayName || 'Anggi') + ' & ' + (groom.displayName || 'Ivan'));

      // 1. Cover Gate
      each('.wdp-mempelai', function(el) {
        el.textContent = pairDisplayName;
      });

      // 2. Specific Template Hydrations
      if (SLUG === 'raden-motion') {
        // Hero names & date (Female first: bride -> groom)
        text('[data-id="4b0b57e"] .elementor-heading-title', bride.displayName);
        text('[data-id="08ea836"] .elementor-heading-title', groom.displayName);
        if (events[0]) text('[data-id="44bbaa4"] p', events[0].date);

        // Quote & Greeting
        if (inv.quoteText) text('[data-id="5b43713"] p', '(' + (inv.quoteSource || 'Ar-Rum 21') + ')');
        if (inv.openingGreetingText) text('[data-id="dcb69b8"] p', inv.openingGreetingText);

        // Couple profiles
        text('[data-id="20d8c21"] p', bride.displayName);
        text('[data-id="3eb9824"] p', bride.fullName);
        if (bride.fatherName) {
          var cleanBrideFather = (bride.fatherName || '').replace(/^Bapak\s+/i, '');
          var cleanBrideMother = (bride.motherName || '').replace(/^Ibu\s+/i, '');
          var cleanBrideFather = (bride.fatherName || '').replace(/^Bapak\s+/i, '');
          var cleanBrideMother = (bride.motherName || '').replace(/^Ibu\s+/i, '');
          text('[data-id="464729a"] p', (bride.birthOrderLabel || 'Putri') + ' dari Bapak ' + cleanBrideFather + (cleanBrideMother ? ' dan Ibu ' + cleanBrideMother : ''));
        }
        if (bride.instagramHandle) attr('[data-id="ba7b58b"] a', 'href', 'https://instagram.com/' + bride.instagramHandle.replace('@', ''));

        text('[data-id="621f462"] p', groom.displayName);
        text('[data-id="b44b577"] p', groom.fullName);
        if (groom.fatherName) {
          text('[data-id="9ac7612"] p', (groom.birthOrderLabel || 'Putra') + ' dari Bapak ' + groom.fatherName + ' dan Ibu ' + (groom.motherName || ''));
        }
        if (groom.instagramHandle) attr('[data-id="000ead3"] a', 'href', 'https://instagram.com/' + groom.instagramHandle.replace('@', ''));

        // Events
        if (events[0]) {
          text('[data-id="3040225"] .elementor-heading-title', events[0].date);
          text('[data-id="3d69322"] .elementor-icon-box-title', events[0].startTime + ' - ' + (events[0].endTimeLabel || 'Selesai'));
          text('[data-id="9455256"] .elementor-heading-title', events[0].venueName);
          text('[data-id="b2025a3"] .elementor-heading-title', events[0].venueAddress);
          if (events[0].mapsUrl) attr('[data-id="b5fd3d2"] a', 'href', events[0].mapsUrl);
        }

        // Gifts
        if (gifts[0]) {
          text('[data-id="6ed591f"] .elementor-heading-title', 'An. ' + gifts[0].holderName);
          text('[data-id="b60bdab"] p', gifts[0].accountNumber);
          attr('[data-id="e945266"] [data-clipboard-text]', 'data-clipboard-text', gifts[0].accountNumber);
        }

        // Closing
        text('[data-id="30a60d7"] .elementor-heading-title', (groom.displayName || 'Bang Ali') + ' & ' + (bride.displayName || 'Mpok Siti'));
      }

      if (SLUG === 'arjuna-tema-foto') {
        // Hero names & date
        text('[data-id="1560cbff"] .elementor-heading-title', (groom.displayName || 'Arjuna') + ' & ' + (bride.displayName || 'Laras'));
        if (events[0]) text('[data-id="33dc06d4"] p', events[0].date);

        // Couple
        text('[data-id="65505007"] p', bride.displayName);
        text('[data-id="3784e8b7"] p', bride.fullName);
        if (bride.fatherName) {
          text('[data-id="53d1ee8"] p', (bride.birthOrderLabel || 'Putri') + ' dari Bapak ' + bride.fatherName + ' dan Ibu ' + (bride.motherName || ''));
        }
        if (bride.instagramHandle) attr('[data-id="1838018"] a', 'href', 'https://instagram.com/' + bride.instagramHandle.replace('@', ''));

        text('[data-id="4ad2874b"] p', groom.displayName);
        text('[data-id="65648ce8"] p', groom.fullName);
        if (groom.fatherName) {
          text('[data-id="59e26c28"] p', (groom.birthOrderLabel || 'Putra') + ' dari Bapak ' + groom.fatherName + ' dan Ibu ' + (groom.motherName || ''));
        }
        if (groom.instagramHandle) attr('[data-id="61a5580f"] a', 'href', 'https://instagram.com/' + groom.instagramHandle.replace('@', ''));

        // Events
        if (events[0]) {
          text('[data-id="3bcbee05"] .elementor-heading-title', events[0].date);
          text('[data-id="3fdd85dc"] .elementor-icon-box-title', events[0].startTime + ' - ' + (events[0].endTimeLabel || 'Selesai'));
          text('[data-id="6b6c083"] .elementor-heading-title', events[0].venueName);
          text('[data-id="56efc21c"] .elementor-heading-title', events[0].venueAddress);
          if (events[0].mapsUrl) attr('[data-id="4354a7eb"] a', 'href', events[0].mapsUrl);
        }

        // Gifts
        if (gifts[0]) {
          text('[data-id="cc3c7e7"] .elementor-heading-title', 'An. ' + gifts[0].holderName);
          text('[data-id="cef3474"] p', gifts[0].accountNumber);
          attr('[data-id="abcd1d5"] [data-clipboard-text]', 'data-clipboard-text', gifts[0].accountNumber);
        }

        // Amplop digital button toggle
        var giftBtn = document.querySelector('[data-id="3045c0b"] a, [data-id="3045c0b"] button');
        var giftSection = document.querySelector('[data-id="d0211a7"]')?.closest('.elementor-section') || document.querySelector('[data-id="cc3c7e7"]')?.closest('.elementor-section');
        if (giftBtn && giftSection) {
          giftBtn.style.cursor = 'pointer';
          giftBtn.onclick = function(e) {
            e.preventDefault();
            giftSection.style.display = (giftSection.style.display === 'none' ? 'block' : 'none');
          };
        }
      }

      // Universal: Hashtag clipboard
      if (inv.hashtag) {
        each('[data-clipboard-text]', function(el) {
          var val = el.getAttribute('data-clipboard-text');
          if (val && val.charAt(0) === '#') {
            el.setAttribute('data-clipboard-text', inv.hashtag);
            var txt = el.querySelector('.elementor-button-text');
            if (txt) txt.textContent = inv.hashtag;
          }
        });
      }

      // Universal: Attendance Counters
      each('.cui_card-hadir span:first-child', function(el) { el.textContent = wishSummary.attending; });
      each('.cui_card-tidak_hadir span:first-child', function(el) { el.textContent = wishSummary.notAttending; });
      each('.cui_card-masih_ragu span:first-child', function(el) { el.textContent = wishSummary.maybe; });
      each('.header-cui a span, [id^="cui-link-"] span', function(el) { el.textContent = wishSummary.total; });

      // Universal: Live RSVP Form Intercept
      var form = document.querySelector('form[id^="commentform"]');
      if (form) {
        form.onsubmit = async function(e) {
          e.preventDefault();
          var authorEl = form.querySelector('[name="author"], #author');
          var commentEl = form.querySelector('[name="comment"], #comment, textarea');
          var statusEl = form.querySelector('[name="konfirmasi"], #konfirmasi');
          var hpEl = form.querySelector('[name="name"], .cui-hide[name="name"]');

          var author = authorEl ? authorEl.value.trim() : '';
          var comment = commentEl ? commentEl.value.trim() : '';
          var statusVal = statusEl ? statusEl.value : 'Hadir';
          var hp = hpEl ? hpEl.value : '';

          if (!author || author.length < 2) {
            alert('Mohon isi nama Anda (minimal 2 karakter)');
            return;
          }
          if (!comment || comment.length < 2) {
            alert('Mohon isi ucapan Anda (minimal 2 karakter)');
            return;
          }

          var st = 'attending';
          if (statusVal === 'Tidak hadir' || statusVal === 'Absen') st = 'not_attending';
          if (statusVal === 'Masih Ragu' || statusVal === 'Mungkin') st = 'maybe';

          try {
            var res = await fetch('/api/invitations/' + SLUG + '/wishes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                guestName: author,
                message: comment,
                attendanceStatus: st,
                website_hp: hp
              })
            });
            var json = await res.json();
            if (json.success) {
              alert('Terima kasih! Ucapan dan konfirmasi kehadiran Anda berhasil terkirim.');
              location.reload();
            } else {
              alert(json.error || 'Gagal mengirim ucapan');
            }
          } catch(err) {
            alert('Terjadi kesalahan koneksi.');
          }
        };
      }

      // Re-trigger animation once data is placed
      setTimeout(triggerAnimations, 200);
      document.dispatchEvent(new CustomEvent('wdp:hydrated', { detail: payload }));
    })
    .catch(function(e) {
      console.warn('[wdp] hydration error:', e.message);
      applyGuestName(null);
      triggerAnimations();
    });
})();
</script>`;

  return html.replace(/<\/body>/i, hydration + '\n</body>');
}

function convert(slug) {
  const src = path.join(TM, slug, 'index.html');
  let html = fs.readFileSync(src, 'utf8');

  const before = html.length;
  html = injectPolyfill(html);
  html = makeScriptsExecutable(html);
  html = rewriteAssetUrls(html);
  html = neutralizeWordPress(html);
  html = injectHydration(html, slug);

  const outDir = path.join(OUT_ROOT, slug);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');

  console.log(`${slug}: converted (${before} -> ${html.length} bytes)`);
}

for (const s of SLUGS) convert(s);
console.log('\nAll templates converted with full animation & data hydration engine.');
