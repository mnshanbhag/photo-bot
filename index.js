const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async function() {
  const args = process.argv.slice(2);
  const startDate = args[0] || "Jan 1 2010";
  const endDate = args[1] || "Dec 31 2011";
  const dateRange = `${startDate} to ${endDate}`;
  const searchUrl = `https://photos.google.com/search/${encodeURIComponent(dateRange)}`;
  
  const DRY_RUN = false; 

  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const page = pages.find(p => p.url().includes('photos.google.com')) || pages[0];

  console.log(`\n--- RESILIENT 2024 CLEANUP: ${dateRange} ---`);
  await page.goto(searchUrl, { waitUntil: 'networkidle2' });

  console.log("\n[ACTION] Press ENTER here once the photos are loaded.");
  process.stdin.resume();
  await new Promise(resolve => process.stdin.once('data', resolve));

  const fingerprintToPrimaryId = {}; 
  const processedImmutableIds = new Set(); 
  let deletedCount = 0;
  let emptyScanCount = 0;

  async function cleanup() {
    try {
      // 1. FLEXIBLE URL GUARD
      // Only reload if we are clearly not in a search context anymore
      if (!page.url().includes('/search/')) {
        console.log("\n[!] Displaced from Search. Navigating back...");
        await page.goto(searchUrl, { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 4000));
        return; // Exit current scan to let page settle
      }

      const items = await page.$$('a[href*="/photo/"]');
      
      // 2. STUCK DETECTION
      // If we see 0 photos for 3 scans, Google might have "frozen" the grid.
      if (items.length === 0) {
        emptyScanCount++;
        if (emptyScanCount >= 3) {
          console.log("\n[!] Grid appears frozen. Refreshing...");
          await page.reload({ waitUntil: 'networkidle2' });
          emptyScanCount = 0;
        }
        return;
      }
      emptyScanCount = 0;

      let lastElement = null;
      for (let i = 0; i < items.length; i++) {
        const el = items[i];
        const photoData = await page.evaluate(node => {
          const label = node.getAttribute('aria-label');
          const rawUrl = node.href;
          if (!label || label.includes("Select all") || !/20[0-9]{2}/.test(label)) return null;

          const urlParts = rawUrl.split('/');
          const photoId = urlParts[urlParts.length - 1].split('?')[0];
          const img = node.querySelector('img');
          const imgHash = img ? img.src.split('=')[0] : 'none';

          return {
            label: label,
            immutableId: photoId,
            fingerprint: `${label}_visual_${imgHash}`
          };
        }, el);

        if (!photoData) continue;
        lastElement = el;

        if (processedImmutableIds.has(photoData.immutableId)) continue;

        // 3. DUPLICATE LOGIC (IMMUTABLE ID SECURED)
        if (!fingerprintToPrimaryId[photoData.fingerprint]) {
          fingerprintToPrimaryId[photoData.fingerprint] = photoData.immutableId;
          processedImmutableIds.add(photoData.immutableId);
          continue; 
        }

        if (fingerprintToPrimaryId[photoData.fingerprint] !== photoData.immutableId) {
          console.log(`\n[!] VERIFIED DUPE: ${photoData.label}`);
          
          if (DRY_RUN) {
            processedImmutableIds.add(photoData.immutableId);
            deletedCount++;
            continue;
          }

          try {
            const selected = await page.evaluate(node => {
              const container = node.closest('div[role="listitem"]') || node.parentElement;
              const check = container.querySelector('div[role="checkbox"]') || container.querySelector('[aria-label*="Select"]');
              if (check) { check.click(); return true; }
              return false;
            }, el);

            if (selected) {
              await new Promise(r => setTimeout(r, 1200)); // Wait for UI stability
              const trashTriggered = await page.evaluate(async () => {
                const findBtn = (t) => Array.from(document.querySelectorAll('button')).find(b => (b.getAttribute('aria-label') || "").toLowerCase().includes(t));
                let btn = findBtn('trash') || findBtn('delete');
                if (btn) { btn.click(); return true; }
                const more = document.querySelector('button[aria-label="More options"]');
                if (more) {
                  more.click(); await new Promise(r => setTimeout(r, 700));
                  btn = Array.from(document.querySelectorAll('div[role="menuitem"]')).find(m => m.innerText.toLowerCase().includes('trash') || m.innerText.toLowerCase().includes('delete'));
                  if (btn) { btn.click(); return true; }
                }
                return false;
              });

              if (trashTriggered) {
                const confirmed = await page.evaluate(async () => {
                  for (let j = 0; j < 15; j++) {
                    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText && b.innerText.toLowerCase().includes('move to trash'));
                    if (confirmBtn = btn) { confirmBtn.click(); return true; }
                    await new Promise(r => setTimeout(r, 500));
                  }
                  return false;
                });
                if (confirmed) {
                  deletedCount++;
                  processedImmutableIds.add(photoData.immutableId);
                  console.log("    [SUCCESS] Deleted.");
                  await new Promise(r => setTimeout(r, 2500)); // Longer wait to prevent SPA collapse
                  continue;
                }
              }
              await page.keyboard.press('Escape');
            }
          } catch (e) { await page.keyboard.press('Escape'); }
        }
      }

      // 4. AGGRESSIVE SCROLL
      if (lastElement) {
        await page.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'end' }), lastElement);
        // Add a manual PageDown to nudge the Virtual List
        await page.keyboard.press('PageDown');
      } else {
        await page.keyboard.press('PageDown');
      }
      await new Promise(r => setTimeout(r, 3500)); // Render buffer
    } catch (e) { }
  }

  for (let k = 0; k < 10000; k++) {
    process.stdout.write(`\rScan ${k+1} | Tracking: ${Object.keys(fingerprintToPrimaryId).length} | Deleted: ${deletedCount}`);
    await cleanup();
  }
})();
