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
// LOADING STATE
// ===========================

function showLoading() {
  const container = document.getElementById("product-list");
  if (!container) return;

  container.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <p>Loading products…</p>
    </div>
  `;
}

function showError() {
  const container = document.getElementById("product-list");
  if (!container) return;

  container.innerHTML = `
    <div class="loading">
      <p>Couldn't load products. Please refresh and try again.</p>
    </div>
  `;
}

// ===========================
// LOAD PRODUCTS
// ===========================

showLoading();

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
    showError();
  });

// ===========================
// CSV PARSER
// ===========================

function parseCSV(csv) {

  const rows = parseCSVRows(csv);
  if (rows.length === 0) return [];

  const headers = rows[0].map(h => h.trim());

  return rows.slice(1).map(cells => {

    let obj = {};

    headers.forEach((header, index) => {
      obj[header] = (cells[index] || "").trim();
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

// Quote-aware CSV parser: handles commas, quotes, and newlines inside
// quoted fields (e.g. a description like "Compact, portable drill").
function parseCSVRows(csv) {

  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];

    if (inQuotes) {
      if (char === '"') {
        if (csv[i + 1] === '"') {   // escaped quote ("")
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && csv[i + 1] === "\n") i++;   // CRLF
      row.push(field);
      field = "";
      // Skip fully blank lines
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }

  // Flush trailing field/row (file may not end in a newline)
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }

  return rows;
}

// ===========================
// DISPLAY PRODUCTS
// ===========================

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function displayProducts(products) {

  const container = document.getElementById("product-list");
  if (!container) return;

  container.innerHTML = "";

  products.forEach(product => {

    const div = document.createElement("div");
    div.className = "product-card";

    div.innerHTML = `
      <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">
      <h3>${escapeHtml(product.name)}</h3>
      <p>${escapeHtml(product.description)}</p>
      <p><strong>$${product.price}</strong></p>
    `;

    const btn = document.createElement("button");
    btn.className = "add-to-cart-btn";

    if (product.stock <= 0) {
      btn.textContent = "Sold out";
      btn.disabled = true;
    } else {
      btn.textContent = "Add to Cart";
      btn.addEventListener("click", () => addToCart(product));
    }

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
