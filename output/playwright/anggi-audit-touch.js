async (page) => {
  const result = [];
  for (const [width, height] of [[390, 844], [320, 568]]) {
    await page.setViewportSize({ width, height });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.anggi-love-story-card').first().waitFor({ timeout: 10000 });
    const cover = page.locator('#wdp-button-wrapper button');
    await cover.tap();
    const opened = await page.evaluate(() => document.querySelector('.modalx').classList.contains('removeCover') || document.querySelector('.modalx').classList.contains('removeModals'));
    await page.evaluate(() => {
      const gallery = document.querySelector('[data-id="b6f6ff8"]');
      scrollTo(0, gallery.getBoundingClientRect().top + scrollY - 120);
    });
    await page.waitForTimeout(1300);
    await page.locator('[data-id="b6f6ff8"] .elementor-gallery-item').first().tap();
    await page.locator('#standalone-lightbox.active').waitFor({ timeout: 5000 });
    const modal = await page.evaluate(() => {
      const img = document.querySelector('#lg-main-img').getBoundingClientRect();
      const close = document.querySelector('#lg-close-btn').getBoundingClientRect();
      return { image: [Math.round(img.width), Math.round(img.height)],
        close: [Math.round(close.x), Math.round(close.y), Math.round(close.width), Math.round(close.height)] };
    });
    await page.locator('#lg-close-btn').tap();
    result.push({ viewport: `${width}x${height}`, opened, modal,
      closed: !(await page.locator('#standalone-lightbox').evaluate((el) => el.classList.contains('active'))),
      overflowAfter: await page.evaluate(() => getComputedStyle(document.body).overflow) });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#wdp-button-wrapper button').tap();
  await page.setViewportSize({ width: 667, height: 375 });
  await page.evaluate(() => {
    const gallery = document.querySelector('[data-id="b6f6ff8"]');
    scrollTo(0, gallery.getBoundingClientRect().top + scrollY - 80);
  });
  await page.waitForTimeout(1300);
  await page.locator('[data-id="b6f6ff8"] .elementor-gallery-item').first().tap();
  await page.locator('#standalone-lightbox.active').waitFor({ timeout: 5000 });
  const landscape = await page.evaluate(() => {
    const img = document.querySelector('#lg-main-img').getBoundingClientRect();
    const close = document.querySelector('#lg-close-btn').getBoundingClientRect();
    return { image: [Math.round(img.width), Math.round(img.height)],
      close: [Math.round(close.x), Math.round(close.y), Math.round(close.width), Math.round(close.height)],
      viewport: [innerWidth, innerHeight] };
  });
  await page.locator('#lg-close-btn').tap();
  landscape.closed = !(await page.locator('#standalone-lightbox').evaluate((el) => el.classList.contains('active')));
  result.push({ viewport: '667x375 after opening in portrait', ...landscape });
  return result;
}
