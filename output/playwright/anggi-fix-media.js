async (page) => {
  const url = 'http://localhost:5173/i/anggi-ivan?to=Nuno+Rifa';
  const failed = [];
  const errors = [];
  page.on('requestfailed', request => failed.push({ url:request.url(), error:request.failure()?.errorText }));
  page.on('pageerror', error => errors.push(String(error)));
  await page.emulateMedia({ reducedMotion:'no-preference' });
  await page.setViewportSize({ width:390, height:844 });
  await page.goto(url, { waitUntil:'domcontentloaded' });
  await page.locator('.anggi-love-story-card').first().waitFor({ timeout:12000 });
  const before = await page.evaluate(() => ({
    mediaResources: performance.getEntriesByType('resource').filter(r => /raden-02-vid-motion-1|reno\.mov|Kabagyan/.test(r.name)).map(r => ({ name:r.name, transferred:r.transferSize })),
    galleryVideoWidget: !!document.querySelector('[data-id="c003900"]'),
    heroPreload: document.querySelector('.motionSection video').preload,
  }));
  await page.locator('#wdp-button-wrapper button').click();
  await page.waitForTimeout(1200);
  const after = await page.evaluate(() => ({
    heroPaused: document.querySelector('.motionSection video').paused,
    audioPaused: document.querySelector('#song').paused,
    audioSource: document.querySelector('#song').currentSrc,
    mediaResources: performance.getEntriesByType('resource').filter(r => /raden-02-vid-motion-1|reno\.mov|Kabagyan/.test(r.name)).map(r => ({ name:r.name, transferred:r.transferSize })),
  }));
  return { before, after, failed, errors };
}
