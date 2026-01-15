
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkForecasts() {
    const count = await prisma.salesForecast.count();
    console.log(`SalesForecast count: ${count}`);
    
    if (count > 0) {
        const sample = await prisma.salesForecast.findFirst();
        console.log('Sample:', sample);
    }
}

checkForecasts()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
