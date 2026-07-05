// ===========================
// LIVE PRODUCTS (Google Sheets)
// ===========================

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTa6ULaDZ8TEbpNKru_yqbGHWIryKzlfl_n9kvOiI27GBOrbhdEzgX0KA280WYVZbHXYSedBveys_8u/pub?output=csv";

let allProducts = [];

console.log("🚀 products.js loaded");

// ===========================
// LOAD DATA FROM GOOGLE SHEETS
// ===========================

fetch(SHEET_URL + "&cache=" + Date.now(), {
  cache: "no-store"
})
  .then(res => {

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    return res.text();

  })
  .then(csvText => {

    console.log("========== RAW CSV ==========");
    console.log(csvText);

    const products = parseCSV(csvText);

    console.log("========== PARSED PRODUCTS ==========");
    console.table(products);

    console.log("Loaded at:", new Date().toISOString());

    allProducts = products;

    populateCategories(products);
    displayProducts(products);

    setupListeners();

  })
  .catch(err => {
    console.error("❌ Sheet load error:", err);
  });


// ===========================
// CSV PARSER
// ===========================

function parseCSV(csv) {

  const lines = csv.trim().split(/\r?\n/);

  const headers = lines[0].split(",").map(h => h.trim());

  return lines.slice(1).map(line => {

    const values = line.split(",").map(v => v.trim());

    let obj = {};

    headers.forEach((h, i) => {
      obj[h] = values[i] || "";
    });

    return {
      sku: obj.sku || "",
      name: obj.name || "",
      price: Number(obj.price || 0),
      stock: Number(obj.stock || 0),
      image: obj.image || "",
      description: obj.description || "",
      category: obj.category || "Uncategorized"
    };

  });

}


// ===========================
// DISPLAY PRODUCTS
// ===========================

function displayProducts(products) {

  console.log("Rendering", products.length, "products");

  const container = document.getElementById("product-list");

  if (!container) {
    console.error("❌ Missing #product-list");
    return;
  }

  container.innerHTML = "";

  products.forEach(product => {

    const div = document.createElement("div");
    div.className = "product-card";

    div.innerHTML = `
      <img src="${product.image}" alt="${product.name}">
      <h3>${product.name}</h3>
      <p>${product.description}</p>
      <p><strong>$${product.price.toFixed(2)}</strong></p>
      <p>Stock: ${product.stock}</p>
    `;

    container.appendChild(div);

  });

}


// ===========================
// CATEGORY DROPDOWN
// ===========================

function populateCategories(products) {

  const categorySelect = document.getElementById("category");

  if (!categorySelect) return;

  categorySelect.innerHTML = `<option value="All">All</option>`;

  const categories = [...new Set(products.map(p => p.category))]
    .filter(Boolean)
    .sort();

  categories.forEach(category => {

    const option = document.createElement("option");

    option.value = category;
    option.textContent = category;

    categorySelect.appendChild(option);

  });

}


// ===========================
// SEARCH + FILTER
// ===========================

function filterProducts() {

  const search =
    document.getElementById("search")?.value.toLowerCase() || "";

  const category =
    document.getElementById("category")?.value || "All";

  const filtered = allProducts.filter(product => {

    const matchesSearch =
      product.name.toLowerCase().includes(search) ||
      product.description.toLowerCase().includes(search) ||
      product.sku.toLowerCase().includes(search);

    const matchesCategory =
      category === "All" ||
      product.category === category;

    return matchesSearch && matchesCategory;

  });

  displayProducts(filtered);

}


// ===========================
// EVENT LISTENERS
// ===========================

function setupListeners() {

  const searchBox = document.getElementById("search");
  const categoryBox = document.getElementById("category");

  if (searchBox) {
    searchBox.addEventListener("input", filterProducts);
  }

  if (categoryBox) {
    categoryBox.addEventListener("change", filterProducts);
  }

}
