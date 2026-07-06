# Checkout setup (bank transfer + stock depletion)

The website is static, so it can't change stock on its own. A small
**Google Apps Script** attached to your product spreadsheet does the work:
it validates the order against live stock, decrements it, logs the order,
and emails you and the customer the bank details.

You only have to do this **once** (about 15 minutes).

---

## How the flow works

1. Customer fills their cart and goes to **Checkout**, enters name + email.
2. The site sends the order (just SKUs + quantities) to your Apps Script.
3. The script re-checks the **real** stock in the sheet, then:
   - decrements stock (items are now **reserved**),
   - logs the order in an **Orders** tab as `PENDING`,
   - emails the customer the bank details + a reference number,
   - emails you a "new order" notification.
4. Customer transfers the money, quoting the reference.
5. When the money lands, you open the sheet and use the **Orders** menu to
   mark it `PAID`. If they never pay, you **Cancel** it and the stock is
   automatically put back.

Prices and stock are always taken from the sheet on the server side, so a
customer can't tamper with prices, and two people can't both buy the last item.

---

## One-time setup

### 1. Open the script editor
- Open your **Google Sheet** (the one your products live in).
- Menu: **Extensions → Apps Script**.
- Delete anything in the default `Code.gs`, then paste the entire contents of
  [`apps-script/Code.gs`](apps-script/Code.gs) from this project.

### 2. Fill in the config (top of the file)
- `OWNER_EMAIL` – where new-order emails go.
- `PRODUCTS_SHEET` – the **tab name** that holds your products (see the tabs
  at the bottom of the spreadsheet; it might be `Sheet1`).
- `BANK_DETAILS` – your account name, number, and bank.

> Your product tab must have header columns named `sku`, `name`, `price`, and
> `stock` (any order). It already does if it matches the storefront.

### 3. Deploy as a Web App
- Top right: **Deploy → New deployment**.
- Click the gear ⚙ → **Web app**.
- Set:
  - **Execute as:** `Me`
  - **Who has access:** `Anyone`
- Click **Deploy**, then **Authorize access** and allow the permissions
  (it needs to edit the sheet and send email as you).
- Copy the **Web app URL** it gives you (ends in `/exec`).

### 4. Connect the website
- Open [`js/checkout.js`](js/checkout.js).
- Paste your Web app URL into the first line:
  ```js
  const CHECKOUT_URL = "https://script.google.com/macros/s/AKfy.../exec";
  ```

### 5. Test
- Open the Web app URL in a browser — you should see
  `{"ok":true,"message":"Benj's Store checkout is running."}`.
- On the site, add an item, go to Checkout, and place a test order.
- Check that: stock went down in the sheet, an `Orders` row appeared as
  `PENDING`, and you received the email.
- In the sheet, try the **Orders → Cancel** menu and confirm the stock
  goes back up.

---

## Day-to-day: managing orders

In the **Orders** tab, click a row, then use the **Orders** menu:
- **Mark selected order PAID** – once the transfer arrives.
- **Cancel selected order (restore stock)** – if they never pay; puts the
  reserved stock back.

---

## If you change the script later
Apps Script serves the version from the **last deployment**. After editing
`Code.gs`, do **Deploy → Manage deployments → Edit (pencil) → Version: New
version → Deploy** so your changes go live. The URL stays the same.

## Notes & limits
- Google's published-CSV feed can lag a few minutes, so the storefront number
  may be briefly stale — but the checkout always re-checks live stock, so you
  won't oversell.
- Free Gmail accounts can send ~100 emails/day, plenty for a small store.
