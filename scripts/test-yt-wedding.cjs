const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootDir = path.resolve(__dirname, '..');
const ytDir = path.join(rootDir, 'apps', 'api', 'private-pages', 'yt-wedding');
const htmlPath = path.join(ytDir, 'index.html');
const stylePath = path.join(ytDir, 'assets', 'css', 'style.css');
const animCssPath = path.join(ytDir, 'assets', 'css', 'wk-anim.css');
const appJsPath = path.join(ytDir, 'assets', 'js', 'app.js');
const bindJsPath = path.join(ytDir, 'assets', 'js', 'bind.js');

const errors = [];

function checkFileExists(filePath, name) {
  if (!fs.existsSync(filePath)) {
    errors.push(`Missing expected file: ${name} (${filePath})`);
    return false;
  }
  const stat = fs.statSync(filePath);
  if (!stat.isFile() || stat.size === 0) {
    errors.push(`File is empty or not a regular file: ${name}`);
    return false;
  }
  return true;
}

console.log('--- Checking yt-wedding private-pages bundle integrity ---');

const htmlOk = checkFileExists(htmlPath, 'index.html');
const styleOk = checkFileExists(stylePath, 'assets/css/style.css');
const animCssOk = checkFileExists(animCssPath, 'assets/css/wk-anim.css');
const appJsOk = checkFileExists(appJsPath, 'assets/js/app.js');
const bindJsOk = checkFileExists(bindJsPath, 'assets/js/bind.js');

if (htmlOk) {
  const html = fs.readFileSync(htmlPath, 'utf8');

  const forbiddenStrings = [
    'Juliet & Romeo',
    'Juliet &amp; Romeo',
    'Capulet',
    'Montague',
    'chara.id',
    '/mulai',
    'preview-mode',
    'static.cloudflareinsights.com',
    'challenge-platform',
    'api.qrserver.com',
    'handle_rsvp.json',
    'assets/index.html/img/',
    'chGuestCta',
  ];

  for (const str of forbiddenStrings) {
    if (html.includes(str)) {
      errors.push(`index.html contains forbidden reference: "${str}"`);
    }
  }

  const requiredTokens = [
    'assets/css/style.css',
    'assets/css/wk-anim.css',
    'assets/js/app.js',
    'assets/js/bind.js',
    'welcome-cover',
    'btn-open-invitation',
    'hero-container',
    'mempelai-post',
    'event-post',
    'gallery-post',
    'angpao-post',
    'rsvp-modal',
    'ucapan-modal',
    'rekening-modal',
    'gallery-modal',
    'ytw-bottom-nav',
  ];

  for (const token of requiredTokens) {
    if (!html.includes(token)) {
      errors.push(`index.html missing required structural token: "${token}"`);
    }
  }
}

if (styleOk) {
  const css = fs.readFileSync(stylePath, 'utf8');
  if (!css.includes('.modal-open')) {
    errors.push('style.css missing .modal-open rule');
  }
  if (!css.includes('#ytw-bottom-nav')) {
    errors.push('style.css missing #ytw-bottom-nav rule');
  }
}

if (animCssOk) {
  const animCss = fs.readFileSync(animCssPath, 'utf8');
  if (!animCss.includes('wk-slide-up-in') && !animCss.includes('[data-wk-anim]')) {
    errors.push('wk-anim.css missing wk animation keyframes / attributes');
  }
}

if (appJsOk) {
  const appJs = fs.readFileSync(appJsPath, 'utf8');
  try {
    new vm.Script(appJs);
  } catch (e) {
    errors.push(`app.js has syntax error: ${e.message}`);
  }
  if (appJs.includes('api.qrserver.com')) {
    errors.push('app.js still references api.qrserver.com fake QR server');
  }
  if (appJs.includes('handle_rsvp.json') || appJs.includes('handle_rsvp.php')) {
    errors.push('app.js still references fake handle_rsvp endpoint');
  }
}

if (bindJsOk) {
  const bindJs = fs.readFileSync(bindJsPath, 'utf8');
  try {
    new vm.Script(bindJs);
  } catch (e) {
    errors.push(`bind.js has syntax error: ${e.message}`);
  }
  if (!bindJs.includes('bindYTWedding')) {
    errors.push('bind.js does not define bindYTWedding function');
  }
}

if (errors.length > 0) {
  console.error(`FAILED: ${errors.length} integrity check(s) failed:`);
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

console.log('SUCCESS: All yt-wedding private-pages bundle integrity checks passed.');
process.exit(0);
