# Product photos

Drop a photo in here named after the product's **SKU, in lowercase** — the site
finds it automatically, with no change to the Google Sheet:

    images/aa006.jpg     ->  shown for the product with SKU "AA006"

`.jpg`, `.png` and `.webp` all work. If a product has no file here, the card
falls back to the grey placeholder, so a missing photo never breaks the page.

Two rules that matter:

- **No spaces or capitals in the filename.** GitHub Pages is case-sensitive, so
  `AA006.JPG` will not be found. Use `aa006.jpg`.
- **Resize before committing.** The cards display photos at 180px tall, so
  ~800px wide and a couple hundred KB each is plenty. Straight-from-the-phone
  photos will bloat the repo and slow the page down.

To override the convention for one product — a photo hosted elsewhere, or a
filename that isn't the SKU — put the full URL or path in that row's `image`
column in the sheet. A non-empty `image` cell always wins.
