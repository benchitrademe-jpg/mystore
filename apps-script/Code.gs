/**
 * Benj's Store — checkout backend (Google Apps Script)
 * ---------------------------------------------------
 * This runs INSIDE your Google Sheet (Extensions → Apps Script).
 * It receives an order from the website, checks + decrements stock,
 * logs the order, and emails you and the customer the bank details.
 *
 * See SETUP-CHECKOUT.md for step-by-step setup + deployment.
 */

// =====================================================
// CONFIG — edit these before deploying
// =====================================================

var STORE_NAME = "Benj's Store";

// Where new-order notifications are sent.
var OWNER_EMAIL = "benchi.trademe@gmail.com";   // <-- change to the store owner's email

// Google accounts allowed to open the admin page (?page=admin) and change
// orders. Add a second address here if someone else helps with packing.
// This is checked against the SIGNED-IN visitor, on top of the deployment's
// own "Only myself" access setting. See SETUP-ADMIN.md.
var ADMIN_EMAILS = [OWNER_EMAIL];

// The tab (sheet) name that holds your products.
// Look at the bottom of your spreadsheet for the exact tab name.
var PRODUCTS_SHEET = "Sheet1";           // <-- change if your product tab has a different name

// Stock is tracked PER SALES CHANNEL, in two separate columns of the product
// sheet: `stock` (what the website may sell) and `tm stock` (what Trade Me
// listings may sell). Splitting them is the whole point — selling the last
// website unit must not empty the pile a Trade Me listing is still offering.
// A website order moves `stock`; an imported Trade Me sale moves `tm stock`.
// See SETUP-TRADEME.md for how to split your numbers across the two.
var CHANNEL_WEB = "Website";
var CHANNEL_TRADEME = "Trade Me";

// Orders get logged here. Created automatically if it doesn't exist.
var ORDERS_SHEET = "Orders";

// Postage rates. The customer picks Urban or Rural at checkout, but the cost
// is worked out HERE, never taken from the browser — same reason prices and
// stock are re-read from the sheet.
// Keep these in sync with POSTAGE_URBAN / POSTAGE_RURAL in js/checkout.js,
// or the customer will be quoted one price and charged another.
var POSTAGE_URBAN = 6.80;
var POSTAGE_RURAL = 12.00;

// Your bank details — shown to the customer and emailed to them.
var BANK_DETAILS = {
  accountName: "TODO Your Name",
  accountNumber: "TODO 00-0000-0000000-00",
  bank: "TODO Bank name"
};

// -----------------------------------------------------
// TRADE ME IMPORT
// -----------------------------------------------------
// Trade Me emails a "Purchase Complete" confirmation for every sale. Those
// arrive at benj.chick4@gmail.com and are auto-forwarded to this account
// (benchi.trademe@gmail.com) — which is the account this script runs as, so
// GmailApp below can read them. importTradeMeOrders() parses each one and
// appends it to the SAME Orders sheet the website writes to. The admin page
// reads only that sheet, so Trade Me sales appear there with no other change.
// See SETUP-TRADEME.md for the Gmail forwarding + trigger setup.

// The confirmation's From address. Gmail keeps the original From on a
// forwarded message, so matching on the domain still finds it here.
var TRADEME_FROM = "trademe.co.nz";

// Gmail labels remember which sale emails have already been imported, so a
// re-run never logs the same order twice. Both are created automatically.
var TRADEME_LABEL_DONE = "trademe-imported";
var TRADEME_LABEL_ERROR = "trademe-error";

// Only look this far back, so the very first run doesn't trawl old mail.
var TRADEME_SEARCH_DAYS = 45;

// Trade Me orders are logged with this reference prefix — clear to read in the
// admin page, and impossible to collide with the site's own BENJ-#### refs.
var TRADEME_REF_PREFIX = "TM-";

// =====================================================
// WEB APP ENTRY POINTS
// =====================================================

// ?page=admin  -> the orders admin page (owner only).
// anything else -> a health check, so you can confirm the Web App is live.
function doGet(e) {
  var page = (e && e.parameter && e.parameter.page) || "";

  if (page === "admin") {
    return serveAdmin_();
  }

  return jsonOut_({ ok: true, message: STORE_NAME + " checkout is running." });
}

