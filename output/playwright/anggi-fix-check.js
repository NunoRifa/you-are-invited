async (page) => {
  const url = 'http://localhost:5173/i/anggi-ivan?to=Nuno+Rifa';
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  const results = [];
  for (const [width, height] of [[320, 568], [360, 640], [375, 667], [390, 844], [430, 932], [667, 375], [768, 1024], [1024, 768], [1366, 768], [1920, 1080]]) {
    await page.setViewportSize({ width, height });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.locator('.anggi-love-story-card').first().waitFor({ timeout: 12000 });
    await page.waitForTimeout(500);
    const before = await page.evaluate(() => {
      const cover = document.querySelector('.content-modalx');
      const audio = document.querySelector('#audio-container');
      const box = audio.getBoundingClientRect();
      return {
        coverClientHeight: cover.clientHeight,
        coverScrollHeight: cover.scrollHeight,
        coverOverflow: getComputedStyle(cover).overflowY,
        coverButtonBottom: document.querySelector('#wdp-button-wrapper button').getBoundingClientRect().bottom,
        audio: { x: box.x, y: box.y, width: box.width, height: box.height, right: box.right },
        audioRole: audio.getAttribute('role'),
        audioTabIndex: audio.tabIndex,
        commentHref: document.querySelector('#cui-link-62777').getAttribute('href'),
      };
    });
    let opened = true;
    try { await page.locator('#wdp-button-wrapper button').click({ timeout: 6500 }); }
    catch (error) { opened = String(error).slice(0, 130); }
    await page.waitForTimeout(250);
    const after = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      bodyOverflow: getComputedStyle(document.body).overflow,
      cards: document.querySelectorAll('.anggi-love-story-card').length,
      gallery: document.querySelectorAll('[data-id="b6f6ff8"] .e-gallery-item').length,
      labels: ['author','cui-textarea-62777','konfirmasi'].map(id => ({ id, labels: document.getElementById(id).labels.length })),
      descriptionFont: getComputedStyle(document.querySelector('.anggi-love-story-description')).fontSize,
      eventTimeFont: getComputedStyle(document.querySelector('[data-id="2d00970"] .elementor-heading-title')).fontSize,
      eventAddressFont: getComputedStyle(document.querySelector('[data-id="49ab019"] p')).fontSize,
      localBg: getComputedStyle(document.querySelector('[data-id="fc5855b"] .cui-wrapper')).backgroundImage,
    }));
    results.push({ viewport: `${width}x${height}`, before, opened, after });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.anggi-love-story-card').first().waitFor({ timeout: 12000 });
  await page.locator('#wdp-button-wrapper button').click();
  await page.evaluate(() => document.querySelector('[data-id="b6f6ff8"]').scrollIntoView());
  await page.waitForTimeout(700);
  await page.locator('[data-id="b6f6ff8"] .e-gallery-item').first().click();
  await page.waitForTimeout(350);
  const focus = [];
  for (let i = 0; i < 8; i++) {
    focus.push(await page.evaluate(() => document.activeElement.id));
    await page.keyboard.press('Tab');
  }
  await page.keyboard.press('Escape');
  const modalClosed = await page.evaluate(() => !document.querySelector('#standalone-lightbox').classList.contains('active'));
  await page.locator('#audio-container').focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  const audioKeyboard = await page.evaluate(() => ({ pressed: document.querySelector('#audio-container').getAttribute('aria-pressed'), paused: document.querySelector('#song').paused }));
  await page.keyboard.press('Space');
  await page.waitForTimeout(150);
  const audioSpace = await page.evaluate(() => ({ pressed: document.querySelector('#audio-container').getAttribute('aria-pressed'), paused: document.querySelector('#song').paused }));
  await page.evaluate(() => document.querySelector('#cui-link-62777').scrollIntoView());
  await page.waitForTimeout(650);
  await page.locator('#cui-link-62777').click();
  const commentNavigation = await page.evaluate(() => ({ pathname: location.pathname, hash: location.hash }));
  const resourceUrls = await page.evaluate(() => performance.getEntriesByType('resource').map(r => r.name).filter(u => /BG-Raden|bawah-123/.test(u)));
  const aria = await page.evaluate(() => ({
    placeholderColor: getComputedStyle(document.querySelector('#author'), '::placeholder').color,
    labels: ['author','cui-textarea-62777','konfirmasi'].map(id => ({ id, text: document.getElementById(id).labels[0]?.textContent.trim() })),
    caption: document.querySelector('[data-id="b6f6ff8"] .e-gallery-image')?.getAttribute('aria-label'),
  }));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.anggi-love-story-card').first().waitFor({ timeout: 12000 });
  await page.locator('#wdp-button-wrapper button').click();
  await page.waitForTimeout(900);
  const reducedMotion = await page.evaluate(() => ({
    videoPaused: document.querySelector('.motionSection video').paused,
    videoDisplay: getComputedStyle(document.querySelector('.motionSection video')).display,
    heroBackground: getComputedStyle(document.querySelector('.motionSection')).backgroundImage,
  }));
  return { results, focus, modalClosed, audioKeyboard, audioSpace, commentNavigation, resourceUrls, aria, reducedMotion, errors };
}
