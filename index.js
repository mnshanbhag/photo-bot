/**
 * GOOGLE PHOTOS DUPLICATE CLEANER - v2026.10 (IMMUTABLE ID EDITION)
 * 
 * CORE FIXES:
 * 1. Self-Deletion Shield: Uses the internal Google Photo ID (AF1Q...) to distinguish 
 *    between a photo and a re-scan of the same photo during scrolling.
 * 2. Visual Fingerprinting: Combines the metadata label with the image source hash 
 *    to ensure orientation (Portrait/Landscape) is respected.
 * 3. Deep-Vision: Targets <a> tags directly to bypass randomized <div> structures.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async function() {
  const args = process.argv.slice(2);
  const startDate = args[0] || "Jan 1 2010";
  const endDate = args[1] || "Dec 31 2011";
  const dateRange = `${startDate} to ${endDate}`;
  
  // Toggle this to true for testing without trashing anything
  const DRY_RUN = false; 

  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const page = pages.find(p => p.url().includes('photos.google.com')) || pages[0];

  console.log(`\n--- IMMUTABLE-ID CLEANUP: ${dateRange} ---`);
  await page.goto(`https://photos.google.com/search/${encodeURIComponent(dateRange)}`, { waitUntil: 'networkidle2' });

  console.log("\n[ACTION] Press ENTER here once the photos are visible.");
  process.stdin.resume();
  await new Promise(resolve => process.stdin.once('data', resolve));

  // Memory that persists for the entire session
  const fingerprintToPrimaryId = {}; 
  const processedImmutableIds = new Set(); 
  let deletedCount = 0;

  async function cleanup() {
    try {
      // Find every link that points to a specific photo
      const items = await page.$$('a[href*="/photo/"]');
      let lastElement = null;

      for (let i = 0; i < items.length; i++) {
        const el = items[i];
        
        const photoData = await page.evaluate(node => {
          const label = node.getAttribute('aria-label');
          const rawUrl = node.href;
          
          // Strict filtering to ignore UI headers, tip cards, or non-dated items
          if (!label || label.includes("Select all") || !/201[0-9]/.test(label)) return null;

          // EXTRACT IMMUTABLE ID: The unique string (AF1Q...) at the end of the URL.
          // This prevents the bot from deleting a photo just because it saw it twice.
          const urlParts = rawUrl.split('/');
          const photoId = urlParts[urlParts.length - 1].split('?')[0];

          const img = node.querySelector('img');
          const imgHash = img ? img.src.split('=')[0] : 'none';

          return {
            label: label,
            immutableId: photoId,
            // A dupe must match both the label AND the visual image source
            fingerprint: `${label}_visual_${imgHash}`
          };
        }, el);

        // If it's a UI element or we've already decided what to do with this specific file ID, skip it.
        if (!photoData || processedImmutableIds.has(photoData.immutableId)) continue;
        lastElement = el;

        // CHECK: Is this a new visual fingerprint?
        if (!fingerprintToPrimaryId[photoData.fingerprint]) {
          // Mark this specific Immutable ID as the "Master Original" for this fingerprint
          fingerprintToPrimaryId[photoData.fingerprint] = photoData.immutableId;
          processedImmutableIds.add(photoData.immutableId);
          continue; 
        }

        // VERIFICATION: If the fingerprint matches but the Google ID is different, it's a clone.
        if (fingerprintToPrimaryId[photoData.fingerprint] !== photoData.immutableId) {
          console.log(`\n[!] VERIFIED DUPE: ${photoData.label}`);
          console.log(`    Original ID: ${fingerprintToPrimaryId[photoData.fingerprint]}`);
          console.log(`    Duplicate ID: ${photoData.immutableId}`);
          
          if (DRY_RUN) {
            processedImmutableIds.add(photoData.immutableId);
            deletedCount++;
            continue;
          }

          try {
            // 1. SELECT: Click the checkbox relative to the photo link
            const selected = await page.evaluate(node => {
              const container = node.closest('div[role="listitem"]') || node.parentElement;
              const check = container.querySelector('div[role="checkbox"]') || container.querySelector('[aria-label*="Select"]');
              if (check) { check.click(); return true; }
              return false;
            }, el);

            if (selected) {
              await new Promise(r => setTimeout(r, 1000));
              
              // 2. TRASH TRIGGER: Hunt for the Trash button in top bar or overflow menu
              const trashTriggered = await page.evaluate(async () => {
                const findBtn = (txt) => Array.from(document.querySelectorAll('button'))
                  .find(b => (b.getAttribute('aria-label') || "").toLowerCase().includes(txt));

                let btn = findBtn('trash') || findBtn('delete');
                if (btn) { btn.click(); return true; }

                const more = document.querySelector('button[aria-label="More options"]');
                if (more) {
                  more.click();
                  await new Promise(r => setTimeout(r, 600));
                  const menu = Array.from(document.querySelectorAll('div[role="menuitem"]'))
                    .find(m => m.innerText.toLowerCase().includes('trash') || m.innerText.toLowerCase().includes('delete'));
                  if (menu) { menu.click(); return true; }
                }
                return false;
              });

              if (trashTriggered) {
                // 3. CONFIRM: Click final "Move to trash" button in the popup
                const confirmed = await page.evaluate(async () => {
                  for (let j = 0; j < 15; j++) {
                    const btn = Array.from(document.querySelectorAll('button'))
                      .find(b => b.innerText && b.innerText.toLowerCase().includes('move to trash'));
                    if (btn) { btn.click(); return true; }
                    await new Promise(r => setTimeout(r, 500));
                  }
                  return false;
                });

                if (confirmed) {
                  deletedCount++;
                  processedImmutableIds.add(photoData.immutableId);
                  console.log("    [SUCCESS] Deleted.");
                  await new Promise(r => setTimeout(r, 1500));
                  continue;
                }
              }
              await page.keyboard.press('Escape'); // Cleanup if sequence failed
            }
          } catch (e) {
            await page.keyboard.press('Escape');
          }
        }
      }

      // SCROLL: Use the last seen photo to anchor the scroll
      if (lastElement) {
        await page.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'end' }), lastElement);
      } else {
        await page.keyboard.press('PageDown');
      }
      await new Promise(r => setTimeout(r, 3000));

    } catch (e) { }
  }

  // Infinite loop until the user kills the process
  for (let k = 0; k < 2000; k++) {
    process.stdout.write(`\rScan ${k+1} | Tracking: ${Object.keys(fingerprintToPrimaryId).length} | Deleted: ${deletedCount}`);
    await cleanup();
  }
})();
