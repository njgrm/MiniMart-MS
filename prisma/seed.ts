import { PrismaClient, StockMovementType } from "@prisma/client";
import bcrypt from "bcryptjs";
import * as fs from "fs";
import * as path from "path";
import { execSync, spawn } from "child_process";

const prisma = new PrismaClient();

// Progress bar helper
function printProgress(current: number, total: number, label: string) {
  const percentage = Math.round((current / total) * 100);
  const barLength = 30;
  const filled = Math.round((current / total) * barLength);
  const empty = barLength - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);
  process.stdout.write(`\r   ${bar} ${percentage}% | ${label}: ${current.toLocaleString()}/${total.toLocaleString()}`);
}

// Run Python script to generate sales history
async function runPythonGenerator(): Promise<boolean> {
  console.log("🐍 Running Python data generator...");
  const scriptPath = path.join(__dirname, "../scripts/generate_history_v3.py");
  
  if (!fs.existsSync(scriptPath)) {
    console.log("⚠️  generate_history_v3.py not found, skipping Python generation...");
    return false;
  }

  return new Promise((resolve) => {
    try {
      // Try python3 first, then python
      const pythonCmd = process.platform === "win32" ? "python" : "python3";
      const pythonProcess = spawn(pythonCmd, [scriptPath], {
        cwd: path.join(__dirname, "../scripts"),
        stdio: ["inherit", "pipe", "pipe"],
      });

      let output = "";
      pythonProcess.stdout?.on("data", (data) => {
        output += data.toString();
        process.stdout.write(data);
      });
      pythonProcess.stderr?.on("data", (data) => {
        process.stderr.write(data);
      });

      pythonProcess.on("close", (code) => {
        if (code === 0) {
          console.log("✅ Python generator completed successfully");
          resolve(true);
        } else {
          console.log(`⚠️  Python generator exited with code ${code}`);
          resolve(false);
        }
      });

      pythonProcess.on("error", (err) => {
        console.log(`⚠️  Failed to run Python: ${err.message}`);
        resolve(false);
      });
    } catch (e) {
      console.log(`⚠️  Python execution failed: ${e}`);
      resolve(false);
    }
  });
}

// CSV Parser that handles quoted fields properly
function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split("\n").filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === headers.length) {
      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header.trim()] = values[idx].trim();
      });
      rows.push(row);
    }
  }

  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

async function seedUsers() {
  console.log("👤 Seeding users...");
  const hashedPassword = await bcrypt.hash("12345", 10);

  const users = [
    { username: "admin", role: "ADMIN" },
    { username: "admin1", role: "ADMIN" },
    { username: "admin2", role: "ADMIN" },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { username: user.username },
      update: {},
      create: {
        username: user.username,
        password_hash: hashedPassword,
        role: user.role,
      },
    });
  }

  console.log("✅ Created admin users (password: 12345)");
}

async function seedSuppliers() {
  console.log("🏢 Seeding suppliers...");
  const csvPath = path.join(__dirname, "../scripts/suppliers.csv");

  if (!fs.existsSync(csvPath)) {
    console.log("⚠️  suppliers.csv not found, skipping...");
    return new Map<number, number>();
  }

  const content = fs.readFileSync(csvPath, "utf-8");
  const rows = parseCSV(content);
  const supplierMap = new Map<number, number>(); // CSV id -> DB id

  for (const row of rows) {
    const csvId = parseInt(row.id);
    const supplier = await prisma.supplier.upsert({
      where: { name: row.name },
      update: {
        contact_person: row.contact_person || null,
        contact_number: row.contact_number || null,
        email: row.email || null,
        address: row.address || null,
        notes: row.notes || null,
        status: row.status || "ACTIVE",
      },
      create: {
        name: row.name,
        contact_person: row.contact_person || null,
        contact_number: row.contact_number || null,
        email: row.email || null,
        address: row.address || null,
        notes: row.notes || null,
        status: row.status || "ACTIVE",
      },
    });
    supplierMap.set(csvId, supplier.id);
  }

  console.log(`✅ Created ${rows.length} suppliers`);
  return supplierMap;
}

