const fs = require("fs");
const { parse } = require("csv-parse/sync");

// Read CSV downloaded by GitHub Action
const csvPath = "data.csv";

if (!fs.existsSync(csvPath)) {
  console.error("❌ data.csv not found");
  process.exit(1);
}

const csv = fs.readFileSync(csvPath, "utf8");

// Parse CSV safely
const records = parse(csv, {
  columns: true,
  skip_empty_lines: true,
  trim: true,
  delimiter: ","
});

// Convert to clean product structure
const products = records
  .filter(row => row.sku && row.name)
  .map(row => ({
    sku: String(row.sku).trim(),
    name: String(row.name).trim(),
    variant: String(row.variant || "").trim(),
    price: Number(row.price || 0),
    stock: Number(row.stock || 0),
    image: String(row.image || "").trim(),
    description: String(row.description || "").trim()
  }));

// 🔥 Wrap with metadata so file ALWAYS changes when script runs
const output = {
  updatedAt: new Date().toISOString(),
  productCount: products.length,
  products
};

// Write JSON
fs.writeFileSync(
  "products.json",
  JSON.stringify(output, null, 2)
);

// Debug logs (IMPORTANT for GitHub Actions)
console.log("✅ products.json built successfully");
console.log("📦 Products found:", products.length);
console.log("🕒 Updated at:", output.updatedAt);