function serveAdmin_() {
  var email = activeUserEmail_();

  if (!isAdmin_(email)) {
    return HtmlService.createHtmlOutput(
      "<h2>Not authorised</h2>" +
      "<p>Signed in as: <b>" + escapeHtml_(email || "(not signed in)") + "</b></p>" +
      "<p>Open this page while signed in to the store owner's Google account.</p>"
    );
  }

  return HtmlService.createHtmlOutputFromFile("Admin")
    .setTitle(STORE_NAME + " — Orders")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

// The SIGNED-IN visitor. Deliberately NOT getEffectiveUser(), which returns
// the account the script runs AS — under "Execute as: Me" that is always the
// owner, so using it here would let the entire internet into the admin page.
// Returns "" for an anonymous visitor, which isAdmin_ then rejects.
function activeUserEmail_() {
  try {
    return String(Session.getActiveUser().getEmail() || "").toLowerCase();
  } catch (err) {
    return "";
  }
}

function isAdmin_(email) {
  if (!email) return false;

  return ADMIN_EMAILS.some(function (allowed) {
    return String(allowed).trim().toLowerCase() === email;
  });
}

// Every admin action re-checks. The deployment's access setting is the front
// door, but a server function must never trust that it was reached through it.
function requireAdmin_() {
  var email = activeUserEmail_();
  if (!isAdmin_(email)) {
    throw new Error("Not authorised.");
  }
  return email;
}

function escapeHtml_(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// The header row is typed by hand in the spreadsheet, so accept the spellings
// it has actually used. Matched exactly, after trim + lowercase — which is what
// keeps `price` from binding to the `TM Price` column beside it.
// Keep in sync with COLUMN_ALIASES in js/products.js.
var COLUMN_ALIASES = {
  sku: ["sku"],
  name: ["name", "product name"],
  variant: ["variant", "version"],
  price: ["price"],
  stock: ["web stock", "website stock", "stock"],
  tmStock: ["tm stock", "trade me stock", "trademe stock"]
};

function columnIndex_(header, aliases) {
  for (var i = 0; i < aliases.length; i++) {
    var at = header.indexOf(aliases[i]);
    if (at >= 0) return at;
  }
  return -1;
}

// The stock column a given channel spends from.
//
// A sheet with no Trade Me column yet falls back to the website column, so
// nothing breaks before the column is added — that's exactly the old
// single-shared-number behaviour, which is the safe thing to degrade to.
function stockColumnFor_(header, channel) {
  if (channel === CHANNEL_TRADEME) {
    var tm = columnIndex_(header, COLUMN_ALIASES.tmStock);
    if (tm >= 0) return tm;
  }
  return columnIndex_(header, COLUMN_ALIASES.stock);
}

// Which channel's stock an order was taken out of — so cancelling it puts the
// units back where they came from. New rows carry a Channel column; rows
// logged before that column existed are identified by their TM- reference.
function channelOf_(channelCell, ref) {
  var c = String(channelCell || "").trim().toLowerCase();
  if (c) return c.indexOf("trade") >= 0 ? CHANNEL_TRADEME : CHANNEL_WEB;

  return String(ref).indexOf(TRADEME_REF_PREFIX) === 0 ? CHANNEL_TRADEME : CHANNEL_WEB;
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  // Wait up to 30s for any other order to finish, so two orders can't
  // both grab the last item in stock.
  lock.waitLock(30000);

  try {
    var body = JSON.parse(e.postData.contents);
    var customer = body.customer || {};
    var items = body.items || [];

    if (!customer.name || !customer.email) {
      return jsonOut_({ ok: false, error: "Please provide your name and email." });
    }
    if (!customer.address || !customer.suburb || !customer.city || !customer.postcode) {
      return jsonOut_({ ok: false, error: "Please provide your full delivery address." });
    }
    if (!items.length) {
      return jsonOut_({ ok: false, error: "Your cart is empty." });
    }

    // Worked out from the delivery type, NOT from customer.postage — that
    // field comes from the browser and a customer could set it to 0.
    var postage = postageFor_(customer.deliveryType);
    if (postage === null) {
      return jsonOut_({ ok: false, error: "Please select a delivery type (Urban or Rural)." });
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var pSheet = ss.getSheetByName(PRODUCTS_SHEET);
    if (!pSheet) {
      return jsonOut_({ ok: false, error: "Server misconfigured: product sheet not found." });
    }

    var data = pSheet.getDataRange().getValues();
    var header = data[0].map(function (h) { return String(h).trim().toLowerCase(); });
    var skuCol = columnIndex_(header, COLUMN_ALIASES.sku);
    // The website spends WEBSITE stock only. Whatever is set aside for Trade
    // Me is invisible here, so the site can sell out while listings stay live.
    var stockCol = stockColumnFor_(header, CHANNEL_WEB);
    var priceCol = columnIndex_(header, COLUMN_ALIASES.price);
    var nameCol = columnIndex_(header, COLUMN_ALIASES.name);
    // Optional: sheets with no variant column still work (-1), so this is
    // deliberately left out of the required-columns check below.
    var variantCol = columnIndex_(header, COLUMN_ALIASES.variant);

    if (skuCol < 0 || stockCol < 0 || priceCol < 0 || nameCol < 0) {
      return jsonOut_({ ok: false, error: "Server misconfigured: product columns not found." });
    }

    // Map sku -> spreadsheet data row index.
    var rowBySku = {};
    for (var i = 1; i < data.length; i++) {
      rowBySku[String(data[i][skuCol]).trim()] = i;
    }

    // Validate every line against LIVE stock and compute the real subtotal.
    var lineItems = [];
    var subtotal = 0;

    for (var j = 0; j < items.length; j++) {
      var sku = String(items[j].sku).trim();
      var qty = Math.floor(Number(items[j].quantity));

      if (!sku || !(sku in rowBySku)) {
        return jsonOut_({ ok: false, error: "Product not found: " + sku });
      }
      if (!(qty > 0)) {
        return jsonOut_({ ok: false, error: "Invalid quantity for " + sku });
      }

      var r = rowBySku[sku];
      var available = Number(data[r][stockCol]) || 0;
      var pname = productName_(data[r], nameCol, variantCol);

      if (qty > available) {
        return jsonOut_({
          ok: false,
          error: "Sorry, only " + available + " of \"" + pname + "\" left in stock."
        });
      }

      var price = Number(data[r][priceCol]) || 0;
      subtotal += price * qty;
      lineItems.push({ sku: sku, name: pname, qty: qty, price: price, row: r });
    }

    var total = subtotal + postage;

    // All good — reserve stock by decrementing now.
    for (var k = 0; k < lineItems.length; k++) {
      var li = lineItems[k];
      var newStock = (Number(data[li.row][stockCol]) || 0) - li.qty;
      pSheet.getRange(li.row + 1, stockCol + 1).setValue(newStock);
    }

    // Log the order.
    var ref = generateReference_(ss);
    var oSheet = getOrdersSheet_(ss);

    var itemsHuman = lineItems.map(function (li) {
      return li.qty + " x " + li.name + " ($" + li.price.toFixed(2) + ")";
    }).join("\n");

    var itemsJson = JSON.stringify(lineItems.map(function (li) {
      return { sku: li.sku, qty: li.qty };
    }));

    appendOrderRow_(oSheet, {
      "Timestamp": new Date(),
      "Reference": ref,
      "Status": "PENDING",
      "Channel": CHANNEL_WEB,
      "Name": customer.name,
      "Email": customer.email,
      "Phone": customer.phone || "",
      "Note": customer.note || "",
      "Address": formatAddress_(customer),
      "Delivery": customer.deliveryType || "",
      "Items": itemsHuman,
      "Subtotal": subtotal,
      "Postage": postage,
      "Total": total,
      "ItemsJSON": itemsJson
    });

    // Emails (don't let a bad address fail the whole order).
    try {
      sendEmails_(ref, customer, lineItems, subtotal, postage, total);
    } catch (mailErr) {
      // Order is still valid; just note it.
      console.error("Email failed: " + mailErr.message);
    }

    return jsonOut_({
      ok: true,
      reference: ref,
      subtotal: subtotal,
      postage: postage,
      total: total,
      bank: BANK_DETAILS
    });

  } catch (err) {
    return jsonOut_({ ok: false, error: "Server error: " + err.message });
  } finally {
    lock.releaseLock();
  }
}

// =====================================================
// HELPERS
// =====================================================

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// "Burr Set" + "10pcs" -> "Burr Set — 10pcs", so an order for two variants
// of the same product doesn't read as two identical lines when it's packed.
// Sheets with no `variant` column (variantCol -1), and rows with a blank
// variant cell, return the plain product name.
function productName_(row, nameCol, variantCol) {
  var name = String(row[nameCol]).trim();
  if (variantCol < 0) return name;

  var variant = String(row[variantCol]).trim();
  return variant ? name + " — " + variant : name;
}

var ORDER_HEADERS = [
  "Timestamp", "Reference", "Status", "Channel",
  "Name", "Email", "Phone", "Note",
  "Address", "Delivery",
  "Items", "Subtotal", "Postage", "Total",
  "Tracking", "Notified",
  "ItemsJSON"
];

function getOrdersSheet_(ss) {
  var sh = ss.getSheetByName(ORDERS_SHEET);

  if (!sh) {
    sh = ss.insertSheet(ORDERS_SHEET);
    sh.appendRow(ORDER_HEADERS);
    return sh;
  }

  if (sh.getLastRow() === 0) {
    sh.appendRow(ORDER_HEADERS);
    return sh;
  }

  // An Orders sheet created by an older version of this script has no
  // Address / Delivery / Subtotal / Postage / Channel columns. Add whichever
  // are missing to the end of the header row, so existing orders keep their
  // columns and new ones get logged in full. (Rows already on the sheet keep
  // a blank Channel; channelOf_ reads their reference prefix instead.)
  var header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h).trim(); });

  var missing = ORDER_HEADERS.filter(function (h) { return header.indexOf(h) < 0; });
  if (missing.length) {
    sh.getRange(1, header.length + 1, 1, missing.length).setValues([missing]);
  }

  return sh;
}

