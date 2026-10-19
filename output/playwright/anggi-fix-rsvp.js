async (page) => {
  const posts = [];
  const errors = [];
  page.on('request', request => { if (request.method() === 'POST') posts.push(request.url()); });
  page.on('pageerror', error => errors.push(String(error)));
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('http://localhost:5173/i/anggi-ivan?to=Nuno+Rifa', { waitUntil:'domcontentloaded' });
  await page.locator('.anggi-love-story-card').first().waitFor({ timeout:12000 });
  await page.locator('#wdp-button-wrapper button').click();
  await page.evaluate(() => document.querySelector('#commentform-62777').scrollIntoView());
  await page.waitForTimeout(650);
  await page.locator('#submit-62777').click();
  const missingName = await page.evaluate(() => ({
    message: document.querySelector('#cui-comment-status-62777').textContent.trim(),
    focused: document.activeElement.id,
    invalid: document.querySelector('#author').getAttribute('aria-invalid'),
  }));
  await page.locator('#author').fill('Nuno');
  await page.locator('#submit-62777').click();
  const missingMessage = await page.evaluate(() => ({
    message: document.querySelector('#cui-comment-status-62777').textContent.trim(),
    focused: document.activeElement.id,
    invalid: document.querySelector('#cui-textarea-62777').getAttribute('aria-invalid'),
    authorInvalid: document.querySelector('#author').getAttribute('aria-invalid'),
  }));
  await page.locator('#cui-textarea-62777').fill('Doa restu');
  const afterTyping = await page.evaluate(() => document.querySelector('#cui-textarea-62777').getAttribute('aria-invalid'));
  await page.evaluate(() => document.querySelector('#btnAmplop').scrollIntoView());
  await page.waitForTimeout(600);
  await page.locator('#btnAmplop').click();
  const gift = await page.evaluate(() => ({ expanded:document.querySelector('#btnAmplop').getAttribute('aria-expanded'), cards:document.querySelectorAll('.figma-debit-card').length }));
  return { missingName, missingMessage, afterTyping, gift, posts, errors };
}
