async (page) => {
  return await page.evaluate(() => {
    const ids = ['.modalx', '.content-modalx', '#wdp-button-wrapper button', '[data-id="b6f6ff8"]', '[data-id="b6f6ff8"] .e-gallery-item', '#audio-container'];
    const boxes = ids.map(s => {
      const el = document.querySelector(s);
      if (!el) return { s, missing: true };
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return { s, rect: { x:r.x,y:r.y,w:r.width,h:r.height }, display:cs.display, visibility:cs.visibility, opacity:cs.opacity, overflow:cs.overflow, className:el.className };
    });
    return { viewport:[innerWidth,innerHeight], scrollWidth:document.documentElement.scrollWidth, bodyOverflow:getComputedStyle(document.body).overflow, boxes };
  });
}
