async (page) => {
  await page.setViewportSize({ width:390, height:844 });
  await page.goto('http://localhost:5173/i/anggi-ivan?to=Nuno+Rifa', { waitUntil:'domcontentloaded' });
  await page.locator('.anggi-love-story-card').first().waitFor({ timeout:12000 });
  await page.locator('#wdp-button-wrapper button').click();
  await page.keyboard.press('Tab');
  await page.locator('#cui-link-62777').focus();
  const commentFocus = await page.evaluate(() => { const e=document.querySelector('#cui-link-62777'); const s=getComputedStyle(e); return { matches:e.matches(':focus-visible'), outline:s.outline, shadow:s.boxShadow }; });
  await page.locator('#author').focus();
  const fieldFocus = await page.evaluate(() => { const e=document.querySelector('#author'); const s=getComputedStyle(e); const p=e.closest('.comment-form-author'); return { matches:e.matches(':focus-visible'), outline:s.outline, shadow:s.boxShadow, wrapperOutline:getComputedStyle(p).outline }; });
  await page.evaluate(() => document.querySelector('[data-id="2f59679"] a').scrollIntoView());
  await page.waitForTimeout(1800);
  const typography = await page.evaluate(() => {
    const styles = selector => { const el=document.querySelector(selector); const s=getComputedStyle(el); return { size:s.fontSize,lineHeight:s.lineHeight }; };
    return {
      rsvpIntro:styles('[data-id="9deac50"] p'),
      giftIntro:styles('[data-id="011fd0c"] p'),
      giftPrompt:styles('[data-id="4854ef2"] .elementor-heading-title'),
      mapLink:styles('[data-id="2f59679"] a'),
      mapHeight:document.querySelector('[data-id="2f59679"] a').getBoundingClientRect().height,
    };
  });
  return { commentFocus, fieldFocus, typography };
}
