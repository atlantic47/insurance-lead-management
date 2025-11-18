const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUserTenant() {
  try {
    const userId = '15bcb4c3-73ee-48be-8e74-739b9e78a8df';

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        tenantId: true,
        tenant: {
          select: {
            id: true,
            name: true,
            subdomain: true,
            settings: true,
          },
        },
      },
    });

    console.log('User Information:');
    console.log(JSON.stringify(user, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserTenant();
