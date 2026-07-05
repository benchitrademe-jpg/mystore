// ===========================
// Products Page
// ===========================

let allProducts = [];

// Load products from products.json
fetch("products.json")
    .then(response => response.json())
    .then(products => {

        allProducts = products;

        populateCategories(products);

        displayProducts(products);

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

    });


// ===========================
// Display Products
// ===========================

function displayProducts(products) {

    console.log("RENDERING PRODUCTS:", products);

    const container = document.getElementById("product-list");

    if (!container) {
        console.error("❌ product-list container not found");
        return;
    }

    container.innerHTML = "";

    products.forEach(product => {

        console.log("Rendering:", product);

        const div = document.createElement("div");

        div.innerHTML = `
            <div class="product-card">
                <img src="${product.image}" alt="${product.name}" />
                <h3>${product.name}</h3>
                <p>${product.description}</p>
                <p>$${product.price}</p>
                <p>Stock: ${product.stock}</p>
            </div>
        `;

        container.appendChild(div); // 🔥 THIS IS THE CRITICAL LINE
    });
}
// ===========================
// Populate Category Dropdown
// ===========================

function populateCategories(products) {

    const categorySelect = document.getElementById("category");

    if (!categorySelect) return;

    const categories = [...new Set(products.map(product => product.category))];

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

    const searchText = document
        .getElementById("search")
        .value
        .toLowerCase();

    const category = document.getElementById("category").value;

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
