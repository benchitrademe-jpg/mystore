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

// The sheet's header row is typed by hand, so accept the spellings it has
// actually used. Headers are matched exactly, after trim + lowercase — which
// is what keeps `price` from binding to the `TM Price` column beside it.
// Keep in sync with COLUMN_ALIASES in apps-script/Code.gs.
const COLUMN_ALIASES = {
  sku:         ["sku"],
  name:        ["name", "product name"],
  variant:     ["variant", "version"],
  price:       ["price"],
  stock:       ["stock"],
  image:       ["image"],
  description: ["description"],
  category:    ["category", "catergory"]
};

function parseCSV(csv) {

  const rows = parseCSVRows(csv);
  if (rows.length === 0) return [];

  const headers = rows[0].map(h => h.trim().toLowerCase());

  // field name -> column index, or -1 when the sheet has no such column.
  const col = {};
  for (const field in COLUMN_ALIASES) {
    col[field] = COLUMN_ALIASES[field].reduce(
      (found, alias) => (found >= 0 ? found : headers.indexOf(alias)),
      -1
    );
  }

  const cell = (cells, field) =>
    col[field] >= 0 ? (cells[col[field]] || "").trim() : "";

  return rows.slice(1)
    .map(cells => ({
      sku: cell(cells, "sku"),
      name: cell(cells, "name"),
      variant: cell(cells, "variant"),
      price: Number(cell(cells, "price") || 0),
      stock: Number(cell(cells, "stock") || 0),
      image: cell(cells, "image"),
      description: cell(cells, "description"),
      category: cell(cells, "category") || "Uncategorized"
    }))
    // A row with no SKU can't be added to a cart or found at checkout.
    .filter(product => product.sku);

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

    // The whole card opens the detail view; the button below stops the click
    // from bubbling so "Add to Cart" doesn't also open the modal.
    div.tabIndex = 0;
    div.setAttribute("role", "button");
    div.addEventListener("click", () => openProductModal(product));
    div.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openProductModal(product);
      }
    });

    div.innerHTML = `
      <h3>${escapeHtml(product.name)}</h3>
      ${product.variant
        ? `<p class="variant">${escapeHtml(product.variant)}</p>`
        : ""}
      <p><strong>$${product.price}</strong></p>
    `;

    div.prepend(makeProductImage(product));
    div.appendChild(makeCartControl(product));
    container.appendChild(div);

  });
}

// ===========================
// PRODUCT IMAGE
// ===========================

// A row's `image` cell wins when it has one. Otherwise fall back to a photo
// committed to images/ and named after the SKU (see images/README.md), so the
// sheet doesn't have to carry a path for every product.
function imageSources(product) {

  if (product.image) return [product.image];
  if (!product.sku) return [];

  const base = `images/${product.sku.trim().toLowerCase()}`;
  return [`${base}.jpg`, `${base}.png`, `${base}.webp`];
}

function makePlaceholder() {
  const div = document.createElement("div");
  div.className = "product-image-placeholder";
  div.setAttribute("aria-hidden", "true");
  return div;
}

function makeProductImage(product) {

  const sources = imageSources(product);
  if (sources.length === 0) return makePlaceholder();

  const img = document.createElement("img");
  img.alt = displayName(product);

  // Try each candidate in turn; when none of them load (no photo committed
  // yet, or a dead URL in the sheet), swap in the placeholder rather than
  // leaving a broken-image icon on the card.
  let next = 0;
  img.addEventListener("error", () => {
    if (next < sources.length) {
      img.src = sources[next++];
    } else {
      img.replaceWith(makePlaceholder());
    }
  });

  img.src = sources[next++];
  return img;
}

// Shows "Add to Cart" until the product is in the cart, then a −/qty/+ stepper.
// Lives inside the clickable card, so every click here is kept from bubbling up
// and opening the detail modal.
function makeCartControl(product) {

  const wrap = document.createElement("div");
  wrap.className = "cart-control";
  wrap.dataset.sku = product.sku;
  wrap.addEventListener("click", event => event.stopPropagation());

  const inCart = getCartQty(product.sku);

  if (product.stock <= 0) {

    const btn = document.createElement("button");
    btn.className = "add-to-cart-btn";
    btn.textContent = "Sold out";
    btn.disabled = true;
    wrap.appendChild(btn);

  } else if (inCart === 0) {

    const btn = document.createElement("button");
    btn.className = "add-to-cart-btn";
    btn.textContent = "Add to Cart";
    btn.addEventListener("click", () => addToCart(product));
    wrap.appendChild(btn);

  } else {

    const stepper = document.createElement("div");
    stepper.className = "qty-controls";

    const minus = document.createElement("button");
    minus.type = "button";
    minus.textContent = "−";
    minus.setAttribute("aria-label", `Remove one ${displayName(product)}`);
    minus.addEventListener("click", () => changeCartQty(product.sku, -1));

    const count = document.createElement("span");
    count.textContent = inCart;

    const plus = document.createElement("button");
    plus.type = "button";
    plus.textContent = "+";
    plus.setAttribute("aria-label", `Add one ${displayName(product)}`);
    // Don't let the card sell more than the sheet says is on the shelf.
    plus.disabled = inCart >= product.stock;
    plus.title = plus.disabled ? `Only ${product.stock} in stock` : "";
    plus.addEventListener("click", () => changeCartQty(product.sku, +1));

    stepper.append(minus, count, plus);
    wrap.appendChild(stepper);

  }

  return wrap;
}

// The same SKU can be on screen twice (its card and the open modal), and the
// cart also moves from the modal — so rebuild every control whenever it changes.
document.addEventListener("cart-changed", () => {
  document.querySelectorAll(".cart-control").forEach(control => {
    const product = allProducts.find(p => p.sku === control.dataset.sku);
    if (product) control.replaceWith(makeCartControl(product));
  });
});

// ===========================
// PRODUCT DETAIL MODAL
// ===========================

function openProductModal(product) {

  const modal = document.getElementById("product-modal");
  const content = document.getElementById("product-modal-content");
  if (!modal || !content) return;

  content.innerHTML = `
    <h2 id="product-modal-name">${escapeHtml(product.name)}</h2>
    ${product.variant
      ? `<p class="variant">${escapeHtml(product.variant)}</p>`
      : ""}
    <p class="product-modal-description">${
      product.description
        ? escapeHtml(product.description)
        : "No description available."
    }</p>
    <p class="product-modal-price"><strong>$${product.price}</strong></p>
  `;

  content.prepend(makeProductImage(product));
  content.appendChild(makeCartControl(product));

  modal.hidden = false;
  modal.querySelector(".product-modal-close")?.focus();
}

function closeProductModal() {
  const modal = document.getElementById("product-modal");
  if (modal) modal.hidden = true;
}

function setupModal() {

  const modal = document.getElementById("product-modal");
  if (!modal) return;

  // Click the backdrop (but not the box itself) to dismiss.
  modal.addEventListener("click", event => {
    if (event.target === modal) closeProductModal();
  });

  modal.querySelector(".product-modal-close")
    ?.addEventListener("click", closeProductModal);

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeProductModal();
  });
}

setupModal();
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
      product.variant.toLowerCase().includes(search) ||
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
