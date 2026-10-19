async (page) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.anggi-love-story-card').first().waitFor({ timeout: 10000 });
  await page.locator('#wdp-button-wrapper button').click();
  await page.waitForTimeout(450);

  const pageMetrics = await page.evaluate(() => {
    const get = (el) => {
      if (!el) return null;
      const c = getComputedStyle(el);
      const b = el.getBoundingClientRect();
      return { text: (el.innerText || el.textContent || '').trim().slice(0, 90),
        color: c.color, background: c.backgroundColor, font: c.fontSize,
        lineHeight: c.lineHeight, width: Math.round(b.width), height: Math.round(b.height) };
    };
    const exact = (selector, text) => [...document.querySelectorAll(selector)].find((el) =>
      el.textContent?.trim().includes(text));
    const input = document.querySelector('#author');
    const textarea = document.querySelector('#cui-textarea-62777');
    const select = document.querySelector('#konfirmasi');
    const audio = document.querySelector('#audio-container');
    const audioBox = audio.getBoundingClientRect();
    const galleryLink = document.querySelector('[data-id="b6f6ff8"] .elementor-gallery-item');
    return {
      akadTime: get(exact('h2', 'Pukul : 10:00')),
      akadAddress: get(exact('p', 'Ballroom Mall Metropolitan')),
      locationLink: get(exact('a', 'Lihat Lokasi')),
      loveDescription: get(document.querySelector('.anggi-love-story-description')),
      rsvpIntro: get(exact('p', 'Konfirmasi Kehadiran & Ucapan')),
      giftIntro: get(exact('p', 'Doa restu anda merupakan')),
      giftPrompt: get(exact('h2', 'Klik Wedding Gift')),
      form: {
        name: { labels: input.labels?.length || 0, aria: input.getAttribute('aria-label'),
          placeholder: getComputedStyle(input, '::placeholder').color, background: getComputedStyle(input).backgroundColor },
        message: { labels: textarea.labels?.length || 0, aria: textarea.getAttribute('aria-label'),
          placeholder: getComputedStyle(textarea, '::placeholder').color, background: getComputedStyle(textarea).backgroundColor },
        attendance: { labels: select.labels?.length || 0, aria: select.getAttribute('aria-label'),
          title: select.getAttribute('title') },
      },
      audio: { role: audio.getAttribute('role'), tabIndex: audio.tabIndex,
        width: audioBox.width, height: audioBox.height, visibleWidth: Math.max(0, Math.min(innerWidth, audioBox.right) - Math.max(0, audioBox.left)) },
      galleryAlt: galleryLink.querySelector('img')?.alt,
      mapLinks: [...document.querySelectorAll('a')].filter((el) => el.textContent?.includes('Lihat Lokasi'))
        .map((el) => ({ href: el.href, target: el.target })),
    };
  });

  await page.getByRole('button', { name: 'Wedding Gift' }).click();
  const copy = page.locator('.figma-btn-copy').first();
  await copy.scrollIntoViewIfNeeded();
  const copyBefore = await copy.innerText();
  await copy.click();
  await page.waitForTimeout(350);
  const copyAfter = await copy.innerText();
  const giftDisplayed = await page.locator('.figma-btn-copy').count();

  const comments = page.locator('#cui-link-62777');
  const commentHref = await comments.getAttribute('href');
  await comments.click();
  await page.waitForTimeout(400);
  const afterComments = { url: page.url(), href: commentHref };

  return { pageMetrics, giftDisplayed, copyBefore, copyAfter, afterComments };
}
