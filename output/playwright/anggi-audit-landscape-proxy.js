async (page) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#wdp-button-wrapper button').click();
  await page.evaluate(() => {
    const gallery = document.querySelector('[data-id="b6f6ff8"]');
    scrollTo(0, gallery.getBoundingClientRect().top + scrollY - 150);
  });
  await page.waitForTimeout(1100);
  await page.locator('[data-id="b6f6ff8"] .elementor-gallery-item').first().click();
  await page.locator('#standalone-lightbox.active').waitFor();

  const landscapeUrl = '/api/assets/ast-1cacf836-0328-431b-9ddd-103ad753c045';
  await page.locator('#lg-main-img').evaluate(async (img, src) => { img.src = src; await img.decode(); }, landscapeUrl);
  const measure = async () => page.locator('#lg-main-img').evaluate((img) => {
    const rect = img.getBoundingClientRect();
    return { natural: [img.naturalWidth, img.naturalHeight],
      shown: [Math.round(rect.width), Math.round(rect.height)], fit: getComputedStyle(img).objectFit,
      viewport: [innerWidth, innerHeight] };
  });
  const portraitViewport = await measure();
  await page.screenshot({ path: 'output/playwright/gallery-landscape-proxy-390.png', scale: 'css' });
  await page.setViewportSize({ width: 667, height: 375 });
  await page.waitForTimeout(250);
  const landscapeViewport = await measure();
  await page.screenshot({ path: 'output/playwright/gallery-landscape-proxy-667.png', scale: 'css' });
  await page.locator('#lg-close-btn').click();
  return { note: 'Existing invitation-owned landscape photo substituted only in the browser; the six saved gallery photos are portrait.',
    portraitViewport, landscapeViewport };
}
