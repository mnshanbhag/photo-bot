const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: false, // Must be false so you can log in
    userDataDir: './user_data',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  await page.goto('https://photos.google.com', { waitUntil: 'networkidle2' });

  console.log("\n-------------------------------------------------------");
  console.log("ACTION REQUIRED: Log in to Google Photos in the browser.");
  console.log("Once you see your photos, come back here and press ENTER.");
  console.log("-------------------------------------------------------\n");
  
  process.stdin.resume();
  await new Promise(resolve => process.stdin.once('data', resolve));

  const seenPhotos = new Set();
  let duplicateCount = 0;

  async function scanAndProcess() {
    const photos = await page.$$('div[aria-label^="Photo"]');

    for (let photo of photos) {
      try {
        const label = await page.evaluate(el => el.getAttribute('aria-label'), photo);
        if (!label) continue;

        if (seenPhotos.has(label)) {
          console.log(`[DUPLICATE] Found: ${label}`);
          await photo.click();
          await new Promise(r => setTimeout(r, 700));

          await page.keyboard.press('#'); // Delete shortcut
          
          const confirmBtn = 'button[aria-label="Move to trash"]';
          await page.waitForSelector(confirmBtn, { visible: true, timeout: 5000 });
          await page.click(confirmBtn);
          
          duplicateCount++;
          console.log(`[ACTION] Moved to Trash. Total: ${duplicateCount}`);
          await new Promise(r => setTimeout(r, 1500)); 
        } else {
          seenPhotos.add(label);
        }
      } catch (e) { continue; }
    }
    // Scroll down to load more content
    await page.evaluate(() => window.scrollBy(0, 1000));
    await new Promise(r => setTimeout(r, 2000));
  }

  // Loop the scan (change 30 to a higher number for more photos)
  for (let i = 0; i < 30; i++) {
    await scanAndProcess();
  }

  console.log(`Finished. Deleted ${duplicateCount} duplicates.`);
})();
