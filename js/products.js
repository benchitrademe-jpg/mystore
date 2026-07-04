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

    const productList = document.getElementById("product-list");

    if (!productList) return;

    productList.innerHTML = "";

    if (products.length === 0) {

        productList.innerHTML = "<h2>No products found.</h2>";

        return;

    }

    products.forEach(product => {

        const card = document.createElement("div");

        card.className = "product-card";

        card.innerHTML = `

            <img
                class="product-image"
                src="${product.image}"
                alt="${product.name}"
                onerror="this.src='https://placehold.co/400x300?text=No+Image'"
            >

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