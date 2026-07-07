// ===========================
// CHECKOUT
// ===========================
//
// Paste the Web App URL you get when you deploy the Apps Script
// (see SETUP-CHECKOUT.md) between the quotes below.
//
const CHECKOUT_URL = "https://script.google.com/macros/s/AKfycbyA3U86jsRDdqSl26j69qCQnFQzrB0tooibyixkoroAGqDoOmZHAjgHQohdwJ92ipE/exec";

// ===========================
// POSTAGE
// ===========================
const POSTAGE_URBAN = 6.80;
const POSTAGE_RURAL = 12.00;

// Returns the postage cost, or null if we can't work it out yet
// (address not filled in, or no delivery type chosen).
function getPostage() {
    const address  = document.getElementById("cust-address").value.trim();
    const suburb   = document.getElementById("cust-suburb").value.trim();
    const city     = document.getElementById("cust-city").value.trim();
    const postcode = document.getElementById("cust-postcode").value.trim();

    if (!address || !suburb || !city || !postcode) return null;

    const isUrban = document.getElementById("cust-urban").checked;
    const isRural = document.getElementById("cust-rural").checked;

    if (!isUrban && !isRural) return null;

    // Rural is the pricier rate, so it wins if both are ticked.
    return isRural ? POSTAGE_RURAL : POSTAGE_URBAN;
}

// ===========================
// ORDER SUMMARY
// ===========================
function renderSummary() {

    const box = document.getElementById("order-summary");
    const subtotalEl = document.getElementById("checkout-subtotal");
    const postageEl = document.getElementById("postage-value");
    const totalEl = document.getElementById("total-value");
    const placeBtn = document.getElementById("place-order");
    if (!box) return;

    if (cart.length === 0) {
        box.innerHTML =
            '<p>Your cart is empty. <a href="products.html">Browse products</a>.</p>';
        if (subtotalEl) subtotalEl.textContent = "0.00";
        if (postageEl) postageEl.textContent = "—";
        if (totalEl) totalEl.textContent = "$0.00";
        if (placeBtn) placeBtn.disabled = true;
        return;
    }

    if (placeBtn) placeBtn.disabled = false;

    let subtotal = 0;
    box.innerHTML = "";

    cart.forEach(item => {
        subtotal += item.price * item.quantity;

        const line = document.createElement("div");
        line.className = "summary-line";
        line.innerHTML = `
            <span>${escapeCartHtml(item.name)} × ${item.quantity}</span>
            <span>$${(item.price * item.quantity).toFixed(2)}</span>
        `;
        box.appendChild(line);
    });

    if (subtotalEl) subtotalEl.textContent = subtotal.toFixed(2);

    // Postage + total only appear once we have a full address and a
    // delivery type — otherwise we can't work out the shipping cost.
    const postage = getPostage();

    if (postage === null) {
        if (postageEl) postageEl.textContent = "—";
        if (totalEl) totalEl.textContent = "Enter delivery address";
    } else {
        if (postageEl) postageEl.textContent = "$" + postage.toFixed(2);
        if (totalEl) totalEl.textContent = "$" + (subtotal + postage).toFixed(2);
    }
}

// ===========================
// PLACE ORDER
// ===========================
async function placeOrder(event) {
    event.preventDefault();

    const btn = document.getElementById("place-order");
    const status = document.getElementById("checkout-status");

    if (cart.length === 0) return;

    const isUrban = document.getElementById("cust-urban").checked;
    const isRural = document.getElementById("cust-rural").checked;

    const customer = {
        name: document.getElementById("cust-name").value.trim(),
        email: document.getElementById("cust-email").value.trim(),
        phone: document.getElementById("cust-phone").value.trim(),
        address: document.getElementById("cust-address").value.trim(),
        suburb: document.getElementById("cust-suburb").value.trim(),
        city: document.getElementById("cust-city").value.trim(),
        postcode: document.getElementById("cust-postcode").value.trim(),
        deliveryType: [isUrban ? "Urban" : null, isRural ? "Rural" : null]
            .filter(Boolean).join(", "),
        postage: getPostage(),
        note: document.getElementById("cust-note").value.trim()
    };

    if (!customer.name || !customer.email) {
        status.textContent = "Please enter your name and email.";
        return;
    }

    if (!customer.address || !customer.suburb || !customer.city || !customer.postcode) {
        status.textContent = "Please fill in your full delivery address.";
        return;
    }

    if (!isUrban && !isRural) {
        status.textContent = "Please select at least one delivery type (Urban or Rural).";
        return;
    }

    if (CHECKOUT_URL.indexOf("PASTE_YOUR") === 0) {
        status.textContent =
            "Checkout isn't connected yet (CHECKOUT_URL not set in js/checkout.js).";
        return;
    }

    const payload = {
        customer: customer,
        // Only send sku + quantity — the server looks up the real price/stock.
        items: cart.map(i => ({ sku: i.sku, quantity: i.quantity }))
    };

    btn.disabled = true;
    btn.textContent = "Placing order…";
    status.textContent = "";

    try {
        const res = await fetch(CHECKOUT_URL, {
            method: "POST",
            // text/plain keeps this a "simple" request so the browser
            // doesn't send a CORS preflight Apps Script can't answer.
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (!data.ok) {
            status.textContent = data.error || "Something went wrong. Please try again.";
            btn.disabled = false;
            btn.textContent = "Place order";
            return;
        }

        // Success — empty the cart and show payment details.
        cart.length = 0;
        saveCart();
        updateCartCount();
        showConfirmation(data);

    } catch (err) {
        console.error("Checkout error:", err);
        status.textContent = "Could not reach the store. Please try again.";
        btn.disabled = false;
        btn.textContent = "Place order";
    }
}

// ===========================
// CONFIRMATION + BANK DETAILS
// ===========================
function showConfirmation(data) {

    document.getElementById("checkout-form-section").style.display = "none";

    const bank = data.bank || {};
    const c = document.getElementById("confirmation");
    c.style.display = "block";

    c.innerHTML = `
        <h1>Order placed 🎉</h1>

        <p>Thanks! Your order reference is <strong>${escapeCartHtml(data.reference)}</strong>.</p>
        <p>Amount to pay: <strong>$${Number(data.total).toFixed(2)}</strong></p>

        <div class="bank-box">
            <h2>Pay by bank transfer</h2>
            <p><strong>Account name:</strong> ${escapeCartHtml(bank.accountName || "")}</p>
            <p><strong>Account number:</strong> ${escapeCartHtml(bank.accountNumber || "")}</p>
            ${bank.bank ? `<p><strong>Bank:</strong> ${escapeCartHtml(bank.bank)}</p>` : ""}
            <p class="ref-note">
                Please put your reference
                <strong>${escapeCartHtml(data.reference)}</strong>
                in the transfer so we can match your payment.
            </p>
        </div>

        <p>We've emailed these details to you as well. Your items are reserved —
           we'll confirm your order once the payment arrives.</p>

        <a href="products.html" class="button">Continue shopping</a>
    `;
}

// ===========================
// INIT
// ===========================
document.addEventListener("DOMContentLoaded", () => {
    renderSummary();
    const form = document.getElementById("checkout-form");
    if (form) form.addEventListener("submit", placeOrder);

    // Recalculate postage + total live as the address / delivery type change.
    ["cust-address", "cust-suburb", "cust-city", "cust-postcode"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("input", renderSummary);
    });
    ["cust-urban", "cust-rural"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("change", renderSummary);
    });
});
