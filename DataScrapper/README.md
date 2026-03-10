# Data Scrapper (Chrome Extension)

Chrome extension project to extract Google Maps business data and export to JSON or Excel.

## Exported fields
- `businessName`
- `address`
- `city`
- `state`
- `lat`
- `long`
- `phoneNumber`
- `website`

## Setup
1. Open `chrome://extensions/`
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder: `DataScrapper`.

## Usage (Side Slider)
1. Open Google Maps and run a search (example: `restaurants in Dallas TX`).
2. Click extension icon in Chrome toolbar.
3. A right-side slider opens (Chrome Side Panel).
4. Click **Scrape Data**.
5. Review records in the panel and click **Delete** on rows you do not want.
6. (Optional) Enter `Excel path (Downloads-relative)` like `MapsExports/texas-list.xls`.
7. Click **Export JSON** or **Export Excel**.

## Notes
- Data is scraped from currently loaded result cards/details in the Maps UI.
- Scroll the results list in Maps if you want more businesses to become available.
- The extension stores scraped data in local extension storage until cleared.
- Google Maps DOM changes can require selector updates later.
