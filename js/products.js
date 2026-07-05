// ===========================
// LIVE PRODUCTS (Google Sheets)
// ===========================

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTa6ULaDZ8TEbpNKru_yqbGHWIryKzlfl_n9kvOiI27GBOrbhdEzgX0KA280WYVZbHXYSedBveys_8u/pub?output=csv";

let allProducts = [];

// ===========================
// LOAD DATA FROM GOOGLE SHEETS
// ===========================

fetch(SHEET_URL + "?cache=" + Date.now())
  .then(res => res.text())
  .then(csvText => {

    const products = parseCSV(csvText);

    console.log("LIVE PRODUCTS:", products);

    allProducts = products;

    populateCategories(products);
    displayProducts(products);

    setupListeners();

  })
  .catch(err => console.error("❌ Sheet load error:", err));


// ===========================
// CSV PARSER (simple but reliable)
// ===========================

function parseCSV(csv) {

  const lines = csv.trim().split("\n");

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

  console.log("RENDERING:", products);

  const container = document.getElementById("product-list");

  if (!container) {
    console.error("❌ Missing #product-list in HTML");
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
// CATEGORY DROPDOWN
// ===========================

function populateCategories(products) {

  const categorySelect = document.getElementById("category");

  if (!categorySelect) return;

  const categories = [
    ...new Set(products.map(p => p.category))
  ].filter(Boolean);

  categorySelect.innerHTML = `<option value="All">All</option>`;

  categories.sort().forEach(cat => {

    const option = document.createElement("option");

    option.value = cat;
    option.textContent = cat;

    categorySelect.appendChild(option);
  });
}


// ===========================
// SEARCH + FILTER
// ===========================

function filterProducts() {

  const searchEl = document.getElementById("search");
  const categoryEl = document.getElementById("category");

  const search = searchEl ? searchEl.value.toLowerCase() : "";
  const category = categoryEl ? categoryEl.value : "All";

  const filtered = allProducts.filter(p => {

    const matchesSearch =
      p.name.toLowerCase().includes(search) ||
      p.description.toLowerCase().includes(search) ||
      p.sku.toLowerCase().includes(search);

    const matchesCategory =
      category === "All" || p.category === category;

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
