import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // Hash the default admin password
  const hashedPassword = await bcrypt.hash("12345", 10);

  // Create default Admin user (legacy - for backwards compatibility)
  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      password_hash: hashedPassword,
      role: "ADMIN",
    },
  });

  console.log("✅ Created admin user:", {
    user_id: admin.user_id,
    username: admin.username,
    role: admin.role,
  });

  // Create Admin 1 - Desktop Cashier
  const admin1 = await prisma.user.upsert({
    where: { username: "admin1" },
    update: {},
    create: {
      username: "admin1",
      password_hash: hashedPassword,
      role: "ADMIN",
    },
  });

  console.log("✅ Created admin1 (Desktop Cashier):", {
    user_id: admin1.user_id,
    username: admin1.username,
    role: admin1.role,
  });

  // Create Admin 2 - Tablet Cashier
  const admin2 = await prisma.user.upsert({
    where: { username: "admin2" },
    update: {},
    create: {
      username: "admin2",
      password_hash: hashedPassword,
      role: "ADMIN",
    },
  });

  console.log("✅ Created admin2 (Tablet Cashier):", {
    user_id: admin2.user_id,
    username: admin2.username,
    role: admin2.role,
  });

  console.log("🎉 Database seeding completed!");
  console.log("");
  console.log("📋 Available Admin Accounts:");
  console.log("   - admin    (Legacy)          Password: 12345");
  console.log("   - admin1   (Desktop Cashier) Password: 12345");
  console.log("   - admin2   (Tablet Cashier)  Password: 12345");
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

