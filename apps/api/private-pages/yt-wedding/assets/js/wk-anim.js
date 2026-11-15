/* ============================================================
   WK-ANIM — Universal animation system for wedding themes
   Auto-tags common elements with data-wk-anim attribute,
   triggers entrance via IntersectionObserver.

   Pair with /css/wk-anim.css

   Opt-out per element: <div data-wk-anim-skip>
   Opt-in custom anim:  <div data-wk-anim="pop"> (pre-tagged before script runs)
   ============================================================ */
(function () {
    if (window.__wkAnimInit) return;
    window.__wkAnimInit = true;

    // Selector → animation type + stagger ms (between siblings) + initial delay
    // Order matters: more specific first. Each element only tagged once (WeakSet).
    const MAP = [
        // Hero (first section's text content) — fast, on-load
        { sel: 'main > section:first-of-type h1, body > section:first-of-type h1, header h1', anim: 'slide-up', stagger: 0, delay: 60 },
        { sel: 'main > section:first-of-type h2, body > section:first-of-type h2, header h2', anim: 'slide-up', stagger: 0, delay: 140 },
        { sel: 'main > section:first-of-type p,  body > section:first-of-type p,  header p',  anim: 'slide-up', stagger: 100, delay: 220 },

        // Images — fade only (preserves aspect/positioning)
        { sel: 'img:not([data-wk-anim-skip])', anim: 'fade', stagger: 60 },

        // Cards (common class fragments across themes)
        { sel: '[class*="-card"], [class*="card-"], [class*="item-"], [class*="-item"]', anim: 'slide-up', stagger: 90 },

        // List items
        { sel: 'main li, section li',  anim: 'slide-up', stagger: 80 },

        // Headings inside any section (not first)
        { sel: 'section h1, section h2, section h3', anim: 'slide-up', stagger: 0 },

        // Section direct children — universal fallback
        { sel: 'main > section > *, body > section > *, main > div > *', anim: 'slide-up', stagger: 50 },
    ];

    // Tailwind transform utilities — if present on element, force fade-only entrance
    // (otherwise our entrance animation's `transform` would override their positioning)
    const TAILWIND_TRANSFORM_RE = /(^|\s)(-?translate-[xy]-|-?rotate-\d|-?scale-\d|-translate-)/;
    function usesTailwindTransform(el) {
        return TAILWIND_TRANSFORM_RE.test(el.className || '');
    }

    // Skip if element is fixed/sticky positioned (likely nav/modal/floating UI)
    function isFixedOrSticky(el) {
        const cn = el.className || '';
        if (/(^|\s)(fixed|sticky|absolute)(\s|$)/.test(cn)) return true;
        const pos = getComputedStyle(el).position;
        return pos === 'fixed' || pos === 'sticky';
    }

    // Strip `rotate(Xdeg)` from inline transform → CSS var --wk-rot
    function captureRotation(el) {
        const t = (el.style && el.style.transform) || '';
        const m = t.match(/rotate\((-?[\d.]+)deg\)/);
        if (m) {
            el.style.setProperty('--wk-rot', m[1] + 'deg');
            const cleaned = t.replace(/rotate\(-?[\d.]+deg\)/, '').trim();
            if (cleaned) el.style.transform = cleaned;
            else el.style.removeProperty('transform');
        } else {
            el.style.setProperty('--wk-rot', '0deg');
        }
    }

    function init() {
        const tagged = new WeakSet();

        MAP.forEach(({ sel, anim, stagger, delay = 0 }) => {
            let elems;
            try { elems = document.querySelectorAll(sel); } catch (_) { return; }
            const list = Array.from(elems).filter(el => {
                if (tagged.has(el)) return false;
                if (el.hasAttribute('data-wk-anim')) return false;
                if (el.hasAttribute('data-wk-anim-skip')) return false;
                if (el.closest('[data-wk-anim-skip]')) return false;
                if (isFixedOrSticky(el)) return false;
                return true;
            });
            list.forEach((el, i) => {
                tagged.add(el);
                // Elements with Tailwind transform utilities (translate/rotate/scale)
                // → force fade entrance (transform-based reveal would break their positioning)
                const finalAnim = usesTailwindTransform(el) ? 'fade' : anim;
                if (finalAnim !== 'fade') captureRotation(el);
                el.setAttribute('data-wk-anim', finalAnim);
                const total = delay + i * stagger;
                if (total) el.style.setProperty('--wk-delay', total + 'ms');
            });
        });

        // First section animates on page load (don't wait for scroll)
        const firstSection = document.querySelector('main > section, body > section, header');
        if (firstSection) {
            requestAnimationFrame(() => {
                firstSection.querySelectorAll('[data-wk-anim]').forEach(el => el.classList.add('wk-in'));
            });
        }

        // Other elements trigger via IntersectionObserver when scrolled into view
        if ('IntersectionObserver' in window) {
            const obs = new IntersectionObserver((entries) => {
                entries.forEach(e => {
                    if (e.isIntersecting) {
                        e.target.classList.add('wk-in');
                        obs.unobserve(e.target);
                    }
                });
            }, { threshold: 0.12, rootMargin: '0px 0px -50px 0px' });

            document.querySelectorAll('[data-wk-anim]:not(.wk-in)').forEach(el => {
                if (firstSection && firstSection.contains(el)) return;
                obs.observe(el);
            });
        } else {
            // Fallback: just reveal everything
            document.querySelectorAll('[data-wk-anim]').forEach(el => el.classList.add('wk-in'));
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
