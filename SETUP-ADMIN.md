# Admin page (orders + tracking numbers)

A private page listing every order, where you can add tracking numbers, email
them to customers, and mark orders PAID / SHIPPED / CANCELLED.

It is **not** part of the public website. It's served by the same Apps Script
that handles checkout, behind Google's own sign-in.

## Why it isn't on the website

Anything in `js/` is downloaded by every visitor to the store. A password
written there wouldn't be a password — you could read it with View Source.
That's true whether or not the GitHub repo is private.

So the admin page is served by Apps Script instead, from a deployment only you
can open. No secret ever exists in this repo.

## Setup

### 1. Add the HTML file to the script

In the Apps Script editor (**Extensions → Apps Script**):

1. Click **+** next to *Files* → **HTML**.
2. Name it exactly `Admin` (the editor adds `.html` itself).
3. Paste the contents of `apps-script/Admin.html` over whatever's there.
4. Save.

> The name must be `Admin` — `Code.gs` looks it up by
> `createHtmlOutputFromFile("Admin")`.

### 2. Check who's allowed in

At the top of `Code.gs`:

```js
var ADMIN_EMAILS = [OWNER_EMAIL];
```

This must be the **Google account you'll sign in with**. If the store email
isn't a Google account, or someone else helps with packing, list the real
addresses:

```js
var ADMIN_EMAILS = ["benchi.trademe@gmail.com", "helper@gmail.com"];
```

### 3. Create a *second* deployment

You already have one deployment for checkout. **Leave it exactly as it is** —
the website needs it to stay public. Add a new one for the admin page:

**Deploy → New deployment → Web app**

| Setting | Value |
|---|---|
| Description | `Admin page` |
| Execute as | **User accessing the web app** |
| Who has access | **Only myself** |

Copy the URL it gives you and bookmark it with `?page=admin` on the end:

```
https://script.google.com/macros/s/AKfy…/exec?page=admin
```

Both deployments run the same code — only their access settings differ.

> **"Execute as" matters.** On the admin deployment it must be *User accessing*,
> so the script can tell who's knocking. `Code.gs` checks
> `Session.getActiveUser()` (the visitor), never `getEffectiveUser()` (the
> account the script runs as) — under *Execute as: Me* the latter is always you,
> so trusting it would let anyone in.

Your existing checkout deployment stays on *Execute as: Me* + *Anyone*, because
customers aren't signed in. Opening **that** URL with `?page=admin` shows
"Not authorised" — an anonymous visitor has no email to match.

### 4. Redeploy checkout

Adding code doesn't update a live deployment. For the **checkout** deployment:
**Deploy → Manage deployments → ✏️ → Version: New version → Deploy**.

## Using it

Open your bookmarked URL. Google asks you to sign in the first time.

Orders needing attention (**PENDING**, **PAID**) are listed first. Shipped and
cancelled ones are collapsed underneath.

- **Save tracking** — records the number. Does *not* email anyone. Moves a
  PAID order to SHIPPED, since a tracking number means it's gone.
- **Notify customer** — emails the saved tracking number. Stays greyed out
  until a number has been **saved**, and shows `✓ notified` with the date once
  sent. It sends what's on the sheet, not what's typed in the box.
- **Mark PAID** — for when the bank transfer lands.
- **Cancel order** — puts the reserved stock back. Asks first, and can't be
  undone. A cancelled order can't be revived (its stock has already been
  credited back), so place a new order instead.

Two new columns, `Tracking` and `Notified`, are added to the Orders sheet
automatically the first time the script runs.

The **Orders** menu inside the spreadsheet still works, and shares the same
code — but spreadsheet menus don't run in the Google Sheets mobile app, which
is the main reason this page exists.
