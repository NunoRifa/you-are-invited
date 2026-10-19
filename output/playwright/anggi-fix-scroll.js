async (page) => {
  const url = 'http://localhost:5173/i/anggi-ivan?to=Nuno+Rifa';
  const results = [];
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  for (const [width, height] of [[320,568],[360,640],[375,667],[390,844],[430,932],[667,375],[768,1024],[1024,768],[1366,768],[1920,1080]]) {
    await page.setViewportSize({ width, height });
    await page.goto(url, { waitUntil:'domcontentloaded' });
    await page.locator('.anggi-love-story-card').first().waitFor({ timeout:12000 });
    if (width === 667 && height === 375) {
      await page.screenshot({ path:'output/playwright/cover-fixed-667-final.png' });
    }
    await page.locator('#wdp-button-wrapper button').click();
    await page.evaluate(async () => {
      const step = Math.max(250, Math.floor(innerHeight * .8));
      const max = document.documentElement.scrollHeight;
      for (let y = 0; y < max; y += step) {
        scrollTo(0,y);
        await new Promise(resolve => setTimeout(resolve, 35));
      }
    });
    await page.waitForTimeout(250);
    const result = await page.evaluate(() => {
      const visibleBroken = [...document.images].filter(el => !el.closest('.standalone-lightbox-modal:not(.active)') && el.getClientRects().length && getComputedStyle(el).display !== 'none' && el.complete && el.naturalWidth === 0).map(el => el.currentSrc || el.src);
      return { viewport:[innerWidth,innerHeight], scrollWidth:document.documentElement.scrollWidth, cardCount:document.querySelectorAll('.anggi-love-story-card').length, galleryCount:document.querySelectorAll('[data-id="b6f6ff8"] .e-gallery-item').length, brokenImages:visibleBroken.slice(0,5), bodyOverflow:getComputedStyle(document.body).overflow };
    });
    results.push(result);
  }
  return { results, errors };
}
