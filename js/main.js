let cart = JSON.parse(localStorage.getItem("cart")) || [];

// ===========================
// DISPLAY NAME
// ===========================
// "Burr Set" + "10pcs" -> "Burr Set — 10pcs".
// Products with no variant, and carts saved before variants existed,
// have no `variant` and fall through unchanged.
function displayName(item) {
    const variant = (item.variant || "").trim();
    return variant ? `${item.name} — ${variant}` : item.name;
}

// ===========================
// SAVE CART
// ===========================
function saveCart() {
    localStorage.setItem("cart", JSON.stringify(cart));
}

// ===========================
// UPDATE CART COUNT
// ===========================
function updateCartCount() {

    const cartLink = document.querySelector('#cart-link');
    if (!cartLink) return;

    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartLink.textContent = `Cart 🛒 (${totalItems})`;
}

// ===========================
// ADD TO CART
// ===========================
window.addToCart = function(product) {

    const existing = cart.find(item => item.sku === product.sku);

    if (existing) {
        existing.quantity++;
    } else {
        cart.push({
            sku: product.sku,
            name: product.name,
            variant: product.variant || "",
            price: product.price,
            image: product.image,
            quantity: 1
        });
    }

    saveCart();
    updateCartCount();
    showPopup(displayName(product));
};

// ===========================
// POPUP
// ===========================
function showPopup(name) {

    let popup = document.getElementById("cart-popup");

    if (!popup) {
        popup = document.createElement("div");
        popup.id = "cart-popup";

        popup.innerHTML = `
            <div class="popup-box">
                <div class="popup-icon">🛒</div>
                <h2>Added to Cart</h2>
                <p id="popup-text"></p>
            </div>
        `;

        document.body.appendChild(popup);
    }

    document.getElementById("popup-text").textContent =
        `"${name}" added to cart`;

    popup.classList.add("show");

    setTimeout(() => {
        popup.classList.remove("show");
    }, 1500);
}

// ===========================
// INCREASE QUANTITY
// ===========================
window.increaseQty = function(index) {

    cart[index].quantity += 1;

    saveCart();
    renderCart();
    updateCartCount();
};

// ===========================
// DECREASE QUANTITY
// ===========================
window.decreaseQty = function(index) {

    cart[index].quantity -= 1;

    if (cart[index].quantity <= 0) {
        cart.splice(index, 1);
    }

    saveCart();
    renderCart();
    updateCartCount();
};

// ===========================
// CART PAGE RENDER
// ===========================
function renderCart() {

    const container = document.getElementById("cart-items");
    if (!container) return;

    container.innerHTML = "";

    const totalEl = document.getElementById("cart-total");

    if (cart.length === 0) {
        container.innerHTML = "<p>Your cart is empty 🛒</p>";
        if (totalEl) totalEl.textContent = "0.00";
        return;
    }

    let total = 0;

    cart.forEach((item, index) => {

        total += item.price * item.quantity;

        const div = document.createElement("div");
        div.className = "cart-item";

        div.innerHTML = `
            <div>
                <h3>${escapeCartHtml(displayName(item))}</h3>
                <p>$${item.price}</p>
                <p><strong>Subtotal: $${(item.price * item.quantity).toFixed(2)}</strong></p>
            </div>

            <div class="qty-controls">
                <button onclick="decreaseQty(${index})">−</button>
                <span>${item.quantity}</span>
                <button onclick="increaseQty(${index})">+</button>
            </div>
        `;

        container.appendChild(div);
    });

    if (totalEl) totalEl.textContent = total.toFixed(2);

    saveCart();
}

function escapeCartHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

// ===========================
// INIT
// ===========================
updateCartCount();
document.addEventListener("DOMContentLoaded", renderCart);
