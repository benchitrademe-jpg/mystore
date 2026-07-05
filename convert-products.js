const fs = require("fs");
const { parse } = require("csv-parse/sync");

const csv = fs.readFileSync("data.csv", "utf8");

// AUTO-DETECT DELIMITER (fixes your issue)
const records = parse(csv, {
  columns: true,
  skip_empty_lines: true,
  trim: true,
  relax_column_count: true
});

// Clean data safely
const products = records
  .map((row) => ({
    sku: (row.sku || "").trim(),
    name: (row.name || "").trim(),
    price: Number(row.price),
    stock: Number(row.stock),
    image: (row.image || "").trim(),
    description: (row.description || "").trim()
  }))
  .filter(p => p.sku && p.name);

fs.writeFileSync("products.json", JSON.stringify(products, null, 2));

console.log("✅ Fixed products.json generated");
