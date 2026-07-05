let allProducts = [];

// Load products from GitHub JSON
fetch("products.json")
  .then(res => res.json())
  .then(data => {

    console.log("RAW DATA:", data);

    const products = Array.isArray(data)
      ? data
      : data.products;

    console.log("FINAL PRODUCTS:", products);

    if (!Array.isArray(products)) {
      console.error("Products is not an array:", products);
      return;
    }

    allProducts = products;

    displayProducts(products); // 🔥 ONLY THIS

  })
  .catch(err => console.error("FETCH ERROR:", err));
// Render products to page
function renderProducts(products) {
  const container = document.getElementById("product-list");

  if (!container) {
    console.error("❌ No #product-list container found in HTML");
    return;
  }

  container.innerHTML = "";

  products.forEach(product => {
    const card = document.createElement("div");
    card.className = "product-card";

    card.innerHTML = `
      <img src="${product.image}" alt="${product.name}" />
      <h3>${product.name}</h3>
      <p>${product.description || ""}</p>
      <p><strong>$${product.price}</strong></p>
      <p>Stock: ${product.stock}</p>
      <button onclick="addToCart('${product.sku}')">
        Add to Cart
      </button>
    `;

    container.appendChild(card);
  });
}

// Simple cart (temporary version)
let cart = [];

function addToCart(sku) {
  const product = allProducts.find(p => p.sku === sku);

  if (!product) {
    console.error("❌ Product not found:", sku);
    return;
  }

  if (product.stock <= 0) {
    alert("Out of stock");
    return;
  }

  cart.push(product);

  console.log("🛒 Cart:", cart);

  alert(`${product.name} added to cart`);
}

// Optional: expose cart for debugging
window.cart = cart;

}
