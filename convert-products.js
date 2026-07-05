const fs = require("fs");
const { parse } = require("csv-parse/sync");

const csv = fs.readFileSync("data.csv", "utf8");

// FORCE COMMA DELIMITER (this is the key fix)
const records = parse(csv, {
  columns: true,
  skip_empty_lines: true,
  trim: true,
  delimiter: ","
});

// Hard-safe mapping (no guessing)
const products = records
  .filter(row => row.sku && row.name)
  .map(row => ({
    sku: String(row.sku).trim(),
    name: String(row.name).trim(),
    price: Number(row.price || 0),
    stock: Number(row.stock || 0),
    image: String(row.image || "").trim(),
    description: String(row.description || "").trim()
  }));

fs.writeFileSync(
  "products.json",
  JSON.stringify(products, null, 2)
);

console.log("✅ products.json built correctly");