// Writes a row by COLUMN NAME. A positional appendRow would silently shift
// every field on an older Orders sheet whose columns are in a different order.
function appendOrderRow_(sh, values) {
  var header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h).trim(); });

  var row = header.map(function (h) {
    return Object.prototype.hasOwnProperty.call(values, h) ? values[h] : "";
  });

  sh.appendRow(row);
}

function formatAddress_(customer) {
  return [customer.address, customer.suburb, customer.city, customer.postcode]
    .map(function (part) { return String(part || "").trim(); })
    .filter(String)
    .join(", ");
}

// Rural wins if somehow both are ticked, matching getPostage() in checkout.js.
// Returns null when neither was chosen, so the caller can reject the order.
function postageFor_(deliveryType) {
  var d = String(deliveryType || "").toLowerCase();
  var rural = d.indexOf("rural") >= 0;
  var urban = d.indexOf("urban") >= 0;

  if (!rural && !urban) return null;
  return rural ? POSTAGE_RURAL : POSTAGE_URBAN;
}

function generateReference_(ss) {
  var oSheet = getOrdersSheet_(ss);
  // getLastRow includes the header row, so the first order becomes 1001.
  var num = 1000 + oSheet.getLastRow();
  return "BENJ-" + num;
}

function sendEmails_(ref, customer, lineItems, subtotal, postage, total) {
  var lines = lineItems.map(function (li) {
    return li.qty + " x " + li.name + " - $" + (li.price * li.qty).toFixed(2);
  }).join("\n");

  var totals =
    "Subtotal: $" + subtotal.toFixed(2) + "\n" +
    "Postage (" + (customer.deliveryType || "") + "): $" + postage.toFixed(2) + "\n" +
    "Total: $" + total.toFixed(2);

  var address = formatAddress_(customer);
  var bank = BANK_DETAILS;

  // To the customer
  var customerBody =
    "Kia ora " + customer.name + ",\n\n" +
    "Thanks for your order with " + STORE_NAME + "!\n\n" +
    "Order reference: " + ref + "\n\n" +
    lines + "\n\n" +
    totals + "\n\n" +
    "Delivering to:\n" + address + "\n\n" +
    "To complete your order, please make a bank transfer to:\n" +
    bank.accountName + "\n" +
    bank.accountNumber + "\n" +
    (bank.bank || "") + "\n\n" +
    "IMPORTANT: put your reference \"" + ref + "\" in the transfer so we can match your payment.\n\n" +
    "Your items are reserved. We'll confirm once payment arrives.\n\n" +
    "Nga mihi,\n" + STORE_NAME;

  MailApp.sendEmail(customer.email, STORE_NAME + " — order " + ref, customerBody);

  // To the owner
  var ownerBody =
    "New order " + ref + " (PENDING)\n\n" +
    "From: " + customer.name + " <" + customer.email + "> " + (customer.phone || "") + "\n" +
    "Note: " + (customer.note || "-") + "\n\n" +
    "Deliver to (" + (customer.deliveryType || "") + "):\n" + address + "\n\n" +
    lines + "\n\n" +
    totals + "\n\n" +
    "Website stock has been reserved (Trade Me stock is untouched). In the\n" +
    "Orders sheet, use the \"Orders\" menu to mark it PAID once the transfer\n" +
    "lands, or cancel it (which puts the units back into website stock).";

  MailApp.sendEmail(OWNER_EMAIL, "New order " + ref, ownerBody);
}

