const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTenantSettings() {
  try {
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        subdomain: true,
        settings: true,
      },
    });

    console.log('Tenant Settings:');
    console.log(JSON.stringify(tenants, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTenantSettings();
