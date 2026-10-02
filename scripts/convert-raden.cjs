const fs = require('fs');
const path = require('path');

const srcFile = 'D:/Nuno/you-are-invited-template/raden-motion/index.html';
const destFile = 'D:/Nuno/you-are-invited/apps/web/public/templates/raden-motion/index.html';

let html = fs.readFileSync(srcFile, 'utf8');

// 1. Polyfill window.wp and environment in <head>
const polyfill = `
<script>
window.wp = window.wp || { i18n: { setLocaleData: function() {}, __: function(s) { return s; } } };
window._ = window._ || {};
window.settingAutoplay = true;
</script>
`;
html = html.replace(/<head[^>]*>/i, '$&\n' + polyfill);

// 2. Rewrite ALL external URLs to local mirror
html = html.replace(/https?:\/\/webinvite\.id\//g, '/template-assets/webinvite.id/');
html = html.replace(/https?:\/\/unpkg\.com\//g, '/template-assets/unpkg.com/');
html = html.replace(/https?:\/\/cdnjs\.cloudflare\.com\//g, '/template-assets/cdnjs.cloudflare.com/');

// 3. Make litespeed scripts standard executable scripts
html = html.replace(/<script([^>]*?)\stype=(["'])litespeed\/javascript\2/gi, '<script$1');
html = html.replace(/<script([^>]*?)\stype=(["'])litespeed\/css\2/gi, '<script$1');

// 4. Set src attribute on background video element directly (Q1)
html = html.replace(
  /<video\s+class="elementor-background-video-hosted"([^>]*)>/gi,
  '<video class="elementor-background-video-hosted"$1 src="/template-assets/webinvite.id/wp-content/uploads/2025/11/raden-02-vid-motion-1.mp4" preload="auto">'
);

// 5. Remove the guest.vary.php fetch script to prevent 404 error
html = html.replace(/var litespeed_vary\s*=\s*document\.cookie[\s\S]*?guest\.vary\.php[\s\S]*?<\/script>/gi, '/* guest.vary removed */</script>');

// 6. Neutralize wp-comments-post.php form action
html = html.replace(/action=(["'])[^"']*wp-comments-post\.php\1/gi, 'action="#" data-wdp-origin="wp-comments-post"');

// 7. Disable the redirect in the original namatamu script (which reloads the page on '&' characters)
html = html.replace(/location\.replace\(location\.pathname\+newSearch\);return/gi, '/* no redirect */;return');

// 8. Rebrand product name: Website Invitation -> You Are Invited
html = html.replace(/<title>Website Invitation Premium<\/title>/gi, '<title>You Are Invited Premium</title>');
html = html.replace(/content="Website Invitation Premium"/gi, 'content="You Are Invited Premium"');
html = html.replace(/"name":\s*"Website Invitation Premium"/gi, '"name": "You Are Invited Premium"');
html = html.replace(/Website\.Invitation/g, 'You.Are.Invited');
html = html.replace(/Designed By Website Invitation/g, 'Designed By You Are Invited');

// 8b. CUI comment visibility fixes (Q1, Q2, Q3)
html = html.replace(/class="cui-link cui-icon-link cui-icon-link-true auto-load-true"/gi, 'class="cui-link cui-icon-link cui-icon-link-true"');
html = html.replace(/id=['"]cui-wrap-commnent-62777['"][^>]*style=['"][^'"]*['"]/gi, 'id="cui-wrap-commnent-62777" class="cui-wrap-comments" style="display: block !important;"');
html = html.replace(/<div id="cui-box" class="cui-box">/gi, '<div id="cui-box" class="cui-box" style="display: block !important; max-height: 30vh; overflow-y: auto;">');
html = html.replace(/<ul\s+id="cui-container-comment-62777"/gi, '<ul id="cui-container-comment-62777" style="display: block !important;"');

// 8c. Strip legacy WordPress WPCP (copy-protector) scripts & styles that break mobile touch, copy & click
html = html.replace(/<script id="wpcp_disable_selection">[\s\S]*?<\/script>/gi, '');
html = html.replace(/<script id="wpcp_disable_Right_Click">[\s\S]*?<\/script>/gi, '');
html = html.replace(/<script id="wpcp_css_disable_selection">[\s\S]*?<\/script>/gi, '');
html = html.replace(/<script>\s*\(function\(\)\{function stop\(e\)\{e\.preventDefault\(\);[\s\S]*?<\/script>/gi, '');
html = html.replace(/<style>\s*\.unselectable\s*\{[\s\S]*?<\/style>/gi, '');
html = html.replace(/<div id="wpcp-error-message"[\s\S]*?<\/style>/gi, '');
html = html.replace(/\bunselectable\b/g, '');

// 8d. Button stacking & maps clickability fixes
const buttonStackingCss = `
<style id="raden-mobile-fixes">
   /* Ensure maps buttons have top stacking context and can be clicked on mobile */
   .elementor-element-2f59679,
   .elementor-element-36a639a,
   .elementor-widget-button {
      position: relative !important;
      z-index: 99 !important;
      pointer-events: auto !important;
   }
   .elementor-element-2f59679 a,
   .elementor-element-36a639a a,
   .elementor-widget-button a {
      position: relative !important;
      z-index: 100 !important;
      pointer-events: auto !important;
      cursor: pointer !important;
      -webkit-tap-highlight-color: rgba(0,0,0,0.2) !important;
   }
   /* Ensure overlapping flower decorations do not intercept touch/click hits */
   .elementor-element-2a22411,
   .elementor-element-fd94e87,
   .elementor-element-2a22411 *,
   .elementor-element-fd94e87 * {
      pointer-events: none !important;
   }
</style>
`;
html = html.replace(/<\/head>/i, buttonStackingCss + '\n</head>');

// 9. Append the animation trigger, countdown, and data hydration engine before </body>
const hydrationEngine = `
<script id="raden-engine">
(function() {
  // Fire DOMContentLiteSpeedLoaded to initialize all built-in scripts
  function fireLiteSpeedLoaded() {
    document.dispatchEvent(new Event("DOMContentLiteSpeedLoaded"));
    window.dispatchEvent(new Event("DOMContentLiteSpeedLoaded"));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fireLiteSpeedLoaded);
  } else {
    fireLiteSpeedLoaded();
  }
  window.addEventListener("load", fireLiteSpeedLoaded);

  // Animation Engine for .muncul, .zoom, and .elementor-invisible
  function setupScrollAnimations() {
    var targets = document.querySelectorAll(".muncul, .muncul-kiri, .muncul-kanan, .zoom, .elementor-invisible");
    if (!window.IntersectionObserver) {
      targets.forEach(function(el) {
        el.classList.add("active");
        el.classList.remove("elementor-invisible");
      });
      return;
    }

    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        var el = entry.target;
        if (entry.isIntersecting) {
          el.classList.add("active");
          if (el.classList.contains("elementor-invisible")) {
            el.classList.remove("elementor-invisible");
            var st = el.getAttribute("data-settings");
            if (st) {
              try {
                var parsed = JSON.parse(st.replace(/&quot;/g, '"'));
                var a = parsed._animation || parsed._animation_mobile;
                if (a && a !== 'none') el.classList.add("animated", a);
              } catch(e) {}
            }
          }
        } else {
          // Re-trigger animation when scrolling back, matching template's original logic
          if (el.classList.contains("muncul") || el.classList.contains("muncul-kiri") || el.classList.contains("muncul-kanan") || el.classList.contains("zoom")) {
            el.classList.remove("active");
          }
        }
      });
    }, { threshold: 0.15 });

    targets.forEach(function(el) { observer.observe(el); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupScrollAnimations);
  } else {
    setupScrollAnimations();
  }
  window.addEventListener("load", setupScrollAnimations);

  // Guarantee body overflow: auto and cover removal on click
  document.addEventListener("click", function(e) {
    var btn = e.target && (e.target.closest(".wdp-button-wrapper button") || e.target.closest(".openInvi"));
    if (btn) {
      setTimeout(function() {
        document.body.style.overflow = "auto";
        var m = document.querySelector(".modalx");
        if (m) m.classList.add("removeCover");
        setupScrollAnimations();
      }, 50);
    }
  });

  // Elementor Toggle / Collapse Handler (Q1 & Q2: Multi-toggle independen)
  document.addEventListener("click", function(e) {
    var titleBtn = e.target && e.target.closest(".elementor-tab-title");
    if (!titleBtn) return;
    var widget = titleBtn.closest(".elementor-widget-toggle");
    if (!widget) return;

    e.preventDefault();
    var item = titleBtn.closest(".elementor-toggle-item");
    var content = item ? item.querySelector(".elementor-tab-content") : null;
    if (!content) return;

    var isExpanded = titleBtn.getAttribute("aria-expanded") === "true";

    if (isExpanded) {
      titleBtn.setAttribute("aria-expanded", "false");
      titleBtn.classList.remove("elementor-active");
      content.classList.remove("elementor-active");
      if (window.jQuery) {
        window.jQuery(content).slideUp(300);
      } else {
        content.style.display = "none";
      }
    } else {
      titleBtn.setAttribute("aria-expanded", "true");
      titleBtn.classList.add("elementor-active");
      content.classList.add("elementor-active");
      if (window.jQuery) {
        window.jQuery(content).slideDown(300);
      } else {
        content.style.display = "block";
      }
    }
  });

  // Universal Robust Copy Handler for Multi-Device (iOS Safari, Android, Desktop)
  function copyTextToClipboard(text) {
    if (!text) return Promise.resolve(false);
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function() {
        return true;
      }).catch(function() {
        return fallbackCopy(text);
      });
    }
    return Promise.resolve(fallbackCopy(text));
  }

  function fallbackCopy(text) {
    var textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.width = "2em";
    textArea.style.height = "2em";
    textArea.style.padding = "0";
    textArea.style.border = "none";
    textArea.style.outline = "none";
    textArea.style.boxShadow = "none";
    textArea.style.background = "transparent";
    textArea.style.opacity = "0.01";
    textArea.style.zIndex = "-9999";
    document.body.appendChild(textArea);

    var isiOS = navigator.userAgent.match(/ipad|ipod|iphone/i);
    if (isiOS) {
      var range = document.createRange();
      range.selectNodeContents(textArea);
      var selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      textArea.setSelectionRange(0, 999999);
    } else {
      textArea.focus();
      textArea.select();
    }

    var success = false;
    try {
      success = document.execCommand('copy');
    } catch (err) {
      success = false;
    }
    document.body.removeChild(textArea);
    return success;
  }

  // Intercept all copy button clicks with useCapture=true so vendor jQuery doesn't interfere
  document.addEventListener('click', function(e) {
    var btn = e.target && e.target.closest('.wdp-copy-btn, [data-clipboard-text]');
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    var textToCopy = btn.getAttribute('data-clipboard-text') || '';
    if (!textToCopy) {
      var siblingCopy = btn.parentElement && btn.parentElement.querySelector('.copy-content');
      if (siblingCopy) textToCopy = siblingCopy.textContent.trim();
    }
    if (!textToCopy) return;

    var textEl = btn.querySelector('.elementor-button-text') || btn;
    var origText = textEl.textContent;

    copyTextToClipboard(textToCopy).then(function() {
      textEl.textContent = '✓ Berhasil Disalin';
      setTimeout(function() {
        textEl.textContent = origText;
      }, 2000);
    });
  }, true);

  // Helper date formatter in Indonesian
  function formatIndoDate(dateStr) {
    if (!dateStr) return { dayName: '', dateFormatted: '' };
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return { dayName: '', dateFormatted: dateStr };
    var days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    var months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return {
      dayName: days[d.getDay()],
      dateFormatted: d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear()
    };
  }

  // Data Hydration from /api/invitations/raden-motion
  fetch('/api/invitations/raden-motion')
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(payload) {
      if (!payload) return;
      var inv = payload.invitation || {};
      var couples = payload.couples || [];
      var events = payload.events || [];
      var gifts = payload.giftAccounts || [];
      var wishSummary = payload.wishSummary || {};
      var wishes = payload.wishes || [];

      var groom = couples.find(function(c) { return c.role === 'groom'; }) || couples[0] || {};
      var bride = couples.find(function(c) { return c.role === 'bride'; }) || couples[1] || {};

      function text(sel, val) {
        if (!val) return;
        var el = typeof sel === 'string' ? document.querySelector(sel) : sel;
        if (el) el.textContent = String(val);
      }
      function attr(sel, a, val) {
        if (!val) return;
        var el = typeof sel === 'string' ? document.querySelector(sel) : sel;
        if (el) el.setAttribute(a, String(val));
      }
      function each(sel, fn) {
        Array.prototype.forEach.call(document.querySelectorAll(sel), fn);
      }

      // Guest Name from URL parameter
      var p = new URLSearchParams(location.search);
      var rawGuest = p.get('to') || p.get('dear') || p.get('kepada');
      var guest = rawGuest && rawGuest.trim() ? rawGuest.trim() : (inv.coverGuestLabelDefault || 'Tamu Undangan');
      each('.namatamu', function(el) { el.textContent = guest; });

      // Cover names
      if (groom.displayName && bride.displayName) {
        each('.wdp-mempelai', function(el) {
          el.textContent = groom.displayName + ' & ' + bride.displayName;
        });
      }

      // Hero names
      if (groom.displayName) text('[data-id="4b0b57e"] .elementor-heading-title', groom.displayName);
      if (bride.displayName) text('[data-id="08ea836"] .elementor-heading-title', bride.displayName);
      if (events[0] && events[0].date) {
        var ev0Date = formatIndoDate(events[0].date);
        text('[data-id="44bbaa4"] p', ev0Date.dateFormatted);
      }

      // Quote & Greeting
      if (inv.quoteText) text('[data-id="5b43713"] p', '(' + (inv.quoteSource || 'Ar-Rum 21') + ')');
      if (inv.openingGreetingText) text('[data-id="dcb69b8"] p', inv.openingGreetingText);

      // Bride profile
      if (bride.displayName) text('[data-id="20d8c21"] p', bride.displayName);
      if (bride.fullName) text('[data-id="3eb9824"] p', bride.fullName);
      if (bride.fatherName) {
        text('[data-id="464729a"] p', (bride.birthOrderLabel || 'Putri Kedua') + ' dari Bapak ' + bride.fatherName + ' dan Ibu ' + (bride.motherName || ''));
      }
      if (bride.instagramHandle) {
        attr('[data-id="8624cff"] a', 'href', 'https://instagram.com/' + bride.instagramHandle.replace('@', ''));
      }

      // Groom profile
      if (groom.displayName) text('[data-id="09ba1c3"] p', groom.displayName);
      if (groom.fullName) text('[data-id="a2f50b3"] p', groom.fullName);
      if (groom.fatherName) {
        text('[data-id="d6f55af"] p', (groom.birthOrderLabel || 'Putra Pertama') + ' dari Bapak ' + groom.fatherName + ' dan Ibu ' + (groom.motherName || ''));
      }
      if (groom.instagramHandle) {
        attr('[data-id="46113a6"] a', 'href', 'https://instagram.com/' + groom.instagramHandle.replace('@', ''));
      }

      function formatMapsUrl(url, venueName, venueAddress) {
        if (!url || url === '#' || url.indexOf('goo.gl/maps') !== -1) {
          return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent((venueName || '') + ' ' + (venueAddress || ''));
        }
        return url;
      }

      function setupMapsButton(btnSelector, mapsUrl, venueName, venueAddress) {
        var widget = document.querySelector(btnSelector);
        if (!widget) return;
        var a = widget.querySelector('a');
        if (!a) return;

        var finalUrl = formatMapsUrl(mapsUrl, venueName, venueAddress);
        a.setAttribute('href', finalUrl);
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');

        // Explicit click handler to guarantee opening across all mobile browsers and webviews
        a.onclick = function(e) {
          e.stopPropagation();
          window.open(finalUrl, '_blank');
          return false;
        };
      }

      // Event 1 (Akad)
      if (events[0]) {
        var ev0Info = formatIndoDate(events[0].date);
        text('[data-id="fb0c64e"] p', events[0].label);
        text('[data-id="6009170"] .elementor-heading-title', ev0Info.dayName);
        text('[data-id="c8e6e2a"] .elementor-heading-title', ev0Info.dateFormatted);
        text('[data-id="2d00970"] .elementor-heading-title', 'Pukul : ' + events[0].startTime + ' - ' + (events[0].endTimeLabel || 'Selesai'));
        text('[data-id="49ab019"] p', events[0].venueName + ', ' + events[0].venueAddress);
        setupMapsButton('[data-id="2f59679"]', events[0].mapsUrl, events[0].venueName, events[0].venueAddress);
      }

      // Event 2 (Resepsi)
      if (events[1]) {
        var ev1Info = formatIndoDate(events[1].date);
        text('[data-id="0f822f1"] p', events[1].label);
        text('[data-id="4edf461"] .elementor-heading-title', ev1Info.dayName);
        text('[data-id="18b08f3"] .elementor-heading-title', ev1Info.dateFormatted);
        text('[data-id="cf9695f"] .elementor-heading-title', 'Pukul : ' + events[1].startTime + ' - ' + (events[1].endTimeLabel || 'Selesai'));
        text('[data-id="79f5f1d"] p', events[1].venueName + ', ' + events[1].venueAddress);
        setupMapsButton('[data-id="36a639a"]', events[1].mapsUrl, events[1].venueName, events[1].venueAddress);
      }

      // Wedding Live Hydration (Q3)
      var liveInfo = payload.livestream;
      if (liveInfo && liveInfo.streamUrl) {
        var liveBtn = document.querySelector('[data-id="9f515aa"] a');
        if (liveBtn) {
          liveBtn.setAttribute('href', liveInfo.streamUrl);
          liveBtn.setAttribute('target', '_blank');
          liveBtn.setAttribute('rel', 'noopener noreferrer');
        }
        if (liveInfo.date || liveInfo.timeLabel) {
          var liveDateFormatted = liveInfo.date ? formatIndoDate(liveInfo.date).dateFormatted : '';
          var timeTxt = (liveDateFormatted ? 'Hari/Tanggal : ' + liveDateFormatted + ' ' : '') + (liveInfo.timeLabel ? 'Jam : ' + liveInfo.timeLabel : '');
          text('[data-id="f039c78"] p', timeTxt);
        }
      }

      // Story Timeline Hydration (Q3: Sinkron data cerita dari database)
      var storyList = payload.story || [];
      var toggleWidget = document.querySelector('[data-id="4522435"] .elementor-toggle');
      if (toggleWidget && storyList.length > 0) {
        var toggleItems = toggleWidget.querySelectorAll('.elementor-toggle-item');
        toggleItems.forEach(function(itemEl, idx) {
          var storyData = storyList[idx];
          if (storyData) {
            itemEl.style.display = '';
            var titleA = itemEl.querySelector('.elementor-toggle-title');
            if (titleA) titleA.textContent = storyData.title;

            var contentEl = itemEl.querySelector('.elementor-tab-content');
            if (contentEl) {
              var pTags = contentEl.querySelectorAll('p');
              if (pTags[0]) pTags[0].textContent = storyData.date;
              if (pTags[1]) pTags[1].textContent = storyData.description;
            }
          } else {
            // Sembunyikan item dummy berlebih jika data di DB lebih sedikit
            itemEl.style.display = 'none';
          }
        });
      }

      // Hashtag
      if (inv.hashtag) {
        each('[data-clipboard-text]', function(el) {
          var val = el.getAttribute('data-clipboard-text');
          if (val && val.charAt(0) === '#') {
            el.setAttribute('data-clipboard-text', inv.hashtag);
            var txt = el.querySelector('.elementor-button-text');
            if (txt) txt.textContent = inv.hashtag;
            var sibling = el.parentElement && el.parentElement.querySelector('.copy-content');
            if (sibling) sibling.textContent = inv.hashtag;
          }
        });
      }

      // Gifts
      if (gifts[0]) {
        text('[data-id="6ed591f"] .elementor-heading-title', 'An. ' + gifts[0].holderName);
        text('[data-id="b60bdab"] p', gifts[0].accountNumber);
        attr('[data-id="e945266"] [data-clipboard-text]', 'data-clipboard-text', gifts[0].accountNumber);
        var copyDiv0 = document.querySelector('[data-id="e945266"] .copy-content');
        if (copyDiv0) copyDiv0.textContent = gifts[0].accountNumber;
      }
      if (gifts[1]) {
        text('[data-id="b9b1608"] .elementor-heading-title', 'An. ' + gifts[1].holderName);
        text('[data-id="31757a0"] p', gifts[1].accountNumber);
        attr('[data-id="1303ef3"] [data-clipboard-text]', 'data-clipboard-text', gifts[1].accountNumber);
        var copyDiv1 = document.querySelector('[data-id="1303ef3"] .copy-content');
        if (copyDiv1) copyDiv1.textContent = gifts[1].accountNumber;
      }

      // Closing
      if (inv.closingText) text('[data-id="cd646ce"] .elementor-heading-title', inv.closingText);
      if (groom.displayName && bride.displayName) {
        text('[data-id="5fcdb6b"] .elementor-heading-title', groom.displayName + ' & ' + bride.displayName);
      }

      // Countdown Timer Engine (Q2)
      var targetDate = (events[0] && events[0].date)
        ? new Date(events[0].date + 'T' + (events[0].startTime || '08:00') + ':00').getTime()
        : 1798522860 * 1000;

      function updateCountdown() {
        var diff = Math.max(0, targetDate - Date.now());
        var days = Math.floor(diff / (1000 * 60 * 60 * 24));
        var hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        var minutes = Math.floor((diff / 1000 / 60) % 60);
        var seconds = Math.floor((diff / 1000) % 60);

        var dEl = document.querySelector('.elementor-countdown-days');
        var hEl = document.querySelector('.elementor-countdown-hours');
        var mEl = document.querySelector('.elementor-countdown-minutes');
        var sEl = document.querySelector('.elementor-countdown-seconds');

        if (dEl) dEl.textContent = String(days).padStart(2, '0');
        if (hEl) hEl.textContent = String(hours).padStart(2, '0');
        if (mEl) mEl.textContent = String(minutes).padStart(2, '0');
        if (sEl) sEl.textContent = String(seconds).padStart(2, '0');
      }
      updateCountdown();
      setInterval(updateCountdown, 1000);

      // Counters
      each('.cui_card-hadir span:first-child', function(el) { el.textContent = wishSummary.attending || 0; });
      each('.cui_card-tidak_hadir span:first-child', function(el) { el.textContent = wishSummary.notAttending || 0; });
      each('.cui_card-masih_ragu span:first-child', function(el) { el.textContent = wishSummary.maybe || 0; });
      each('.header-cui a span, [id^="cui-link-"] span', function(el) { el.textContent = wishSummary.total || 0; });

      // Unhide comment section (Q3)
      var cWrap = document.querySelector('[id^="cui-wrap-commnent-"]');
      if (cWrap) cWrap.style.display = 'block';

      function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
      }

      // Render Comment List: show all stored wishes, including admin-hidden ones,
      // in newest-first order with cursor-based pagination.
      function renderComments(list, append) {
        var ul = document.querySelector('#cui-container-comment-62777');
        if (!ul) return;
        ul.style.display = 'block';
        var box = document.querySelector('#cui-box');
        if (box) box.style.display = 'block';

        if (!append) ul.innerHTML = '';
        var emptyNotice = ul.querySelector('li[data-empty-wishes="true"]');
        if (emptyNotice) emptyNotice.remove();
        if (!list || list.length === 0) {
          if (!append && ul.children.length === 0) {
            var empty = document.createElement('li');
            empty.setAttribute('data-empty-wishes', 'true');
            empty.style.cssText = 'text-align: center; color: #888; padding: 20px; font-size: 13px; list-style: none;';
            empty.textContent = 'Belum ada ucapan. Jadilah yang pertama memberikan doa restu!';
            ul.appendChild(empty);
          }
          return;
        }

        list.forEach(function(w) {
          var badgeColor = w.attendanceStatus === 'attending' ? '#3d9a62' : (w.attendanceStatus === 'not_attending' ? '#d90a11' : '#d7a916');
          var badgeText = w.attendanceStatus === 'attending' ? 'Hadir' : (w.attendanceStatus === 'not_attending' ? 'Tidak Hadir' : 'Masih Ragu');
          var dateFormatted = new Date(w.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

          var li = document.createElement('li');
          li.className = 'cui-item-comment depth-1';
          li.id = 'cui-item-comment-' + w.id;
          li.style.cssText = 'border-bottom: 1px solid rgba(0,0,0,0.06); padding: 14px 0; list-style: none;';
          li.innerHTML =
            '<div class="cui-comment-avatar" style="float: left; width: 38px; height: 38px; border-radius: 50%; overflow: hidden; background: #eee; padding: 0 !important; margin: 0 !important;">' +
              '<img src="/template-assets/webinvite.id/wp-content/litespeed/avatar/07ca3b3c736c189fa65beb38a65f85c2.jpg" style="width: 100% !important; height: 100% !important; max-width: 100% !important; max-height: 100% !important; object-fit: cover !important; display: block !important; border-radius: 50% !important; margin: 0 !important; padding: 0 !important;" />' +
            '</div>' +
            '<div class="cui-comment-content" style="margin-left: 50px;">' +
              '<div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px;">' +
                '<span style="font-weight: bold; color: #222; font-size: 13px;">' + escapeHtml(w.guestName) + '</span>' +
                '<span style="font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 12px; color: #fff; background-color: ' + badgeColor + ';">' + badgeText + '</span>' +
                '<span style="font-size: 11px; color: #999; margin-left: auto;">' + dateFormatted + '</span>' +
              '</div>' +
              '<div style="color: #444; font-size: 13px; line-height: 1.5; word-break: break-word;">' + escapeHtml(w.message) + '</div>' +
            '</div>';
          ul.appendChild(li);
        });
      }

      // Load every stored wish in 10-item pages. No isHidden filter is applied.
      var wishesCursor = null;
      var wishesHasMore = true;
      var wishesLoading = false;
      var wishesPageSize = 10;
      var wishesLoadMoreBtn = null;

      function fetchNextWishesPage(append) {
        if (wishesLoading || (!wishesHasMore && append)) return Promise.resolve();
        wishesLoading = true;
        if (wishesLoadMoreBtn) {
          wishesLoadMoreBtn.disabled = true;
          wishesLoadMoreBtn.textContent = 'Memuat ucapan...';
        }

        var url = '/api/invitations/raden-motion/wishes?limit=' + wishesPageSize;
        if (wishesCursor) {
          url += '&cursor=' + encodeURIComponent(wishesCursor.createdAt) + '&cursorId=' + encodeURIComponent(wishesCursor.id);
        }

        return fetch(url)
          .then(function(res) {
            if (!res.ok) throw new Error('Gagal memuat ucapan (HTTP ' + res.status + ')');
            return res.json();
          })
          .then(function(page) {
            renderComments(page.data || [], append);
            wishesCursor = page.nextCursor || null;
            wishesHasMore = wishesCursor !== null;
            updateWishesLoadMoreButton();
          })
          .catch(function(err) {
            console.error('[raden-motion] Gagal memuat ucapan:', err);
            if (!append) renderComments([], false);
            if (wishesLoadMoreBtn) wishesLoadMoreBtn.textContent = 'Coba muat lagi';
          })
          .finally(function() {
            wishesLoading = false;
            if (wishesLoadMoreBtn && wishesHasMore) wishesLoadMoreBtn.disabled = false;
          });
      }

      function updateWishesLoadMoreButton() {
        var list = document.querySelector('#cui-container-comment-62777');
        if (!list) return;
        if (!wishesLoadMoreBtn) {
          wishesLoadMoreBtn = document.createElement('button');
          wishesLoadMoreBtn.type = 'button';
          wishesLoadMoreBtn.className = 'cui-load-more-wishes';
          wishesLoadMoreBtn.style.cssText = 'display:block; margin:16px auto; padding:10px 20px; border:0; border-radius:4px; background:#3d9a62; color:#fff; font:inherit; cursor:pointer;';
          wishesLoadMoreBtn.addEventListener('click', function() { fetchNextWishesPage(true); });
        }
        if (wishesHasMore) {
          wishesLoadMoreBtn.textContent = 'Muat ucapan lainnya';
          if (!wishesLoadMoreBtn.parentNode) list.insertAdjacentElement('afterend', wishesLoadMoreBtn);
        } else if (wishesLoadMoreBtn.parentNode) {
          wishesLoadMoreBtn.remove();
        }
      }

      fetchNextWishesPage(false);
        });

      // RSVP Form submission handler (Q4)
      var form = document.querySelector('form[id^="commentform"]');
      var statusEl = document.querySelector('#cui-comment-status-62777');
      if (form) {
        form.onsubmit = function(e) {
          e.preventDefault();
          var authorEl = form.querySelector('[name="author"], #author');
          var msgEl = form.querySelector('[name="comment"], #comment, textarea');
          var statusSelect = form.querySelector('[name="konfirmasi"], #konfirmasi');
          var submitBtn = form.querySelector('input[type="submit"], button[type="submit"]');

          var author = authorEl ? authorEl.value.trim() : '';
          var msg = msgEl ? msgEl.value.trim() : '';
          var statusVal = statusSelect ? statusSelect.value : 'Hadir';

          if (!author || author.length < 2) {
            if (statusEl) {
              statusEl.innerHTML = '<p class="cui-ajax-error" style="color: #d90a11; font-weight: bold; padding: 8px 0;">Mohon masukkan nama Anda (minimal 2 karakter).</p>';
              statusEl.style.display = 'block';
            }
            return;
          }
          if (!msg || msg.length < 2) {
            if (statusEl) {
              statusEl.innerHTML = '<p class="cui-ajax-error" style="color: #d90a11; font-weight: bold; padding: 8px 0;">Mohon masukkan ucapan Anda (minimal 2 karakter).</p>';
              statusEl.style.display = 'block';
            }
            return;
          }

          var st = 'attending';
          if (statusVal === 'Tidak hadir' || statusVal === 'Absen') st = 'not_attending';
          if (statusVal === 'Masih Ragu' || statusVal === 'Mungkin') st = 'maybe';

          if (statusEl) {
            statusEl.innerHTML = '<p style="color: #666; padding: 8px 0;"><span class="cuio-loading"></span> Menyimpan ucapan Anda...</p>';
            statusEl.style.display = 'block';
          }
          if (submitBtn) submitBtn.disabled = true;

          fetch('/api/invitations/raden-motion/wishes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              guestName: author,
              message: msg,
              attendanceStatus: st
            })
          })
          .then(function(res) { return res.json(); })
          .then(function(result) {
            if (submitBtn) submitBtn.disabled = false;
            if (result.success && result.data) {
              if (statusEl) {
                statusEl.innerHTML = '<p class="cui-ajax-success" style="color: #3d9a62; font-weight: bold; padding: 10px; background: #e8f5e9; border-radius: 8px; margin-bottom: 12px;">✓ Terima kasih! Ucapan dan konfirmasi kehadiran Anda berhasil tersimpan.</p>';
                statusEl.style.display = 'block';
                setTimeout(function() {
                  statusEl.style.display = 'none';
                }, 5000);
              }

              // Prepend new comment to list
              var ul = document.querySelector('#cui-container-comment-62777');
              if (ul) {
                var emptyNotice = ul.querySelector('li[style*="text-align: center"]');
                if (emptyNotice) emptyNotice.remove();

                var badgeColor = st === 'attending' ? '#3d9a62' : (st === 'not_attending' ? '#d90a11' : '#d7a916');
                var badgeText = st === 'attending' ? 'Hadir' : (st === 'not_attending' ? 'Tidak Hadir' : 'Masih Ragu');

                var li = document.createElement('li');
                li.className = 'cui-item-comment depth-1';
                li.id = 'cui-item-comment-' + result.data.id;
                li.style.cssText = 'border-bottom: 1px solid rgba(0,0,0,0.06); padding: 14px 0; list-style: none; animation: fadeIn 0.5s ease;';
                li.innerHTML =
                  '<div class="cui-comment-avatar" style="float: left; width: 38px; height: 38px; border-radius: 50%; overflow: hidden; background: #eee; padding: 0 !important; margin: 0 !important;">' +
                    '<img src="/template-assets/webinvite.id/wp-content/litespeed/avatar/07ca3b3c736c189fa65beb38a65f85c2.jpg" style="width: 100% !important; height: 100% !important; max-width: 100% !important; max-height: 100% !important; object-fit: cover !important; display: block !important; border-radius: 50% !important; margin: 0 !important; padding: 0 !important;" />' +
                  '</div>' +
                  '<div class="cui-comment-content" style="margin-left: 50px;">' +
                    '<div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px;">' +
                      '<span style="font-weight: bold; color: #222; font-size: 13px;">' + escapeHtml(result.data.guestName) + '</span>' +
                      '<span style="font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 12px; color: #fff; background-color: ' + badgeColor + ';">' + badgeText + '</span>' +
                      '<span style="font-size: 11px; color: #999; margin-left: auto;">Baru saja</span>' +
                    '</div>' +
                    '<div style="color: #444; font-size: 13px; line-height: 1.5; word-break: break-word;">' + escapeHtml(result.data.message) + '</div>' +
                  '</div>';
                ul.insertBefore(li, ul.firstChild);
              }

              // Increment attendance card counters
              if (st === 'attending') {
                var hCard = document.querySelector('.cui_card-hadir span:first-child');
                if (hCard) hCard.textContent = parseInt(hCard.textContent || '0', 10) + 1;
              } else if (st === 'not_attending') {
                var thCard = document.querySelector('.cui_card-tidak_hadir span:first-child');
                if (thCard) thCard.textContent = parseInt(thCard.textContent || '0', 10) + 1;
              } else {
                var mrCard = document.querySelector('.cui_card-masih_ragu span:first-child');
                if (mrCard) mrCard.textContent = parseInt(mrCard.textContent || '0', 10) + 1;
              }
              var totEl = document.querySelector('.header-cui a span, [id^="cui-link-"] span');
              if (totEl) totEl.textContent = parseInt(totEl.textContent || '0', 10) + 1;

              // Clear message
              if (msgEl) msgEl.value = '';
            } else {
              if (statusEl) {
                statusEl.innerHTML = '<p class="cui-ajax-error" style="color: #d90a11; font-weight: bold; padding: 8px 0;">' + (result.error || 'Gagal mengirim ucapan.') + '</p>';
                statusEl.style.display = 'block';
              }
            }
          })
          .catch(function(err) {
            if (submitBtn) submitBtn.disabled = false;
            if (statusEl) {
              statusEl.innerHTML = '<p class="cui-ajax-error" style="color: #d90a11; font-weight: bold; padding: 8px 0;">Terjadi kesalahan koneksi.</p>';
              statusEl.style.display = 'block';
            }
          });
        };
      }
    })
    .catch(function(err) {
      console.warn('Hydration skipped:', err);
    });
})();
</script>
`;

html = html.replace(/<\/body>/i, hydrationEngine + '\n</body>');

fs.writeFileSync(destFile, html, 'utf8');
console.log('Converted raden-motion successfully! Size:', html.length);
