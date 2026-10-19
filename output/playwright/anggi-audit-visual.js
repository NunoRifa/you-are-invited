async (page) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.anggi-love-story-card').first().waitFor({ timeout: 10000 });
  await page.locator('#wdp-button-wrapper button').click();
  await page.waitForTimeout(750);

  const sections = page.locator('section.elementor-top-section');
  const sectionMetrics = [];
  for (const index of [1, 2, 4, 5, 6, 7, 8, 9]) {
    const section = sections.nth(index);
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(900);
    const info = await section.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const descendants = [...el.querySelectorAll('h1,h2,h3,p,a,button,img')].filter((node) =>
        node.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }));
      return {
        top: Math.round(box.top), height: Math.round(box.height),
        visibleCount: descendants.length,
        sample: descendants.slice(0, 5).map((node) => ({ tag: node.tagName, text: (node.innerText || node.alt || '').slice(0, 50),
          opacity: getComputedStyle(node).opacity, font: getComputedStyle(node).fontSize })),
      };
    });
    sectionMetrics.push({ index, ...info });
    if ([2, 4, 5, 7, 8].includes(index)) {
      await section.screenshot({ path: `output/playwright/section-${index}-390.png`, scale: 'css' });
    }
  }

  const gallery = page.locator('[data-id="b6f6ff8"] .elementor-gallery-item').first();
  await gallery.scrollIntoViewIfNeeded();
  await gallery.click();
  await page.waitForTimeout(900);
  const modal = await page.evaluate(() => {
    const el = document.querySelector('#standalone-lightbox');
    const img = document.querySelector('#lg-main-img');
    const style = getComputedStyle(el);
    const imgStyle = getComputedStyle(img);
    const box = el.getBoundingClientRect();
    return {
      active: el.classList.contains('active'), display: style.display, opacity: style.opacity,
      zIndex: style.zIndex, background: style.backgroundColor, box: { x: box.x, y: box.y, w: box.width, h: box.height },
      image: { opacity: imgStyle.opacity, display: imgStyle.display, src: img.currentSrc,
        natural: [img.naturalWidth, img.naturalHeight] },
    };
  });
  await page.screenshot({ path: 'output/playwright/gallery-modal-390-delayed.png', scale: 'css' });
  await page.locator('#lg-close-btn').click();

  return { sectionMetrics, modal };
}