// =====================================================
// OWNER MENU (runs inside the spreadsheet)
// =====================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Orders")
    .addItem("Mark selected order PAID", "markSelectedPaid")
    .addItem("Cancel selected order (restore stock)", "cancelSelectedOrder")
    .addSeparator()
    .addItem("Import Trade Me sales now", "importTradeMeOrdersMenu")
    .addItem("Set up Trade Me auto-import", "installTradeMeAutoImport")
    .addToUi();
}

function markSelectedPaid() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getActiveSheet();
  var ui = SpreadsheetApp.getUi();

  if (sh.getName() !== ORDERS_SHEET) {
    ui.alert('Select a row in the "' + ORDERS_SHEET + '" tab first.');
    return;
  }

  var row = sh.getActiveRange().getRow();
  if (row < 2) return;

  var cols = orderColumns_(sh);
  sh.getRange(row, cols.status + 1).setValue("PAID");
  ui.alert("Order marked PAID.");
}

function cancelSelectedOrder() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getActiveSheet();
  var ui = SpreadsheetApp.getUi();

  if (sh.getName() !== ORDERS_SHEET) {
    ui.alert('Select a row in the "' + ORDERS_SHEET + '" tab first.');
    return;
  }

  var row = sh.getActiveRange().getRow();
  if (row < 2) return;

  var cols = orderColumns_(sh);
  var ref = sh.getRange(row, cols.reference + 1).getValue();

  try {
    cancelOrder_(ss, String(ref));
    ui.alert("Order cancelled and stock restored.");
  } catch (err) {
    ui.alert(err.message);
  }
}

function orderColumns_(sh) {
  var header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h).trim(); });
  return {
    reference: header.indexOf("Reference"),
    status: header.indexOf("Status"),
    itemsJson: header.indexOf("ItemsJSON")
  };
}

// =====================================================
// SHARED ORDER OPERATIONS
// (used by BOTH the spreadsheet menu and the admin page,
//  so the two can never drift apart)
// =====================================================