async function seedProducts() {
  console.log("📦 Seeding products...");
  const csvPath = path.join(__dirname, "../scripts/products.csv");

  if (!fs.existsSync(csvPath)) {
    console.log("⚠️  products.csv not found, skipping...");
    return new Map<string, number>();
  }

  const content = fs.readFileSync(csvPath, "utf-8");
  const rows = parseCSV(content);
  const productMap = new Map<string, number>(); // barcode -> product_id

  for (const row of rows) {
    const product = await prisma.product.upsert({
      where: { barcode: row.barcode },
      update: {
        product_name: row.name,
        category: row.category,
        retail_price: parseFloat(row.retail_price) || 0,
        wholesale_price: parseFloat(row.wholesale_price) || 0,
        cost_price: parseFloat(row.cost_price) || 0,
        image_url: row.image_url || null,
        nearest_expiry_date: row.expiry_date ? new Date(row.expiry_date) : null,
      },
      create: {
        product_name: row.name,
        category: row.category,
        retail_price: parseFloat(row.retail_price) || 0,
        wholesale_price: parseFloat(row.wholesale_price) || 0,
        cost_price: parseFloat(row.cost_price) || 0,
        barcode: row.barcode,
        image_url: row.image_url || null,
        nearest_expiry_date: row.expiry_date ? new Date(row.expiry_date) : null,
      },
    });

    productMap.set(row.barcode, product.product_id);

    // Create or update inventory
    const reorderLevel = parseInt(row.reorder_level) || 10;
    const stock = parseInt(row.stock) || 0;

    await prisma.inventory.upsert({
      where: { product_id: product.product_id },
      update: {
        current_stock: stock,
        reorder_level: reorderLevel,
      },
      create: {
        product_id: product.product_id,
        current_stock: stock,
        reorder_level: reorderLevel,
      },
    });
  }

  console.log(`✅ Created ${rows.length} products with inventory`);
  return productMap;
}

async function seedInventoryBatches(
  supplierMap: Map<number, number>,
  productMap: Map<string, number>
) {
  console.log("📋 Seeding inventory batches...");
  const csvPath = path.join(__dirname, "../scripts/inventory_batches.csv");

  if (!fs.existsSync(csvPath)) {
    console.log("⚠️  inventory_batches.csv not found, skipping...");
    return new Map<number, number>();
  }

  const content = fs.readFileSync(csvPath, "utf-8");
  const rows = parseCSV(content);
  const batchMap = new Map<number, number>(); // CSV id -> DB id
  const totalRows = rows.length;

  let created = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const csvBatchId = parseInt(row.id);
    const productId = productMap.get(row.product_barcode);
    const supplierId = row.supplier_id ? supplierMap.get(parseInt(row.supplier_id)) : undefined;

    if (!productId) {
      // Product not found, try to find by name
      const product = await prisma.product.findFirst({
        where: { product_name: row.product_name },
      });
      if (!product) {
        continue; // Skip silently
      }
    }

    const actualProductId = productId || (await prisma.product.findFirst({
      where: { product_name: row.product_name },
    }))?.product_id;

    if (!actualProductId) continue;

    const batch = await prisma.inventoryBatch.create({
      data: {
        product_id: actualProductId,
        quantity: parseInt(row.quantity) || 0,
        expiry_date: row.expiry_date ? new Date(row.expiry_date) : null,
        received_date: row.received_date ? new Date(row.received_date) : new Date(),
        supplier_ref: row.supplier_ref || null,
        supplier_name: row.supplier_name || null,
        supplier_id: supplierId || null,
        cost_price: parseFloat(row.cost_price) || null,
        status: row.status || "ACTIVE",
      },
    });

    batchMap.set(csvBatchId, batch.id);
    created++;
    
    // Progress every 100 batches
    if (created % 100 === 0 || created === totalRows) {
      printProgress(created, totalRows, "Batches");
    }
  }

  console.log(""); // New line after progress
  console.log(`✅ Created ${created} inventory batches`);
  return batchMap;
}

