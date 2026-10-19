async (page) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('http://localhost:5173/i/anggi-ivan?to=Nuno+Rifa', { waitUntil: 'domcontentloaded' });
  await page.locator('.anggi-love-story-card').first().waitFor({ timeout: 10000 });
  await page.screenshot({ path: 'output/playwright/cover-320x568.png', scale: 'css' });
  await page.locator('#wdp-button-wrapper button').click();
  await page.locator('[data-id="fb0c64e"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'output/playwright/akad-320x568.png', scale: 'css' });
  await page.locator('#anggi-ivan-love-story').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.locator('#anggi-ivan-love-story').screenshot({ path: 'output/playwright/love-story-320x568.png', scale: 'css' });

  const mobileMetrics = await page.evaluate(() => {
    const audio = document.querySelector('#audio-container').getBoundingClientRect();
    const link = [...document.querySelectorAll('a')].find((el) => el.textContent?.includes('Lihat Lokasi'))?.getBoundingClientRect();
    const gift = [...document.querySelectorAll('a')].find((el) => el.textContent?.includes('Wedding Gift'))?.getBoundingClientRect();
    return {
      width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
      audio: { x: audio.x, width: audio.width, visibleWidth: Math.max(0, Math.min(innerWidth, audio.right) - Math.max(0, audio.left)) },
      locationLink: link ? [link.width, link.height] : null,
      giftLink: gift ? [gift.width, gift.height] : null,
    };
  });

  const countdownBefore = await page.locator('.elementor-countdown-seconds').first().textContent();
  await page.waitForTimeout(1400);
  const countdownAfter = await page.locator('.elementor-countdown-seconds').first().textContent();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#wdp-button-wrapper button').click();
  await page.locator('[data-id="fb0c64e"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  const normalMotion = await page.locator('[data-id="fb0c64e"]').evaluate((el) => ({
    duration: getComputedStyle(el).animationDuration,
    animation: getComputedStyle(el).animationName,
  }));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#wdp-button-wrapper button').click();
  await page.locator('[data-id="fb0c64e"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  const reducedMotion = await page.locator('[data-id="fb0c64e"]').evaluate((el) => ({
    matched: matchMedia('(prefers-reduced-motion: reduce)').matches,
    duration: getComputedStyle(el).animationDuration,
    animation: getComputedStyle(el).animationName,
  }));

  const beforeZoom = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  const syntheticZoom = await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
    return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
      form: document.querySelector('#commentform-62777').getBoundingClientRect().toJSON(),
      story: document.querySelector('#anggi-ivan-love-story').getBoundingClientRect().toJSON() };
  });
  await page.evaluate(() => { document.documentElement.style.zoom = ''; });
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  const contrast = await page.evaluate(() => {
    const rgb = (value) => (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    const luminance = (colors) => colors.map((v) => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
    const ratio = (a, b) => {
      const x = luminance(rgb(a)); const y = luminance(rgb(b));
      return Math.round(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)) * 100) / 100;
    };
    const input = document.querySelector('#author');
    const story = document.querySelector('.anggi-love-story-description');
    const storyBg = document.querySelector('#anggi-ivan-love-story');
    return {
      namePlaceholderWhite: ratio(getComputedStyle(input, '::placeholder').color, getComputedStyle(input).backgroundColor),
      storyTextSolidBackground: ratio(getComputedStyle(story).color, getComputedStyle(storyBg).backgroundColor),
    };
  });

  return { mobileMetrics, countdownBefore, countdownAfter,
    normalMotion, reducedMotion, beforeZoom, syntheticZoom, contrast };
}