// Reads the Orders sheet once and returns everything callers need to
// find a row and read/write its columns by name.
function ordersTable_(ss) {
  var sh = getOrdersSheet_(ss);
  var data = sh.getDataRange().getValues();
  var header = data[0].map(function (h) { return String(h).trim(); });

  return {
    sheet: sh,
    header: header,
    data: data,

    rowFor: function (ref) {
      var refCol = header.indexOf("Reference");
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][refCol]).trim() === String(ref).trim()) return i;
      }
      throw new Error("Order not found: " + ref);
    },

    get: function (rowIndex, colName) {
      var c = header.indexOf(colName);
      return c < 0 ? "" : data[rowIndex][c];
    },

    set: function (rowIndex, colName, value) {
      var c = header.indexOf(colName);
      if (c < 0) throw new Error("Orders sheet is missing a \"" + colName + "\" column.");
      sh.getRange(rowIndex + 1, c + 1).setValue(value);
      data[rowIndex][c] = value;
    }
  };
}

// Puts reserved stock back on the shelf — into the SAME channel's column it
// was taken from, so cancelling a Trade Me sale can't quietly hand its units
// to the website. Only ever called for an order that is still PENDING or PAID,
// never for one already CANCELLED, or the stock would be credited twice.
function restoreStock_(ss, items, channel) {
  var pSheet = ss.getSheetByName(PRODUCTS_SHEET);
  if (!pSheet) throw new Error("Product sheet not found.");

  var data = pSheet.getDataRange().getValues();
  var ph = data[0].map(function (h) { return String(h).trim().toLowerCase(); });
  var skuCol = columnIndex_(ph, COLUMN_ALIASES.sku);
  var stockCol = stockColumnFor_(ph, channel);
  if (skuCol < 0 || stockCol < 0) throw new Error("Product columns not found.");

  var rowBySku = {};
  for (var i = 1; i < data.length; i++) {
    rowBySku[String(data[i][skuCol]).trim()] = i;
  }

  items.forEach(function (it) {
    var r = rowBySku[it.sku];
    if (r != null) {
      var cur = Number(data[r][stockCol]) || 0;
      pSheet.getRange(r + 1, stockCol + 1).setValue(cur + it.qty);
    }
  });
}

function cancelOrder_(ss, ref) {
  var t = ordersTable_(ss);
  var row = t.rowFor(ref);
  var status = String(t.get(row, "Status")).trim().toUpperCase();

  if (status === "CANCELLED") {
    throw new Error("Order " + ref + " is already cancelled. Stock was not changed.");
  }

  var items = JSON.parse(t.get(row, "ItemsJSON") || "[]");
  restoreStock_(ss, items, channelOf_(t.get(row, "Channel"), ref));
  t.set(row, "Status", "CANCELLED");
}

// =====================================================
// ADMIN PAGE API  (called from Admin.html via google.script.run)
// Every one of these re-checks the caller. Never assume the deployment's
// access setting was the only way in.
// =====================================================

function adminListOrders() {
  requireAdmin_();

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var t = ordersTable_(ss);
  if (t.data.length < 2) return [];

  var orders = [];
  for (var i = 1; i < t.data.length; i++) {
    var o = {};
    t.header.forEach(function (h, c) { o[h] = t.data[i][c]; });

    // google.script.run can't return a Date, and Total may be a sheet number.
    o.Timestamp = o.Timestamp ? new Date(o.Timestamp).toISOString() : "";
    o.Notified = o.Notified ? new Date(o.Notified).toISOString() : "";
    o.Subtotal = Number(o.Subtotal) || 0;
    o.Postage = Number(o.Postage) || 0;
    o.Total = Number(o.Total) || 0;
    o.Status = String(o.Status || "").trim().toUpperCase();
    o.Tracking = String(o.Tracking || "").trim();

    orders.push(o);
  }

  return orders.reverse();   // newest first
}

// Saving a tracking number does NOT email the customer — that's the separate
// Notify button, so numbers can be entered in a batch before parcels go out.
// It does move a PAID order to SHIPPED, since a tracking number means it's gone.
function adminSetTracking(ref, tracking) {
  requireAdmin_();

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var t = ordersTable_(ss);
    var row = t.rowFor(ref);

    var clean = String(tracking || "").trim();
    t.set(row, "Tracking", clean);

    if (clean && String(t.get(row, "Status")).trim().toUpperCase() === "PAID") {
      t.set(row, "Status", "SHIPPED");
    }

    return adminGetOrder_(t, row);
  } finally {
    lock.releaseLock();
  }
}

function adminSetStatus(ref, status) {
  requireAdmin_();

  var next = String(status || "").trim().toUpperCase();
  if (["PENDING", "PAID", "SHIPPED"].indexOf(next) < 0) {
    throw new Error("Unknown status: " + status);
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var t = ordersTable_(ss);
    var row = t.rowFor(ref);

    // Reviving a cancelled order would need its stock taking off the shelf
    // again, which restoreStock_ has no inverse for. Refuse rather than
    // quietly oversell.
    if (String(t.get(row, "Status")).trim().toUpperCase() === "CANCELLED") {
      throw new Error("Order " + ref + " is cancelled. Place a new order instead.");
    }

    t.set(row, "Status", next);
    return adminGetOrder_(t, row);
  } finally {
    lock.releaseLock();
  }
}

