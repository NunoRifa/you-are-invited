async (page) => {
  await page.setViewportSize({ width:667, height:375 });
  await page.goto('http://localhost:5173/i/anggi-ivan?to=Nuno+Rifa', { waitUntil:'domcontentloaded' });
  await page.locator('.anggi-love-story-card').first().waitFor({ timeout:12000 });
  await page.keyboard.press('Tab');
  const before = await page.evaluate(() => ({ focused:document.activeElement.outerHTML.slice(0,100), buttonBottom:document.querySelector('#wdp-button-wrapper button').getBoundingClientRect().bottom }));
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => ({ coverHidden:document.querySelector('.modalx').getAttribute('aria-hidden'), coverInert:document.querySelector('.modalx').inert, focused:document.activeElement.className, overflow:getComputedStyle(document.body).overflow }));
  return { before, after };
}
