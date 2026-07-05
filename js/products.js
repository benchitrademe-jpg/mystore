
// ===========================
// Products Page
// ===========================

let allProducts = [];

// ===========================
// Load products from products.json
// ===========================

fetch("products.json")
    .then(response => response.json())
    .then(data => {

        console.log("RAW DATA:", data);

        // ✅ ALWAYS extract array safely
        const products = Array.isArray(data)
            ? data
            : data.products;

        if (!Array.isArray(products)) {
            console.error("❌ Products is not an array:", products);
            return;
        }

        allProducts = products;

        console.log("EXTRACTED PRODUCTS:", allProducts);

        populateCategories(allProducts);
        displayProducts(allProducts);

        // Search box
        const searchBox = document.getElementById("search");

        if (searchBox) {
            searchBox.addEventListener("input", filterProducts);
        }

        // Category dropdown
        const categoryBox = document.getElementById("category");

        if (categoryBox) {
            categoryBox.addEventListener("change", filterProducts);
        }

    })
    .catch(err => {
        console.error("❌ Failed to load products.json:", err);
    });


// ===========================
// Display Products
// ===========================

function displayProducts(products) {

    console.log("RENDERING PRODUCTS:", products);

    const container = document.getElementById("product-list");

    if (!container) {
        console.error("❌ product-list container not found in HTML");
        return;
    }

    if (!Array.isArray(products)) {
        console.error("❌ Expected array but got:", products);
        return;
    }

    container.innerHTML = "";

    products.forEach(product => {

        const div = document.createElement("div");

        div.className = "product-card";

        div.innerHTML = `
            <img src="${product.image}" alt="${product.name}" />
            <h3>${product.name}</h3>
            <p>${product.description}</p>
            <p><strong>$${product.price}</strong></p>
            <p>Stock: ${product.stock}</p>
        `;

        container.appendChild(div);
    });
}


// ===========================
// Populate Category Dropdown
// ===========================

function populateCategories(products) {

    const categorySelect = document.getElementById("category");

    if (!categorySelect) return;

    const categories = [...new Set(products.map(p => p.category).filter(Boolean))];

    categories.sort();

    categories.forEach(category => {

        const option = document.createElement("option");

        option.value = category;
        option.textContent = category;

        categorySelect.appendChild(option);
    });
}


// ===========================
// Search & Filter
// ===========================

function filterProducts() {

    const searchEl = document.getElementById("search");
    const categoryEl = document.getElementById("category");

    const searchText = searchEl ? searchEl.value.toLowerCase() : "";
    const category = categoryEl ? categoryEl.value : "All";

    const filtered = allProducts.filter(product => {

        const matchesSearch =
            product.name.toLowerCase().includes(searchText) ||
            product.description.toLowerCase().includes(searchText) ||
            product.sku.toLowerCase().includes(searchText);

        const matchesCategory =
            category === "All" ||
            product.category === category;

        return matchesSearch && matchesCategory;
    });

    displayProducts(filtered);
}