function adminCancelOrder(ref) {
  requireAdmin_();

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    cancelOrder_(ss, ref);

    var t = ordersTable_(ss);
    return adminGetOrder_(t, t.rowFor(ref));
  } finally {
    lock.releaseLock();
  }
}

// Emails the customer their tracking number, and stamps when it was sent so
// the page can show "Notified" and Benj doesn't send the same number twice.
function adminNotifyTracking(ref) {
  requireAdmin_();

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var t = ordersTable_(ss);
  var row = t.rowFor(ref);

  var tracking = String(t.get(row, "Tracking") || "").trim();
  if (!tracking) {
    throw new Error("Add a tracking number before notifying the customer.");
  }

  var email = String(t.get(row, "Email") || "").trim();
  if (!email) throw new Error("Order " + ref + " has no customer email.");

  var body =
    "Kia ora " + t.get(row, "Name") + ",\n\n" +
    "Your " + STORE_NAME + " order " + ref + " is on its way.\n\n" +
    "Tracking number: " + tracking + "\n\n" +
    "Delivering to:\n" + t.get(row, "Address") + "\n\n" +
    "Nga mihi,\n" + STORE_NAME;

  MailApp.sendEmail(email, STORE_NAME + " — order " + ref + " has shipped", body);

  // Stamped only after the send succeeds, so a bounced send can be retried.
  t.set(row, "Notified", new Date());

  return adminGetOrder_(t, row);
}

// The single order the page should re-render after an action.
function adminGetOrder_(t, row) {
  var o = {};
  t.header.forEach(function (h, c) { o[h] = t.data[row][c]; });

  o.Timestamp = o.Timestamp ? new Date(o.Timestamp).toISOString() : "";
  o.Notified = o.Notified ? new Date(o.Notified).toISOString() : "";
  o.Subtotal = Number(o.Subtotal) || 0;
  o.Postage = Number(o.Postage) || 0;
  o.Total = Number(o.Total) || 0;
  o.Status = String(o.Status || "").trim().toUpperCase();
  o.Tracking = String(o.Tracking || "").trim();

  return o;
}

// =====================================================
// TRADE ME IMPORT
// (see the CONFIG block near the top and SETUP-TRADEME.md)
// =====================================================

// Menu wrapper: runs the import and shows the result. Called from the
// spreadsheet's "Orders" menu; the same importTradeMeOrders() is also what the
// 15-minute time trigger runs.
function importTradeMeOrdersMenu() {
  SpreadsheetApp.getUi().alert(importTradeMeOrders());
}

// Installs (once) the time trigger that imports automatically. Safe to run
// again — it won't stack a second trigger.
function installTradeMeAutoImport() {
  var ui = SpreadsheetApp.getUi();

  var already = ScriptApp.getProjectTriggers().some(function (tr) {
    return tr.getHandlerFunction() === "importTradeMeOrders";
  });
  if (already) {
    ui.alert("Trade Me auto-import is already on (runs every 15 minutes).");
    return;
  }

  ScriptApp.newTrigger("importTradeMeOrders").timeBased().everyMinutes(15).create();
  ui.alert(
    "Done — Trade Me sales will import automatically every 15 minutes.\n\n" +
    "You can also run it any time from Orders -> Import Trade Me sales now."
  );
}

// Scans Gmail for un-imported Trade Me sale confirmations, logs each to the
// Orders sheet, and labels the email so it's never imported twice. Returns a
// one-line summary. Never throws for one bad email — that message is labelled
// "trademe-error" and left for a look, and the rest still import.
function importTradeMeOrders() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var query = 'subject:"Purchase Complete" "' + TRADEME_FROM + '"' +
    ' -label:' + TRADEME_LABEL_DONE +
    ' -label:' + TRADEME_LABEL_ERROR +
    ' newer_than:' + TRADEME_SEARCH_DAYS + 'd';

  var threads = GmailApp.search(query, 0, 50);
  var doneLabel = getOrCreateLabel_(TRADEME_LABEL_DONE);
  var errorLabel = getOrCreateLabel_(TRADEME_LABEL_ERROR);

  var imported = 0, skipped = 0, failed = 0;

  for (var t = 0; t < threads.length; t++) {
    var thread = threads[t];
    var messages = thread.getMessages();
    var threadFailed = false;

    for (var m = 0; m < messages.length; m++) {
      var msg = messages[m];
      // A thread can also hold replies; only the sale confirmations get parsed.
      if (msg.getSubject().indexOf("Purchase Complete") < 0) continue;

      try {
        if (logTradeMeOrder_(ss, parseTradeMeEmail_(msg)) === "imported") {
          imported++;
        } else {
          skipped++;   // already on the sheet (label was lost, or a re-run)
        }
      } catch (err) {
        failed++;
        threadFailed = true;
        console.error('Trade Me import failed for "' + msg.getSubject() + '": ' + err.message);
      }
    }

    // Label the whole thread so the next run skips it. An unreadable message
    // gets the error label (flagged, not retried forever); everything else the
    // done label. Either way it's marked, so a run never re-scans it.
    thread.addLabel(threadFailed ? errorLabel : doneLabel);
  }

  var summary = "Trade Me import: " + imported + " new, " + skipped +
    " already logged, " + failed + " could not be read.";
  console.log(summary);
  return summary;
}

