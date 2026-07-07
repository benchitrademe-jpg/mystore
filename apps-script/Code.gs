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

// The tab (sheet) name that holds your products.
// Look at the bottom of your spreadsheet for the exact tab name.
var PRODUCTS_SHEET = "Sheet1";           // <-- change if your product tab has a different name

// Orders get logged here. Created automatically if it doesn't exist.
var ORDERS_SHEET = "Orders";

// Your bank details — shown to the customer and emailed to them.
var BANK_DETAILS = {
  accountName: "TODO Your Name",
  accountNumber: "TODO 00-0000-0000000-00",
  bank: "TODO Bank name"
};

// =====================================================
// WEB APP ENTRY POINTS
// =====================================================

// Lets you open the Web App URL in a browser to check it's live.
function doGet() {
  return jsonOut_({ ok: true, message: STORE_NAME + " checkout is running." });
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
    if (!items.length) {
      return jsonOut_({ ok: false, error: "Your cart is empty." });
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var pSheet = ss.getSheetByName(PRODUCTS_SHEET);
    if (!pSheet) {
      return jsonOut_({ ok: false, error: "Server misconfigured: product sheet not found." });
    }

    var data = pSheet.getDataRange().getValues();
    var header = data[0].map(function (h) { return String(h).trim().toLowerCase(); });
    var skuCol = header.indexOf("sku");
    var stockCol = header.indexOf("stock");
    var priceCol = header.indexOf("price");
    var nameCol = header.indexOf("name");

    if (skuCol < 0 || stockCol < 0 || priceCol < 0 || nameCol < 0) {
      return jsonOut_({ ok: false, error: "Server misconfigured: product columns not found." });
    }

    // Map sku -> spreadsheet data row index.
    var rowBySku = {};
    for (var i = 1; i < data.length; i++) {
      rowBySku[String(data[i][skuCol]).trim()] = i;
    }

    // Validate every line against LIVE stock and compute the real total.
    var lineItems = [];
    var total = 0;

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
      var pname = data[r][nameCol];

      if (qty > available) {
        return jsonOut_({
          ok: false,
          error: "Sorry, only " + available + " of \"" + pname + "\" left in stock."
        });
      }

      var price = Number(data[r][priceCol]) || 0;
      total += price * qty;
      lineItems.push({ sku: sku, name: pname, qty: qty, price: price, row: r });
    }

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

    oSheet.appendRow([
      new Date(), ref, "PENDING",
      customer.name, customer.email, customer.phone || "", customer.note || "",
      itemsHuman, total, itemsJson
    ]);

    // Emails (don't let a bad address fail the whole order).
    try {
      sendEmails_(ref, customer, lineItems, total);
    } catch (mailErr) {
      // Order is still valid; just note it.
      console.error("Email failed: " + mailErr.message);
    }

    return jsonOut_({ ok: true, reference: ref, total: total, bank: BANK_DETAILS });

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

function getOrdersSheet_(ss) {
  var sh = ss.getSheetByName(ORDERS_SHEET);
  if (!sh) {
    sh = ss.insertSheet(ORDERS_SHEET);
    sh.appendRow([
      "Timestamp", "Reference", "Status",
      "Name", "Email", "Phone", "Note",
      "Items", "Total", "ItemsJSON"
    ]);
  }
  return sh;
}

function generateReference_(ss) {
  var oSheet = getOrdersSheet_(ss);
  // getLastRow includes the header row, so the first order becomes 1001.
  var num = 1000 + oSheet.getLastRow();
  return "BENJ-" + num;
}

function sendEmails_(ref, customer, lineItems, total) {
  var lines = lineItems.map(function (li) {
    return li.qty + " x " + li.name + " - $" + (li.price * li.qty).toFixed(2);
  }).join("\n");

  var bank = BANK_DETAILS;

  // To the customer
  var customerBody =
    "Kia ora " + customer.name + ",\n\n" +
    "Thanks for your order with " + STORE_NAME + "!\n\n" +
    "Order reference: " + ref + "\n\n" +
    lines + "\n\n" +
    "Total: $" + total.toFixed(2) + "\n\n" +
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
    lines + "\n\n" +
    "Total: $" + total.toFixed(2) + "\n\n" +
    "Stock has been reserved. In the Orders sheet, use the \"Orders\" menu to\n" +
    "mark it PAID once the transfer lands, or cancel it (which restores stock).";

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
  var status = sh.getRange(row, cols.status + 1).getValue();

  if (status !== "PENDING") {
    ui.alert('This order is "' + status + '", not PENDING. Stock was not changed.');
    return;
  }

  var itemsJson = sh.getRange(row, cols.itemsJson + 1).getValue();
  var items = JSON.parse(itemsJson || "[]");

  // Restore stock.
  var pSheet = ss.getSheetByName(PRODUCTS_SHEET);
  var data = pSheet.getDataRange().getValues();
  var ph = data[0].map(function (h) { return String(h).trim().toLowerCase(); });
  var skuCol = ph.indexOf("sku");
  var stockCol = ph.indexOf("stock");

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

  sh.getRange(row, cols.status + 1).setValue("CANCELLED");
  ui.alert("Order cancelled and stock restored.");
}

function orderColumns_(sh) {
  var header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h).trim(); });
  return {
    status: header.indexOf("Status"),
    itemsJson: header.indexOf("ItemsJSON")
  };
}
