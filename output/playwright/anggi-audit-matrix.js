async (page) => {
  const viewports = [
    [320, 568], [360, 640], [375, 667], [390, 844], [430, 932],
    [667, 375], [768, 1024], [1024, 768], [1366, 768], [1920, 1080],
  ];
  const results = [];

  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.anggi-love-story-card').first().waitFor({ timeout: 10000 }).catch(() => {});

    let coverClick = 'ok';
    try {
      await page.locator('#wdp-button-wrapper button').click({ timeout: 5000 });
    } catch (error) {
      coverClick = String(error).slice(0, 160);
    }
    await page.waitForTimeout(400);

    await page.evaluate(async () => {
      const step = Math.max(300, Math.floor(innerHeight * 0.9));
      const max = document.documentElement.scrollHeight;
      for (let y = 0; y < max; y += step) {
        scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      scrollTo(0, 0);
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    const data = await page.evaluate(() => {
      const visible = (el) => {
        const style = getComputedStyle(el);
        const box = el.getBoundingClientRect();
        return el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) &&
          style.display !== 'none' && style.visibility !== 'hidden' &&
          Number(style.opacity) > 0 && box.width > 0 && box.height > 0;
      };
      const describe = (el) => {
        const box = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(), id: el.id || '',
          className: typeof el.className === 'string' ? el.className.slice(0, 80) : '',
          text: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 55),
          x: Math.round(box.x), right: Math.round(box.right),
          w: Math.round(box.width), h: Math.round(box.height),
        };
      };
      const elements = [...document.querySelectorAll('body *')];
      const overflow = elements.filter((el) => visible(el) &&
        (el.getBoundingClientRect().right > innerWidth + 3 || el.getBoundingClientRect().left < -3))
        .map(describe);
      const targets = [...document.querySelectorAll('button,a,input,select,textarea,[role=button]')]
        .filter(visible)
        .filter((el) => {
          const box = el.getBoundingClientRect();
          return box.width < 24 || box.height < 24;
        }).map(describe);
      const brokenImages = [...document.images].filter((el) => visible(el) && el.complete && el.naturalWidth === 0)
        .map((el) => ({ ...describe(el), src: el.currentSrc || el.src }));
      const smallText = elements.filter((el) => visible(el) &&
        ['P', 'H1', 'H2', 'H3', 'BUTTON', 'LABEL'].includes(el.tagName) &&
        (el.innerText || '').trim().length > 3 && parseFloat(getComputedStyle(el).fontSize) < 14)
        .map((el) => ({ ...describe(el), font: getComputedStyle(el).fontSize,
          lineHeight: getComputedStyle(el).lineHeight }));
      return {
        innerWidth, innerHeight, scrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth, pageHeight: document.documentElement.scrollHeight,
        coverVisible: visible(document.querySelector('.modalx')),
        bodyOverflow: getComputedStyle(document.body).overflow,
        cards: document.querySelectorAll('.anggi-love-story-card').length,
        galleryImages: document.querySelectorAll('[data-id="b6f6ff8"] .elementor-gallery-item').length,
        overflowCount: overflow.length, overflow: overflow.slice(0, 8),
        smallTargetCount: targets.length, smallTargets: targets.slice(0, 8),
        smallTextCount: smallText.length, smallText: smallText.slice(0, 8),
        brokenImageCount: brokenImages.length, brokenImages: brokenImages.slice(0, 5),
      };
    });
    results.push({
      viewport: `${width}x${height}`, coverClick,
      width: data.innerWidth, scrollWidth: data.scrollWidth,
      pageHeight: data.pageHeight, coverVisible: data.coverVisible,
      cards: data.cards, galleryImages: data.galleryImages,
      overflowCount: data.overflowCount, overflow: data.overflow.slice(0, 5),
      smallTargetCount: data.smallTargetCount, smallTargets: data.smallTargets.slice(0, 5),
      smallTextCount: data.smallTextCount, smallText: data.smallText.slice(0, 5),
      brokenImageCount: data.brokenImageCount, brokenImages: data.brokenImages,
    });
  }
  return results;
}
