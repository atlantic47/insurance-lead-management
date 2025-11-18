const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const c = await prisma.whatsAppCredential.findFirst();
  console.log('Full token:', c.accessToken);
  console.log('Token length:', c.accessToken.length);
  console.log('Token parts:', c.accessToken.split(':').length);

  const parts = c.accessToken.split(':');
  console.log('\nPart 1 (IV):', parts[0]);
  console.log('Part 2 (encrypted):', parts[1]);
  if (parts[2]) {
    console.log('Part 3 (authTag):', parts[2]);
  } else {
    console.log('Part 3: NOT PRESENT - This is OLD encryption format!');
  }

  await prisma.$disconnect();
})();
