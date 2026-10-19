async (page) => {
  await page.setViewportSize({ width: 667, height: 375 });
  await page.goto('http://localhost:5173/i/anggi-ivan?to=Nuno+Rifa', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  const geometry = await page.evaluate(() => {
    const list = ['.content-modalx', '.info_modalx', '.info_modalx > .img', '.wdp-txt-the-wedding', '.wdp-mempelai', '.wdp-dear', '.wdp-name', '.wdp-button-wrapper', '.wdp-button-wrapper button'];
    return list.map(selector => {
      const el = document.querySelector(selector);
      const r = el.getBoundingClientRect();
      const c = getComputedStyle(el);
      return { selector, x:r.x,y:r.y,w:r.width,h:r.height,margin:c.margin,padding:c.padding,font:c.fontSize,background:c.backgroundImage };
    });
  });
  await page.screenshot({ path:'output/playwright/cover-fixed-667-initial.png' });
  return geometry;
}
