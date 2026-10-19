async (page) => {
  const failures = [];
  const errors = [];
  page.on('requestfailed', (request) => failures.push({ url: request.url(), error: request.failure()?.errorText }));
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.anggi-love-story-card').first().waitFor({ timeout: 10000 });

  const beforeCover = await page.evaluate(() => ({
    overflow: getComputedStyle(document.body).overflow,
    button: (() => { const r = document.querySelector('#wdp-button-wrapper button').getBoundingClientRect(); return { y: r.y, height: r.height, bottom: r.bottom }; })(),
  }));
  await page.locator('#wdp-button-wrapper button').click();
  await page.waitForTimeout(500);
  const afterCover = await page.evaluate(() => ({
    removed: document.querySelector('.modalx').classList.contains('removeCover') || document.querySelector('.modalx').classList.contains('removeModals'),
    overflow: getComputedStyle(document.body).overflow,
    audioPaused: document.querySelector('#song')?.paused,
  }));

  const sections = await page.evaluate(() => [...document.querySelectorAll('section.elementor-top-section')].map((el, index) => ({
    index, id: el.id || '', height: Math.round(el.getBoundingClientRect().height),
    text: (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 95),
  })));
  const loveCards = [];
  for (const card of await page.locator('.anggi-love-story-card').all()) {
    await card.scrollIntoViewIfNeeded();
    const image = card.locator('img');
    if (await image.count()) await image.evaluate(async (img) => { try { await img.decode(); } catch {} });
    loveCards.push(await card.evaluate((el) => {
      const image = el.querySelector('img');
      const desc = el.querySelector('p');
      const box = el.getBoundingClientRect();
      const imageBox = image?.getBoundingClientRect();
      return {
        title: el.querySelector('h3')?.textContent?.trim(), descriptionLength: desc?.textContent?.trim().length || 0,
        cardWidth: Math.round(box.width), imageWidth: Math.round(imageBox?.width || 0),
        imageHeight: Math.round(imageBox?.height || 0), intrinsicWidth: image?.naturalWidth || 0,
        intrinsicHeight: image?.naturalHeight || 0, descriptionFont: desc ? getComputedStyle(desc).fontSize : null,
        descriptionLineHeight: desc ? getComputedStyle(desc).lineHeight : null,
      };
    }));
  }
  await page.screenshot({ path: 'output/playwright/full-390x844.png', fullPage: true, scale: 'css' });
  await page.locator('#anggi-ivan-love-story').screenshot({ path: 'output/playwright/love-story-390x844.png', scale: 'css' });

  const gallery = page.locator('[data-id="b6f6ff8"] .elementor-gallery-item');
  const galleryItems = [];
  const count = await gallery.count();
  const modal = page.locator('#standalone-lightbox');
  const modalChecks = {};
  for (let i = 0; i < count; i++) {
    await gallery.nth(i).scrollIntoViewIfNeeded();
    await gallery.nth(i).click();
    await page.locator('#standalone-lightbox.active').waitFor({ timeout: 5000 });
    await page.locator('#lg-main-img').evaluate(async (img) => { try { await img.decode(); } catch {} });
    const state = await page.evaluate(() => {
      const img = document.querySelector('#lg-main-img');
      const close = document.querySelector('#lg-close-btn');
      const rect = img.getBoundingClientRect();
      const closeRect = close.getBoundingClientRect();
      const hit = document.elementFromPoint(closeRect.x + closeRect.width / 2, closeRect.y + closeRect.height / 2);
      return {
        index: document.querySelector('#lg-counter-text')?.textContent,
        natural: [img.naturalWidth, img.naturalHeight], shown: [Math.round(rect.width), Math.round(rect.height)],
        fit: getComputedStyle(img).objectFit, close: [Math.round(closeRect.x), Math.round(closeRect.y), Math.round(closeRect.width), Math.round(closeRect.height)],
        closeHit: hit === close || close.contains(hit), focus: document.activeElement?.id || document.activeElement?.tagName,
        bodyOverflow: getComputedStyle(document.body).overflow,
      };
    });
    galleryItems.push(state);
    if (i < 2) await page.screenshot({ path: `output/playwright/gallery-modal-390-item${i + 1}.png`, scale: 'css' });

    if (i === 0) {
      await page.locator('#lg-next-btn').click();
      modalChecks.next = await page.locator('#lg-counter-text').textContent();
      await page.locator('#lg-prev-btn').click();
      modalChecks.prev = await page.locator('#lg-counter-text').textContent();
      await page.locator('#lg-close-btn').click();
      modalChecks.closeX = !(await modal.evaluate((el) => el.classList.contains('active')));
      modalChecks.overflowAfterX = await page.evaluate(() => getComputedStyle(document.body).overflow);
    } else if (i === 1) {
      await page.mouse.click(5, 400);
      modalChecks.backdrop = !(await modal.evaluate((el) => el.classList.contains('active')));
    } else if (i === 2) {
      await page.keyboard.press('Escape');
      modalChecks.escape = !(await modal.evaluate((el) => el.classList.contains('active')));
    } else if (i === 3) {
      const focus = [];
      for (let n = 0; n < 5; n++) {
        await page.keyboard.press('Tab');
        focus.push(await page.evaluate(() => ({ id: document.activeElement?.id || '',
          insideModal: document.querySelector('#standalone-lightbox')?.contains(document.activeElement) })));
      }
      modalChecks.focusSequence = focus;
      await page.keyboard.press('Escape');
      modalChecks.escapeAfterTab = !(await modal.evaluate((el) => el.classList.contains('active')));
    } else {
      await page.locator('#lg-close-btn').click();
    }
    if (await modal.evaluate((el) => el.classList.contains('active'))) await page.locator('#lg-close-btn').click();
  }

  const musicBefore = await page.evaluate(() => ({
    paused: document.querySelector('#song')?.paused,
    target: (() => { const el = document.querySelector('#audio-container'); const r = el.getBoundingClientRect(); return { role: el.getAttribute('role'), tabIndex: el.tabIndex, x: r.x, y: r.y, width: r.width, height: r.height }; })(),
  }));
  let musicClick = 'ok';
  try { await page.locator('#audio-container').click({ timeout: 5000 }); } catch (error) { musicClick = String(error).slice(0, 180); }
  const musicAfter = await page.evaluate(() => ({ paused: document.querySelector('#song')?.paused }));

  let gift = {};
  try {
    await page.getByRole('button', { name: 'Wedding Gift' }).click({ timeout: 5000 });
    gift = await page.evaluate(() => ({
      copyButtons: [...document.querySelectorAll('.figma-btn-copy')].filter((el) => el.checkVisibility()).length,
      text: document.querySelector('.figma-card')?.innerText?.slice(0, 100) || '',
    }));
    const copy = page.locator('.figma-btn-copy').first();
    if (await copy.count()) {
      await copy.click({ timeout: 5000 });
      gift.feedback = await copy.innerText();
    }
  } catch (error) { gift.error = String(error).slice(0, 180); }

  await page.getByRole('button', { name: 'Kirim' }).click();
  const rsvpError = await page.locator('#cui-comment-status-62777').innerText();

  return {
    beforeCover, afterCover, sections, loveCards,
    galleryItems, modalChecks, musicBefore, musicClick, musicAfter, gift, rsvpError,
    pageErrors: errors, failedRequests: failures.slice(0, 15),
  };
}
