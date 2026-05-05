# 📸 Google Photos Duplicate Cleaner (v2026.12)[cite: 1]

A precision-engineered automation tool to identify and remove actual file duplicates in Google Photos[cite: 1]. This script handles the quirks of the Google Photos "Virtual List" and prevents "self-deletion" bugs by using immutable identifiers and visual fingerprinting[cite: 1].

## 🛡️ The "Triple-Lock" Safety System[cite: 1]

To ensure you never lose an original memory, this script uses a multi-layered verification process:

*   **Immutable ID Check**: Every photo has a unique `AF1Q...` identifier embedded in its URL[cite: 1]. The script tracks these to ensure it never deletes a photo just because it appeared twice during a scroll[cite: 1].
*   **Visual Fingerprinting**: The script combines the metadata label (Time/Date/Portrait/Landscape) with the image's source hash[cite: 1]. This distinguishes between "burst-mode" shots and actual duplicates[cite: 1].
*   **URL Guard**: Google Photos often resets filters during bulk deletions[cite: 1]. The script constantly monitors its location and re-navigates if it gets displaced from your search results[cite: 1].

---

## 🛠️ Prerequisites[cite: 1]

*   **Node.js**: v18 or higher installed on your system[cite: 1].
*   **Chromium-based Browser**: Google Chrome, Brave, or Chromium[cite: 1].
*   **Terminal Access**: Basic familiarity with Bash, PowerShell, or Zsh[cite: 1].

---

## 📦 Installation[cite: 1]

1.  **Clone the repository**[cite: 1]:
    ```bash
    git clone [https://github.com/yourusername/google-photos-cleaner.git](https://github.com/yourusername/google-photos-cleaner.git)
    cd google-photos-cleaner
    ```

2.  **Install dependencies**[cite: 1]:
    This will install `puppeteer-extra` and the `stealth` plugin required to bypass bot detection[cite: 1].
    ```bash
    npm install
    ```

---

## 🚦 Execution Steps[cite: 1]

### 1. Launch Browser in Debugging Mode[cite: 1]
You must launch your browser manually with a remote debugging port to allow the script to attach to your session[cite: 1]. **Close all other Chrome instances before running these.**[cite: 1]

*   **Linux**: `google-chrome --remote-debugging-port=9222`[cite: 1]
*   **macOS**: `/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222`[cite: 1]
*   **Windows**: `"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222`[cite: 1]

### 2. Prepare Google Photos[cite: 1]
1.  In the browser window that just opened, go to [Google Photos](https://photos.google.com)[cite: 1].
2.  Log in to your account[cite: 1].
3.  **Important**: Keep this browser window visible and **not minimized** during the entire process[cite: 1].

### 3. Run the Cleanup Script[cite: 1]
Open a terminal and run the script by specifying the date range you wish to clean[cite: 1].

```bash
# Syntax: node index.js "Start Date" "End Date"
node index.js "Jan 1 2024" "Dec 31 2024"
