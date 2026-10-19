async (page) => {
  await page.emulateMedia({ reducedMotion:'no-preference' });
  await page.addInitScript(() => Object.defineProperty(navigator, 'connection', { configurable:true, value:{ saveData:true } }));
  await page.setViewportSize({ width:390, height:844 });
  await page.goto('http://localhost:5173/i/anggi-ivan?to=Nuno+Rifa', { waitUntil:'domcontentloaded' });
  await page.locator('.anggi-love-story-card').first().waitFor({ timeout:12000 });
  await page.locator('#wdp-button-wrapper button').click();
  await page.waitForTimeout(500);
  return await page.evaluate(() => ({
    saveDataClass:document.documentElement.classList.contains('anggi-save-data'),
    videoPaused:document.querySelector('.motionSection video').paused,
    videoDisplay:getComputedStyle(document.querySelector('.motionSection video')).display,
    heroBackground:getComputedStyle(document.querySelector('.motionSection')).backgroundImage,
  }));
}
