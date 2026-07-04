// ===========================
// Shared Shopping Cart
// ===========================

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
        cart.push({
            ...product,
            quantity: 1
        });
    }

    saveCart();
    updateCartCount();

    alert(product.name + " added to cart!");
}

updateCartCount();