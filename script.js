// ===========================
// Shopping Cart
// ===========================

let cart = JSON.parse(localStorage.getItem("cart")) || [];

// Save cart
function saveCart() {
    localStorage.setItem("cart", JSON.stringify(cart));
}

// Add product
function addToCart(product) {

    const existing = cart.find(item => item.sku === product.sku);

    if (existing) {
        existing.quantity++;
    } else {
        product.quantity = 1;
        cart.push(product);
    }

    saveCart();

    alert(product.name + " added to cart!");
}

// ===========================
// Products Page
// ===========================

if (document.getElementById("product-list")) {

    fetch("products.json")
      .then(res => res.json())
      .then(data => {
        const products = data.products;
    
        products.forEach(product => {

            const productList = document.getElementById("product-list");

            products.forEach(product => {

                const card = document.createElement("div");

                card.className = "product-card";

                card.innerHTML = `
                    <div class="product-image">
                        Image Coming Soon
                    </div>

                    <h2>${product.name}</h2>

                    <p>${product.description}</p>

                    <h3>$${product.price.toFixed(2)}</h3>

                    <button>Add to Cart</button>
                `;

                card.querySelector("button").addEventListener("click", () => {
                    addToCart(product);
                });

                productList.appendChild(card);

            });

        });

}
// ===========================
// Cart Page
// ===========================

if (document.getElementById("cart-items")) {

    const cartItems = document.getElementById("cart-items");

    if (cart.length === 0) {

        cartItems.innerHTML = "<h2>Your cart is empty.</h2>";

    } else {

        cart.forEach(item => {

            const div = document.createElement("div");

            div.className = "product-card";

            div.innerHTML = `
                <h2>${item.name}</h2>

                <p>SKU: ${item.sku}</p>

                <p>Quantity: ${item.quantity}</p>

                <h3>$${(item.price * item.quantity).toFixed(2)}</h3>
            `;

            cartItems.appendChild(div);

        });

    }

}
