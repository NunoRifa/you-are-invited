async (page) => {
  await page.setViewportSize({ width:390, height:844 });
  await page.goto('http://localhost:5173/i/anggi-ivan?to=Nuno+Rifa', { waitUntil:'domcontentloaded' });
  await page.locator('.anggi-love-story-card').first().waitFor({ timeout:12000 });
  await page.locator('#wdp-button-wrapper button').click();
  await page.keyboard.press('Tab');
  await page.locator('#author').focus();
  return await page.evaluate(() => {
    const el = document.querySelector('#author');
    const matched=[];
    const visit=(rules,source) => {
      for (const rule of rules) {
        if (rule.cssRules) { visit(rule.cssRules, source); continue; }
        if (!rule.selectorText) continue;
        try {
          if (!el.matches(rule.selectorText)) continue;
          const style=rule.style;
          if (style.outline || style.outlineWidth || style.boxShadow) matched.push({source,selector:rule.selectorText,outline:style.outline,outlinePriority:style.getPropertyPriority('outline'),shadow:style.boxShadow,shadowPriority:style.getPropertyPriority('box-shadow')});
        } catch {}
      }
    };
    for (const sheet of document.styleSheets) {
      try { visit(sheet.cssRules, sheet.href || sheet.ownerNode?.id || 'inline'); } catch {}
    }
    return {closest:!!el.closest('.elementor-62777'),form:!!el.closest('#commentform-62777'),visible:el.matches(':focus-visible'),computed:getComputedStyle(el).outline,matched:matched.slice(-20)};
  });
}
