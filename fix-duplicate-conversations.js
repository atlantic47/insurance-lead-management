const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixDuplicates() {
  try {
    console.log('Finding duplicate conversations by phone number...\n');

    const conversations = await prisma.aIConversation.findMany({
      where: { type: 'WHATSAPP_CHAT' },
      orderBy: { createdAt: 'desc' }
    });

    // Group by phone number
    const phoneGroups = {};
    conversations.forEach(conv => {
      const phone = conv.metadata?.phoneNumber;
      if (!phone) return;

      const normalizedPhone = phone.replace(/^\+/, '');
      if (!phoneGroups[normalizedPhone]) {
        phoneGroups[normalizedPhone] = [];
      }
      phoneGroups[normalizedPhone].push(conv);
    });

    // Find duplicates
    const duplicates = Object.entries(phoneGroups).filter(([phone, convs]) => convs.length > 1);

    if (duplicates.length === 0) {
      console.log('No duplicate conversations found!');
      await prisma.$disconnect();
      return;
    }

    console.log(`Found ${duplicates.length} phone numbers with multiple conversations:\n`);

    for (const [phone, convs] of duplicates) {
      console.log(`Phone: ${phone} (${convs.length} conversations)`);
      convs.forEach((conv, idx) => {
        const status = conv.metadata?.status || 'NOT SET';
        console.log(`  ${idx + 1}. ID: ${conv.id} | Status: ${status} | Created: ${conv.createdAt}`);
      });

      // Keep the most recent, mark others as closed
      const mostRecent = convs[0]; // Already sorted desc
      const older = convs.slice(1);

      console.log(`  → Keeping most recent: ${mostRecent.id}`);
      console.log(`  → Marking ${older.length} older conversation(s) as closed\n`);

      for (const oldConv of older) {
        const updatedMetadata = {
          ...oldConv.metadata,
          status: 'closed',
          closedReason: 'Duplicate conversation - newer one exists'
        };

        await prisma.aIConversation.update({
          where: { id: oldConv.id },
          data: { metadata: updatedMetadata }
        });

        console.log(`     ✓ Closed conversation ${oldConv.id}`);
      }
      console.log('');
    }

    console.log('\n✅ Cleanup complete!');
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

fixDuplicates();
