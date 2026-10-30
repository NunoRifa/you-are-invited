const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '../apps/web/public/production/anggi-ivan/index.html'), 'utf8');
const source = html.match(/function setVenue\(sel, venueName, venueAddress\) \{[\s\S]*?\n      \}/)?.[0];
assert.ok(source, 'Anggi & Ivan venue hydration must exist');

const widgets = new Map();
const document = {
  querySelector(selector) { return widgets.get(selector); },
  createElement(tagName) { return { tagName, className: '', textContent: '' }; },
  createTextNode(textContent) { return { textContent }; },
};
const setVenue = vm.runInNewContext(`(${source})`, { document });

for (const selector of ['[data-id="49ab019"] p', '[data-id="79f5f1d"] p']) {
  const paragraph = { replaceChildren(...nodes) { this.children = nodes; } };
  widgets.set(selector, paragraph);
  setVenue(selector, 'Ballroom Mall Metropolitan Cileungsi', 'Jl. Metropolitan No. 1');
  assert.equal(paragraph.children[0].className, 'anggi-venue-name');
  assert.equal(paragraph.children[0].textContent, 'Ballroom Mall Metropolitan Cileungsi');
  assert.equal(paragraph.children[1].tagName, 'br');
  assert.equal(paragraph.children[2].textContent, 'Jl. Metropolitan No. 1');
}

const paragraph = { replaceChildren(...nodes) { this.children = nodes; } };
widgets.set('[data-id="49ab019"] p', paragraph);
setVenue('[data-id="49ab019"] p', '<img src=x onerror=alert(1)>', 'Alamat');
assert.equal(paragraph.children[0].textContent, '<img src=x onerror=alert(1)>');
assert.equal(paragraph.children[0].tagName, 'span');
console.log('Anggi & Ivan venue text renders separately and safely for both events.');
