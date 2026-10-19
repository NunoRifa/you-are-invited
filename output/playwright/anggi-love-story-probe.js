async (page) => {
  await page.emulateMedia({ reducedMotion:'no-preference' });
  await page.setViewportSize({ width:390, height:844 });
  await page.goto('http://localhost:5173/i/anggi-ivan?to=Nuno+Rifa', { waitUntil:'domcontentloaded' });
  await page.locator('.anggi-love-story-card').first().waitFor({ timeout:12000 });
  await page.locator('#wdp-button-wrapper button').click();
  const third = page.locator('.anggi-love-story-card').nth(2);
  await third.scrollIntoViewIfNeeded();
  await page.waitForTimeout(2500);
  await page.locator('#anggi-ivan-love-story').screenshot({ path:'output/playwright/love-story-fixed-settled.png' });
  const state = await page.evaluate(() => {
    const section = document.querySelector('#anggi-ivan-love-story');
    const card = section.querySelectorAll('.anggi-love-story-card')[2];
    const photo = card.querySelector('img');
    const title = card.querySelector('h3');
    const description = card.querySelector('p');
    const rect = e => { const r=e.getBoundingClientRect(); return { x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom }; };
    return { section:rect(section), card:rect(card), photo:rect(photo), title:rect(title), description:rect(description), sectionBackground:getComputedStyle(section).backgroundColor, cardBackground:getComputedStyle(card).backgroundColor, textBackground:getComputedStyle(description).backgroundColor, nextSection:rect(section.nextElementSibling), underText:document.elementFromPoint(100, Math.min(innerHeight-20, Math.max(20, rect(description).y+15)))?.className };
  });
  return state;
}
