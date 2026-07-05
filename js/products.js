// ===========================
// LIVE PRODUCTS (Google Sheets)
// ===========================

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTa6ULaDZ8TEbpNKru_yqbGHWIryKzlfl_n9kvOiI27GBOrbhdEzgX0KA280WYVZbHXYSedBveys_8u/pub?output=csv";

let allProducts = [];

console.log("🚀 products.js loaded");

// Prevent browser caching
const fetchUrl = SHEET_URL + "&cache=" + Date.now();

// ===========================
// LOAD PRODUCTS
// ===========================

fetch(fetchUrl, {
  cache: "no-store"
})
  .then(response => {

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.text();

  })
  .then(csvText => {

    console.log("========== RAW CSV ==========");
    console.log(csvText);

    allProducts = parseCSV(csvText);

    console.table(allProducts);

    populateCategories(allProducts);
    displayProducts(allProducts);
    setupListeners();

  })
  .catch(error => {
    console.error("Error loading products:", error);
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

    headers.forEach((header, index) => {
      obj[header] = values[index] || "";
    });

    return {
      sku: obj.sku || "",
      name: obj.name || "",
      price: Number(obj.price || 0),
      stock: Number(obj.stock || 0),
      image: obj.image || "",
      description: obj.description || "",
      category: obj.category || obj.catergory || "Uncategorized"
    };

  });

}

// ===========================
// DISPLAY PRODUCTS
// ===========================

function displayProducts(products) {

  const container = document.getElementById("product-list");
  if (!container) return;

  container.innerHTML = "";

  products.forEach(product => {

    const div = document.createElement("div");
    div.className = "product-card";

    div.innerHTML = `
      <img src="${product.image}" alt="${product.name}">
      <h3>${product.name}</h3>
      <p>${product.description}</p>
      <p><strong>$${product.price}</strong></p>
    `;

    const btn = document.createElement("button");
    btn.textContent = "Add to Cart";
    btn.className = "add-to-cart-btn";

    btn.addEventListener("click", () => addToCart(product));

    div.appendChild(btn);
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

  const categories = [
    ...new Set(products.map(product => product.category))
  ]
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