// Appends one parsed Trade Me sale to the Orders sheet as a PAID order (the
// buyer has already paid through Trade Me), then best-effort decrements site
// stock. Returns "imported", or "skipped" if the reference is already logged.
function logTradeMeOrder_(ss, p) {
  var ref = TRADEME_REF_PREFIX + p.reference;

  // Idempotent even if the Gmail label was lost: never append a reference the
  // Orders sheet already holds.
  if (orderRefExists_(ss, ref)) return "skipped";

  var oSheet = getOrdersSheet_(ss);

  var itemsHuman = p.qty + " x " + p.item + " ($" + p.price.toFixed(2) + ")";
  var itemsJson = JSON.stringify([{ sku: p.sku, qty: p.qty }]);

  var note = "Trade Me sale" +
    (p.buyer ? " — buyer " + p.buyer : "") +
    (p.listing ? ". Listing #" + p.listing : "");

  appendOrderRow_(oSheet, {
    "Timestamp": p.date,
    "Reference": ref,
    "Status": "PAID",                       // already paid via Trade Me / Ping
    "Channel": CHANNEL_TRADEME,
    "Name": p.name || p.buyer || "Trade Me buyer",
    "Email": p.email || "",
    "Phone": p.phone || "",
    "Note": note,
    "Address": p.address,
    "Delivery": p.shippingMethod || "Trade Me",
    "Items": itemsHuman,
    "Subtotal": p.subtotal,
    "Postage": p.shipping,
    "Total": p.total,
    "ItemsJSON": itemsJson
  });

  // Take the units out of the TRADE ME column — the website's own number is
  // left alone, which is the point of splitting them. Best-effort: a Trade Me
  // SKU with no match on the sheet just leaves stock untouched, and a failure
  // here never voids the order.
  if (p.sku) {
    try {
      decrementStockBySku_(ss, p.sku, p.qty, CHANNEL_TRADEME);
    } catch (err) {
      console.error("Trade Me stock update failed for SKU " + p.sku + ": " + err.message);
    }
  }

  return "imported";
}

// True if the Orders sheet already has a row with this reference.
function orderRefExists_(ss, ref) {
  var sh = getOrdersSheet_(ss);
  if (sh.getLastRow() < 2) return false;

  var header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h).trim(); });
  var refCol = header.indexOf("Reference");
  if (refCol < 0) return false;

  var refs = sh.getRange(2, refCol + 1, sh.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < refs.length; i++) {
    if (String(refs[i][0]).trim() === ref) return true;
  }
  return false;
}

// Subtracts qty from the matching SKU's stock for one channel. Returns false
// (not an error) if no row matches, so a Trade Me-only listing doesn't break
// the import. Nothing clamps at zero: a Trade Me listing that oversells its
// share shows as a negative there, which is a visible flag to rebalance rather
// than a silent loss — mirroring restoreStock_ in reverse.
function decrementStockBySku_(ss, sku, qty, channel) {
  var pSheet = ss.getSheetByName(PRODUCTS_SHEET);
  if (!pSheet) throw new Error("Product sheet not found.");

  var data = pSheet.getDataRange().getValues();
  var ph = data[0].map(function (h) { return String(h).trim().toLowerCase(); });
  var skuCol = columnIndex_(ph, COLUMN_ALIASES.sku);
  var stockCol = stockColumnFor_(ph, channel);
  if (skuCol < 0 || stockCol < 0) throw new Error("Product columns not found.");

  var want = String(sku).trim().toLowerCase();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][skuCol]).trim().toLowerCase() === want) {
      var cur = Number(data[i][stockCol]) || 0;
      pSheet.getRange(i + 1, stockCol + 1).setValue(cur - qty);
      return true;
    }
  }
  return false;
}

