// ===========================
// CHECKOUT
// ===========================
//
// Paste the Web App URL you get when you deploy the Apps Script
// (see SETUP-CHECKOUT.md) between the quotes below.
//
const CHECKOUT_URL = "https://script.google.com/macros/s/AKfycbyA3U86jsRDdqSl26j69qCQnFQzrB0tooibyixkoroAGqDoOmZHAjgHQohdwJ92ipE/exec";

// ===========================
// ORDER SUMMARY
// ===========================
function renderSummary() {

    const box = document.getElementById("order-summary");
    const totalEl = document.getElementById("checkout-total");
    const placeBtn = document.getElementById("place-order");
    if (!box) return;

    if (cart.length === 0) {
        box.innerHTML =
            '<p>Your cart is empty. <a href="products.html">Browse products</a>.</p>';
        if (totalEl) totalEl.textContent = "0.00";
        if (placeBtn) placeBtn.disabled = true;
        return;
    }

    let total = 0;
    box.innerHTML = "";

    cart.forEach(item => {
        total += item.price * item.quantity;

        const line = document.createElement("div");
        line.className = "summary-line";
        line.innerHTML = `
            <span>${escapeCartHtml(item.name)} × ${item.quantity}</span>
            <span>$${(item.price * item.quantity).toFixed(2)}</span>
        `;
        box.appendChild(line);
    });

    if (totalEl) totalEl.textContent = total.toFixed(2);
}

// ===========================
// PLACE ORDER
// ===========================
async function placeOrder(event) {
    event.preventDefault();

    const btn = document.getElementById("place-order");
    const status = document.getElementById("checkout-status");

    if (cart.length === 0) return;

    const customer = {
        name: document.getElementById("cust-name").value.trim(),
        email: document.getElementById("cust-email").value.trim(),
        phone: document.getElementById("cust-phone").value.trim(),
        note: document.getElementById("cust-note").value.trim()
    };

    if (!customer.name || !customer.email) {
        status.textContent = "Please enter your name and email.";
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
});