async function seedStockMovementsReturns(
  supplierMap: Map<number, number>,
  productMap: Map<string, number>
) {
  console.log("🔄 Seeding stock movements (returns)...");
  const csvPath = path.join(__dirname, "../scripts/stock_movements_returns.csv");

  if (!fs.existsSync(csvPath)) {
    console.log("⚠️  stock_movements_returns.csv not found, skipping...");
    return;
  }

  const content = fs.readFileSync(csvPath, "utf-8");
  const rows = parseCSV(content);

  // Get default admin user for logging
  const adminUser = await prisma.user.findFirst({ where: { username: "admin" } });
  if (!adminUser) {
    console.log("⚠️  Admin user not found, skipping stock movements");
    return;
  }

  let created = 0;
  for (const row of rows) {
    const productId = productMap.get(row.product_barcode);
    const supplierId = row.supplier_id ? supplierMap.get(parseInt(row.supplier_id)) : undefined;

    // Find inventory by product
    let inventory: { inventory_id: number; current_stock: number } | null = null;

    if (productId) {
      inventory = await prisma.inventory.findUnique({
        where: { product_id: productId },
      });
    }

    if (!inventory) {
      // Try to find by product name
      const product = await prisma.product.findFirst({
        where: { product_name: row.product_name },
      });
      if (product) {
        inventory = await prisma.inventory.findUnique({
          where: { product_id: product.product_id },
        });
      }
    }

    if (!inventory) {
      console.log(`⚠️  Inventory not found for return: ${row.product_name}`);
      continue;
    }

    const quantityChange = parseInt(row.quantity_change) || 0;
    const previousStock = inventory.current_stock;
    const newStock = previousStock + quantityChange;

    await prisma.stockMovement.create({
      data: {
        inventory_id: inventory.inventory_id,
        user_id: adminUser.user_id,
        movement_type: (row.movement_type as StockMovementType) || "SUPPLIER_RETURN",
        quantity_change: quantityChange,
        previous_stock: previousStock,
        new_stock: Math.max(0, newStock),
        reason: row.reason || null,
        reference: row.reference || null,
        supplier_name: row.supplier_name || null,
        supplier_id: supplierId || null,
        cost_price: parseFloat(row.cost_price) || null,
        created_at: row.created_at ? new Date(row.created_at) : new Date(),
      },
    });

    // Update inventory stock
    await prisma.inventory.update({
      where: { inventory_id: inventory.inventory_id },
      data: { current_stock: Math.max(0, newStock) },
    });

    created++;
  }

  console.log(`✅ Created ${created} stock movements (returns)`);
}

