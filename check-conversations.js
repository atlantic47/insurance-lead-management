const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkConversations() {
  try {
    console.log('Fetching all WhatsApp conversations...\n');

    const conversations = await prisma.aIConversation.findMany({
      where: {
        type: 'WHATSAPP_CHAT'
      },
      select: {
        id: true,
        metadata: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`Found ${conversations.length} WhatsApp conversations:\n`);

    conversations.forEach((conv, index) => {
      const metadata = conv.metadata;
      const phoneNumber = metadata?.phoneNumber || 'N/A';
      const customerName = metadata?.customerName || 'Unknown';
      const status = metadata?.status || 'NOT SET';

      console.log(`${index + 1}. Conversation ID: ${conv.id}`);
      console.log(`   Phone: ${phoneNumber}`);
      console.log(`   Customer: ${customerName}`);
      console.log(`   Status: ${status}`);
      console.log(`   Created: ${conv.createdAt}`);
      console.log(`   Full metadata:`, JSON.stringify(metadata, null, 2));
      console.log('---\n');
    });

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkConversations();
