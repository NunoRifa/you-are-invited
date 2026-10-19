async (page) => {
  const url = 'http://localhost:5173/api/invitations/anggi-ivan';
  const response = await page.request.get(url);
  const actual = await response.json();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  const cases = [];
  try {
    for (const [name, loveStory] of [
      ['empty', []],
      ['text-only', [{ ...actual.loveStory[0], photoAssetId: null, photoUrl: null }]],
      ['one-blank-one-valid', [
        { ...actual.loveStory[0], description: '', photoAssetId: null, photoUrl: null },
        actual.loveStory[1],
      ]],
    ]) {
      await page.route(url, (route) => route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ ...actual, loveStory }) }));
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(550);
      cases.push({ name, result: await page.evaluate(() => {
        const section = document.querySelector('#anggi-ivan-love-story');
        return { display: getComputedStyle(section).display,
          cards: section.querySelectorAll('.anggi-love-story-card').length,
          images: section.querySelectorAll('.anggi-love-story-photo').length,
          titles: [...section.querySelectorAll('.anggi-love-story-title')].map((el) => el.textContent),
        };
      }) });
      await page.unroute(url);
    }
  } finally {
    await page.unroute(url);
    await page.reload({ waitUntil: 'domcontentloaded' });
  }
  return { cases, pageErrors };
}