async function seedSalesHistory(productMap: Map<string, number>) {
  console.log("💰 Seeding sales history...");
  
  // Try v3 first (generated by Python), then fall back to v2
  let csvPath = path.join(__dirname, "../scripts/sales_history_v3.csv");
  let useV3 = true;
  
  if (!fs.existsSync(csvPath)) {
    csvPath = path.join(__dirname, "../scripts/sales_history_v2.csv");
    useV3 = false;
    if (!fs.existsSync(csvPath)) {
      console.log("⚠️  No sales_history CSV found, skipping...");
      return;
    }
  }
  
  console.log(`   📂 Using ${useV3 ? "v3 (Python-generated)" : "v2"} sales data`);

  // Get or create admin user for transactions
  let adminUser = await prisma.user.findFirst({
    where: { username: "admin" },
  });

  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        username: "admin",
        password_hash: await bcrypt.hash("12345", 10),
        role: "ADMIN",
      },
    });
  }

  // Get default customer (Walk-in)
  let walkInCustomer = await prisma.customer.findFirst({
    where: { name: "Walk-in Customer" },
  });

  if (!walkInCustomer) {
    walkInCustomer = await prisma.customer.create({
      data: {
        name: "Walk-in Customer",
        email: "walkin@minimart.local",
        contact_details: null,
      },
    });
  }

  const content = fs.readFileSync(csvPath, "utf-8");
  const rows = parseCSV(content);
  
  console.log(`   📊 Loaded ${rows.length.toLocaleString()} sales records`);

  // Group by transaction_id (or date+time for unique transactions)
  const transactionGroups = new Map<string, typeof rows>();
  for (const row of rows) {
    // Use transaction_id if available, otherwise generate from date+time
    const txnKey = row.transaction_id || `${row.date}-${row.time || "12:00:00"}`;
    if (!transactionGroups.has(txnKey)) {
      transactionGroups.set(txnKey, []);
    }
    transactionGroups.get(txnKey)!.push(row);
  }

  const transactionEntries = Array.from(transactionGroups.entries());
  const totalTransactions = transactionEntries.length;
  console.log(`   🔄 Creating ${totalTransactions.toLocaleString()} transactions...`);

  // ============================================================
  // OPTIMIZED APPROACH: Create transactions individually but 
  // batch items and payments using createMany
  // ============================================================
  
  const BATCH_SIZE = 500; // Larger batches 
  let transactionsCreated = 0;
  let itemsCreated = 0;
  let skippedProducts = 0;

  for (let batchStart = 0; batchStart < transactionEntries.length; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, transactionEntries.length);
    const batch = transactionEntries.slice(batchStart, batchEnd);
    
    // Collect all items and payments for bulk insert
    const allPayments: { transaction_id: number; payment_method: string; amount_tendered: number; change: number }[] = [];
    const allItems: { transaction_id: number; product_id: number; quantity: number; price_at_sale: number; subtotal: number; cost_at_sale: number }[] = [];
    
    // Create transactions in a single prisma transaction (atomic + faster)
    await prisma.$transaction(async (tx) => {
      for (const [txnKey, items] of batch) {
        const firstItem = items[0];
        const totalAmount = items.reduce((sum, item) => 
          sum + parseFloat(item.subtotal || item.total || "0"), 0
        );
        
        const dateStr = firstItem.date;
        const timeStr = firstItem.time || "12:00:00";
        const txnDate = new Date(`${dateStr}T${timeStr}`);
        const paymentMethod = (firstItem.payment_method?.toUpperCase() === "GCASH") ? "GCASH" : "CASH";

        // Create transaction - this is needed to get the ID
        const transaction = await tx.transaction.create({
          data: {
            user_id: adminUser!.user_id,
            customer_id: walkInCustomer!.customer_id,
            total_amount: totalAmount,
            status: "COMPLETED",
            created_at: txnDate,
          },
        });

        // Queue payment for bulk insert
        allPayments.push({
          transaction_id: transaction.transaction_id,
          payment_method: paymentMethod,
          amount_tendered: totalAmount,
          change: 0,
        });

        // Queue items for bulk insert
        for (const item of items) {
          const productId = productMap.get(item.barcode);
          if (!productId) {
            skippedProducts++;
            continue;
          }

          const priceAtSale = parseFloat(item.retail_price || item.unit_price || "0");
          const qty = parseInt(item.quantity) || 1;
          const subtotal = parseFloat(item.subtotal || item.total || "0") || priceAtSale * qty;
          const costAtSale = parseFloat(item.cost_price || "0");

          allItems.push({
            transaction_id: transaction.transaction_id,
            product_id: productId,
            quantity: qty,
            price_at_sale: priceAtSale,
            subtotal: subtotal,
            cost_at_sale: costAtSale,
          });
        }

        transactionsCreated++;
      }

      // Bulk insert payments and items within the same transaction
      if (allPayments.length > 0) {
        await tx.payment.createMany({ data: allPayments });
      }
      if (allItems.length > 0) {
        await tx.transactionItem.createMany({ data: allItems });
        itemsCreated += allItems.length;
      }
    });
    
    printProgress(batchEnd, totalTransactions, "Transactions");
  }

  console.log(""); // New line after progress bar
  console.log(`✅ Created ${transactionsCreated.toLocaleString()} transactions with ${itemsCreated.toLocaleString()} items`);
  if (skippedProducts > 0) {
    console.log(`   ⚠️  Skipped ${skippedProducts} items (products not found)`);
  }
}

async function main() {
  console.log("🌱 Starting comprehensive database seed...");
  console.log("================================================");

  // 0. Run Python generator for sales history (optional)
  await runPythonGenerator();
  console.log(""); // Blank line separator

  // 1. Seed users
  await seedUsers();

  // 2. Seed suppliers
  const supplierMap = await seedSuppliers();

  // 3. Seed products (and inventory)
  const productMap = await seedProducts();

  // 4. Seed inventory batches
  const batchMap = await seedInventoryBatches(supplierMap, productMap);

  // 5. Seed stock movements (returns)
  await seedStockMovementsReturns(supplierMap, productMap);

  // 6. Seed sales history (transactions)
  await seedSalesHistory(productMap);

  console.log("================================================");
  console.log("🎉 Database seeding completed!");
  console.log("");
  console.log("📋 Summary:");
  console.log("   - Admin accounts: admin, admin1, admin2 (password: 12345)");
  console.log(`   - Suppliers: ${supplierMap.size}`);
  console.log(`   - Products: ${productMap.size}`);
  console.log(`   - Inventory Batches: ${batchMap.size}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Seeding failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });

