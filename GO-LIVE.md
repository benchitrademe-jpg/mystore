# Go-live checklist

Do these **in order**. Each step says how to check it worked before you move on.
If a check fails, stop and fix it — later steps depend on earlier ones.

There are three things standing between you and a working store right now:

1. The product sheet's column names don't match what the code reads.
2. `BANK_DETAILS` in the script still says `TODO` — customers would be emailed
   a fake bank account.
3. The new code isn't deployed yet. Editing the script does **not** update the
   live site; you must redeploy.

---

## If you're asking an AI assistant for help

Paste this so it has the context:

> I have a static website (HTML/CSS/JS on GitHub Pages) that sells tools.
> Products come from a Google Sheet, published to the web as CSV, which the
> page fetches directly in the browser. Checkout is a Google Apps Script Web App
> bound to that same spreadsheet: the site POSTs `{customer, items:[{sku,quantity}]}`
> to it, the script re-checks stock, decrements it, logs the order to an
> "Orders" tab, and emails me and the customer bank-transfer details.
> There's also an admin page served by the same script at `?page=admin`,
> behind Google sign-in, for tracking numbers.

Two things assistants get wrong about this project:

- **`products.json`, `convert-products.js`, and the GitHub Action are dead code.**
  The website reads the Google Sheet CSV *directly* ([js/products.js:6](js/products.js#L6)).
  If products look wrong on the site, the CSV URL in `products.js` is what
  matters. Don't let an assistant send you to `products.json`.
- **Editing Apps Script code doesn't deploy it.** See Step 5.

---

## Step 1 — Fix the product sheet's column names

The code looks up columns **by name, lowercased**. Your sheet currently has
`Product Name`, `Version`, and `Catergory`. Those don't match, so **every
product would be skipped** and checkout would fail with
`Server misconfigured: product columns not found.`

Rename the header row (row 1) to exactly these, all lowercase:

| Required | Optional |
|---|---|
| `name` | `variant` |
| `sku` | `image` |
| `price` | `description` |
| `stock` | `category` |

Specifically:

- `Product Name` → **`name`**
- `Version` → **`variant`**
- `Catergory` → **`category`** (it's currently misspelled)
- `SKU` → **`sku`**, `Price` → **`price`**, `Image` → **`image`**,
  `Description` → **`description`**
- **Add a `stock` column.** It doesn't exist yet. Nothing can be sold without
  it — put a number in for every row.
- The **unnamed column** after `Price` (the one with 6.29, 8.09…) — either
  give it a name like `wholesale`, or delete it. An unnamed header is fine but
  confusing.
- `Includes` and `Shank Size` are ignored by the code. Leave or delete them.

### Then: one row per variant

Products with versions get **one row each**, with their **own unique `sku`**:

| name | variant | sku | price | stock |
|------|---------|-----|-------|-------|
| Burr Set | 6pcs  | AA-06 | 6.99  | 5 |
| Burr Set | 10pcs | AA-10 | 8.99  | 3 |
| Burr Set | 20pcs | AA-20 | 12.99 | 0 |
| Router Set 10pcs |  | AB | 10.99 | 4 |

Products with no versions leave `variant` blank.

> **Do not** put `6pcs, 10pcs, 20pcs` in one cell with `6.99, 8.99, 12.99` in
> another. `Number("6.99, 8.99, 12.99")` is not a number — the product would
> sell for **$0**, and stock couldn't be tracked per version.

Each variant needs its own `sku` because the SKU is what the cart, the stock
count, and your packing email all key on. Two rows sharing a SKU means the
second one is invisible.

**Check:** every row has a unique `sku`, a numeric `price`, and a numeric `stock`.

---

## Step 2 — Make sure the site is reading *this* sheet

The website reads a **published** CSV, which is a different URL from the one in
your browser's address bar.

1. In the sheet: **File → Share → Publish to web**.
2. Choose the product tab, format **Comma-separated values (.csv)**, **Publish**.
3. Copy the URL. It looks like
   `https://docs.google.com/spreadsheets/d/e/2PACX-1v.../pub?output=csv`
4. Compare it to the one at [js/products.js:6](js/products.js#L6). If they
   differ, paste yours in there, commit, and push.

**Check:** open that `pub?output=csv` URL in a browser. You should see your
products as plain text, first line `name,variant,sku,price,stock,...`.
If you see the *old* products, the site is reading a different spreadsheet.

> Publishing can take a minute or two to reflect edits. It's also cached — the
> site adds `&cache=<timestamp>` to work around that.

---

## Step 3 — Fill in the script's config

Open the sheet → **Extensions → Apps Script**. At the top of `Code.gs`:

```js
var OWNER_EMAIL = "benchi.trademe@gmail.com";   // where new-order emails go
var ADMIN_EMAILS = [OWNER_EMAIL];               // who can open the admin page
var PRODUCTS_SHEET = "Sheet1";                  // the TAB name holding products
var POSTAGE_URBAN = 6.80;
var POSTAGE_RURAL = 12.00;

var BANK_DETAILS = {
  accountName: "TODO Your Name",                // <-- MUST CHANGE
  accountNumber: "TODO 00-0000-0000000-00",     // <-- MUST CHANGE
  bank: "TODO Bank name"                        // <-- MUST CHANGE
};
```

- **`BANK_DETAILS` is a ship-stopper.** Every customer is emailed these to pay
  into. Right now they'd be told to transfer money to "TODO Your Name".
- **`PRODUCTS_SHEET`** must be the tab name at the bottom of the spreadsheet
  (probably `Sheet1`). Not the file name.
- **`ADMIN_EMAILS`** must be the Google account you'll actually sign in with.
- **`POSTAGE_URBAN` / `POSTAGE_RURAL`** must match the same two constants in
  [js/checkout.js:13-14](js/checkout.js#L13-L14), or customers get quoted one
  price and charged another.

**Check:** no `TODO` remains anywhere in `Code.gs`.

---

## Step 4 — Copy the new code into the script

The files in this repo under `apps-script/` are the source of truth. The Apps
Script editor has its own copy that must be updated by hand.

1. Open `apps-script/Code.gs` from this repo. Copy **all** of it.
2. In the Apps Script editor, select all in `Code.gs`, paste over it.
3. **Re-apply your Step 3 config** — you just pasted over it. (Or paste first,
   then do Step 3.)
4. Click **+** next to *Files* → **HTML**. Name it exactly **`Admin`**.
5. Paste in the contents of `apps-script/Admin.html`. Save.

> The HTML file must be named `Admin`, because `Code.gs` looks it up with
> `createHtmlOutputFromFile("Admin")`. `Admin.html`, `admin`, or `AdminPage`
> will all fail with *"No HTML file named Admin was found"*.

**Check:** the editor's file list shows `Code.gs` and `Admin.html`, and clicking
**Save** produces no red errors.

---

## Step 5 — Redeploy the checkout Web App

**Editing the code does nothing until you redeploy.** The old version keeps
serving. This is the single most common reason "I changed it but nothing happened".

**Deploy → Manage deployments →** click the ✏️ pencil on your existing
deployment **→ Version: New version → Deploy**.

Do **not** create a new deployment here — that would give you a new URL, and
[js/checkout.js:8](js/checkout.js#L8) points at the old one.

**Check:** open your checkout Web App URL in a browser. You should see
`{"ok":true,"message":"Benj's Store checkout is running."}`

---

## Step 6 — Create the admin deployment

This is a **second, separate** deployment of the same script. Your checkout one
stays exactly as it is.

**Deploy → New deployment → Web app**

| Setting | Value |
|---|---|
| Description | `Admin page` |
| Execute as | **User accessing the web app** |
| Who has access | **Only myself** |

Copy the URL, add `?page=admin` to the end, bookmark it:

```
https://script.google.com/macros/s/AKfy…/exec?page=admin
```

> **"Execute as" must be *User accessing*.** The script identifies you by
> `Session.getActiveUser()`. Under *Execute as: Me* that can come back empty
> and you'd lock yourself out — and worse, the code would have no way to tell
> you apart from a stranger.

**Check:** open the bookmark. Google asks you to sign in, then you see your
orders (or "No orders yet.").

---

## Step 7 — Test it properly

Do all four. The first one is a security check — don't skip it.

1. **Locked out?** Open the admin URL in a private/incognito window, signed
   into a *different* Google account (or none). You must see **"Not authorised"**.
   If a stranger can see your orders, stop and check `ADMIN_EMAILS` and the
   *Execute as* setting.

2. **Place a real test order** on the live site. Buy **two different variants
   of the same product** (e.g. Burr Set 6pcs and Burr Set 20pcs). Then check:
   - Your email lists them as two lines: `Burr Set — 6pcs` and `Burr Set — 20pcs`.
     If both lines just say `Burr Set`, the `variant` column is missing or misnamed.
   - The email shows **Subtotal, Postage, Total**, and the **delivery address**.
   - The **total includes postage**. (Older code silently dropped it.)
   - **Stock went down** in the sheet, on the two correct rows.
   - An **Orders** tab row appeared, status `PENDING`.

3. **Tracking.** In the admin page: type a tracking number → **Save tracking**.
   The order should flip `PAID → SHIPPED` only if it was already PAID, and
   **no email is sent yet**. Then click **Notify customer** — now the email goes,
   and `✓ notified` appears.

4. **Cancel.** Cancel the test order. Stock must go back **up** by exactly what
   was bought. Cancelling twice must be refused.

---

## Troubleshooting

| What you see | What's wrong |
|---|---|
| `Server misconfigured: product columns not found.` | Sheet headers aren't lowercase `sku`/`name`/`price`/`stock`, or `PRODUCTS_SHEET` is the wrong tab name. Step 1 & 3. |
| `Product not found: AA-06` | The cart has a SKU the sheet doesn't. Usually an old cart in your browser after renaming SKUs — clear site data, or empty the cart. |
| Products don't appear on the site | The `pub?output=csv` URL in `products.js` points at a different sheet, or the sheet isn't published. Step 2. **Not** a `products.json` problem. |
| A product shows **$0** | Its `price` cell isn't a plain number — probably a comma-list like `6.99, 8.99`. Step 1. |
| **Every** product says "Sold out" | There's no `stock` column, so every product reads as 0 in stock. It won't error — it just silently sells nothing. Step 1. |
| One product says "Sold out" wrongly | That row's `stock` cell is blank, text, or 0. |
| Site changes did nothing | You edited Apps Script but didn't redeploy. Step 5. |
| Order email says `Burr Set` twice | No `variant` column, or it's named `Version`. Step 1. |
| Email total is missing postage | Checkout deployment is still on the old code. Step 5. |
| Customer emailed "TODO Your Name" | `BANK_DETAILS`. Step 3. |
| `No HTML file named Admin was found` | The HTML file isn't named exactly `Admin`. Step 4. |
| Admin page: "Not authorised" *as you* | `ADMIN_EMAILS` doesn't list the account you're signed in as, or *Execute as* is set to *Me* instead of *User accessing*. Step 6. |
| Two people bought the last item | Shouldn't happen — the script takes a lock and re-checks stock. If it does, tell whoever's helping that `LockService` is involved. |

---

## What is *not* done

Known gaps, so nobody tells you these are bugs:

- **Variants show as separate product cards.** Three `Burr Set` rows render as
  three cards, each labelled with a small grey variant pill. The nicer version
  (one card, with `6pcs / 10pcs / 20pcs` buttons inside it) isn't built.
- **`products.json` and the GitHub Action are unused.** They run every 10
  minutes and commit a file nothing reads. Harmless. Don't let anyone "fix"
  the site by editing it.
- **Postage rates live in two places** (`Code.gs` and `js/checkout.js`) and
  must be changed together.
- **The spreadsheet's `Orders` menu** ("Mark selected order PAID") still works,
  but doesn't run in the Google Sheets mobile app. That's what the admin page
  is for.
- **None of the recent changes have been tested against real Apps Script** —
  they were checked as plain JavaScript against a stubbed spreadsheet. Step 7
  is how you find out.