// Pulls the fields we log out of one sale-confirmation email. Reads the plain
// text body, so it doesn't depend on Trade Me's HTML layout. Throws if the
// essentials (reference, item, total) aren't found, so the caller can flag it.
function parseTradeMeEmail_(message) {
  // Trade Me's HTML uses non-breaking spaces; flatten them to plain spaces
  // so the amount and label regexes below still match.
  var body = String(message.getPlainBody() || "").replace(/\u00A0/g, " ");

  var reference = matchOne_(body, /Reference\s*#\s*(P\d+)/i);
  if (!reference) throw new Error("no Trade Me reference found");

  // "...your product Dremel Burr Set! (listing #:..." is the most reliable
  // place the name appears; fall back to the "Item" row.
  var item = matchOne_(body, /product\s+(.+?)!\s*\(listing/i) ||
             matchOne_(body, /\bItem\b[:\s]+(.+)/i);
  if (!item) throw new Error("no item name found");

  var total = money_(matchOne_(body, /Total\s*paid[:\s]*\$?\s*([\d,]+\.\d{2})/i));
  if (!total) throw new Error("no total found");

  var price = money_(matchOne_(body, /\bPrice\b[:\s]*\$?\s*([\d,]+\.\d{2})/i));
  var subtotal = money_(matchOne_(body, /\bSubtotal\b[:\s]*\$?\s*([\d,]+\.\d{2})/i));
  // The "$" is required so "Shipping method ..." can't match as the cost.
  var shipping = money_(matchOne_(body, /\bShipping\b[:\s]*\$\s*([\d,]+\.\d{2})/i));

  var qty = Number(matchOne_(body, /\b(?:Quantity|Qty)\b[:\s]+(\d+)/i)) || 1;

  // Keep the row's maths self-consistent if a line was missing.
  if (!subtotal) subtotal = price * qty;
  if (!price && qty) price = subtotal / qty;

  var sku = matchOne_(body, /\bSKU\b[:\s]+([^\n\r<]+)/i).trim();
  var listing = matchOne_(body, /listing\s*#?:?\s*(\d+)/i);

  // The "Buyer" label is capitalised and the username trails into a <profile
  // link>: "Buyer smoky5 <https://...>". Match case-sensitively so it can't
  // catch the lower-case "A buyer has paid..." sentence higher up, and stop at
  // "<" or "(" to drop the link and the (rating) that follows.
  var buyer = matchOne_(body, /\bBuyer\s+([^\s<(]+)/).trim();

  // Buyer email: the first address in the body that's neither Trade Me's nor
  // the owner's. The buyer's own address appears twice (plain, then as a
  // mailto link); either is fine. Reply-To is a last resort.
  var email = "";
  var found = body.match(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g) || [];
  for (var e = 0; e < found.length; e++) {
    var lo = found[e].toLowerCase();
    if (lo.indexOf("trademe") >= 0) continue;
    if (lo === String(OWNER_EMAIL).toLowerCase()) continue;
    email = found[e];
    break;
  }
  if (!email) {
    var reply = String(message.getReplyTo() || "").match(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/);
    if (reply && reply[0].toLowerCase().indexOf("trademe") < 0) email = reply[0];
  }

  var shippingMethod = matchOne_(body, /Shipping\s*method[:\s]+([^\n\r]+)/i).trim();

  // Delivery address. "delivery address" is a minefield: it's also in the intro
  // sentence ("...shipped to the delivery address below") AND inside a footer
  // link (".../DeliveryAddress.aspx?asid=..."). So scope to the "Shipping
  // details" section, and require a real space between the words — which the
  // space-less "DeliveryAddress" URL doesn't have. Then read lines until the
  // footer or a "Phone number" line (captured separately), skipping the <link>
  // and [image:] lines the plain-text email leaves in.
  var shipAt = body.search(/Shipping\s*details/i);
  var scope = shipAt >= 0 ? body.slice(shipAt) : body;
  var addrParts = scope.split(/Delivery\s+address[:\s]+/i);
  // After "Shipping details" the first segment is the real address; without
  // that anchor, fall back to the last "Delivery address" occurrence.
  var addrBlock = shipAt >= 0
    ? (addrParts.length > 1 ? addrParts[1] : "")
    : addrParts[addrParts.length - 1];

  var addrLines = [];
  var phone = "";
  var raw = addrBlock.split(/\r?\n/);
  for (var a = 0; a < raw.length; a++) {
    var ln = raw[a].trim();
    if (!ln) { if (addrLines.length) break; else continue; }   // blank ends it
    if (ln.charAt(0) === "<" || /^\[image:/i.test(ln)) continue;

    var pm = ln.match(/Phone\s*number[:\s]*(.+)/i);
    if (pm) { phone = pm[1].trim(); break; }                    // phone ends it

    if (/^(Book\s*(a\s*)?courier|Print\s*packing|You\s*can\s*check|Thanks\s*for\s*selling|©)/i.test(ln)) break;
    addrLines.push(ln);
  }

  return {
    reference: reference,
    item: item.trim(),
    sku: sku,
    listing: listing,
    buyer: buyer,
    email: email,
    phone: phone,
    qty: qty,
    price: price,
    subtotal: subtotal,
    shipping: shipping,
    total: total,
    shippingMethod: shippingMethod,
    name: addrLines.length ? addrLines[0] : (buyer || ""),   // first line is the recipient
    address: addrLines.join(", "),
    date: message.getDate()
  };
}

function getOrCreateLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

// First capture group of the first match, or "" — so callers can chain and
// trim without null-checking every field.
function matchOne_(text, re) {
  var m = String(text).match(re);
  return m ? m[1] : "";
}

function money_(str) {
  return Number(String(str || "").replace(/,/g, "")) || 0;
}
