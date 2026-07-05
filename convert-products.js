const fs = require("fs");
const { parse } = require("csv-parse/sync");

const csv = fs.readFileSync("data.csv", "utf8");

// Proper CSV parsing (handles commas, quotes, blanks safely)
const records = parse(csv, {
  columns: true,
  skip_empty_lines: true,
  trim: true
});

// Clean + validate data
const products = records.map((row) => ({
  sku: (row.sku || "").trim(),
  name: (row.name || "").trim(),
  price: Number(row.price) || 0,
  stock: Number(row.stock) || 0,
  image: (row.image || "").trim(),
  description: (row.description || "").trim()
})).filter(p => p.sku && p.name);

fs.writeFileSync(
  "products.json",
  JSON.stringify(products, null, 2)
);

console.log("✅ products.json generated successfully");
