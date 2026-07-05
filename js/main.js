let cart = JSON.parse(localStorage.getItem("cart")) || [];

function saveCart() {
    localStorage.setItem("cart", JSON.stringify(cart));
}

function updateCartCount() {

    const cartLink = document.querySelector('a[href="cart.html"]');

    if (!cartLink) return;

    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

    cartLink.textContent = `Cart 🛒 (${totalItems})`;
}

function addToCart(product) {

    const existing = cart.find(item => item.sku === product.sku);

    if (existing) {
        existing.quantity++;
    } else {
        cart.push({ ...product, quantity: 1 });
    }

    saveCart();
    updateCartCount();

    showPopup(product.name);
}

// NICE CENTER POPUP (NOT alert)
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

updateCartCount();
