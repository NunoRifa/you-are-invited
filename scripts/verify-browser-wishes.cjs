const { chromium } = require('playwright');
const path = require('path');

async function verifyBrowser() {
  console.log('=== LAUNCHING HEADLESS BROWSER ===');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 412, height: 915 } });
  const page = await context.newPage();

  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => consoleLogs.push(`[PAGE ERROR] ${err.message}`));

  console.log('Navigating to http://localhost:5173/i/raden-motion?to=Budi+Santoso ...');
  await page.goto('http://localhost:5173/i/raden-motion?to=Budi+Santoso', { waitUntil: 'networkidle' });

  // 1. Check title & basic elements
  const title = await page.title();
  console.log('Page Title:', title);

  // 2. Click "Buka Undangan"
  console.log('Clicking "Buka Undangan"...');
  await page.click('.wdp-button-wrapper button, .openInvi');
  await page.waitForTimeout(1000);

  // 3. Scroll to comments section
  console.log('Scrolling to comments section...');
  await page.evaluate(() => {
    const el = document.querySelector('[id^="cui-wrap-commnent-"]') || document.querySelector('#cui-box');
    if (el) el.scrollIntoView({ behavior: 'instant' });
  });
  await page.waitForTimeout(1500);

  // 4. Extract rendered comment list
  const commentData = await page.evaluate(() => {
    const wrap = document.querySelector('[id^="cui-wrap-commnent-"]');
    const ul = document.querySelector('#cui-container-comment-62777');
    const loadMoreBtn = document.querySelector('.cui-load-more-wishes');
    const cards = {
      hadir: document.querySelector('.cui_card-hadir span:first-child')?.textContent?.trim(),
      tidakHadir: document.querySelector('.cui_card-tidak_hadir span:first-child')?.textContent?.trim(),
      masihRagu: document.querySelector('.cui_card-masih_ragu span:first-child')?.textContent?.trim(),
      totalHeader: document.querySelector('.header-cui a span')?.textContent?.trim(),
    };

    const items = [];
    if (ul) {
      const lis = ul.querySelectorAll('li.cui-item-comment');
      lis.forEach(li => {
        const name = li.querySelector('.cui-comment-content span:first-child')?.textContent?.trim();
        const badge = li.querySelector('.cui-comment-content span:nth-child(2)')?.textContent?.trim();
        const time = li.querySelector('.cui-comment-content span:nth-child(3)')?.textContent?.trim();
        const msg = li.querySelector('.cui-comment-content div:last-child')?.textContent?.trim();
        items.push({ id: li.id, name, badge, time, msg });
      });
    }

    return {
      wrapDisplay: wrap ? getComputedStyle(wrap).display : null,
      ulPresent: !!ul,
      renderedCount: items.length,
      loadMoreBtnVisible: !!loadMoreBtn,
      cards,
      items
    };
  });

  console.log('\n=== BROWSER RENDERED COMMENT DATA ===');
  console.log('Wrap display:', commentData.wrapDisplay);
  console.log('Rendered comments count:', commentData.renderedCount);
  console.log('Attendance Cards in DOM:', commentData.cards);
  console.log('Rendered comments items:');
  console.log(JSON.stringify(commentData.items, null, 2));

  // Take screenshot of comments section
  const screenshotPath = path.resolve('storage/comments-verification.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`\nScreenshot saved to: ${screenshotPath}`);

  if (consoleLogs.length > 0) {
    console.log('\n=== BROWSER CONSOLE MESSAGES ===');
    consoleLogs.forEach(l => console.log(' ', l));
  }

  await browser.close();
}

verifyBrowser().catch(err => {
  console.error('Browser verification failed:', err);
  process.exit(1);
});
