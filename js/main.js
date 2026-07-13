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
// CART CHANGED
// ===========================
// The products page swaps a card's "Add to Cart" button for a quantity stepper
// once the item is in the cart, so it needs to know when the cart moves —
// including from the other card showing the same SKU, or from the modal.
function cartChanged() {
    saveCart();
    updateCartCount();
    document.dispatchEvent(new CustomEvent("cart-changed"));
}

// ===========================
// CART QUANTITY (BY SKU)
// ===========================
window.getCartQty = function(sku) {
    const item = cart.find(item => item.sku === sku);
    return item ? item.quantity : 0;
};

// Only moves an item already in the cart — use addToCart for the first one,
// since that's what carries the product's name, price and image.
window.changeCartQty = function(sku, delta) {

    const index = cart.findIndex(item => item.sku === sku);
    if (index < 0) return;

    cart[index].quantity += delta;

    if (cart[index].quantity <= 0) {
        cart.splice(index, 1);
    }

    cartChanged();
    renderCart();
};

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

    cartChanged();
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
    changeCartQty(cart[index].sku, +1);
};

// ===========================
// DECREASE QUANTITY
// ===========================
window.decreaseQty = function(index) {
    changeCartQty(cart[index].sku, -1);
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
