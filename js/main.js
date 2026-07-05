let cart = JSON.parse(localStorage.getItem("cart")) || [];

// ===========================
// SAVE CART
// ===========================
function saveCart() {
    localStorage.setItem("cart", JSON.stringify(cart));
}

// ===========================
// UPDATE CART COUNT (SAFE)
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
            price: product.price,
            image: product.image,
            quantity: 1
        });
    }

    saveCart();
    updateCartCount();

    showPopup(product.name);
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
// INIT
// ===========================
updateCartCount();
