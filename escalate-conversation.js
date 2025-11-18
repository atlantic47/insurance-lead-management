const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function escalateConversation() {
  try {
    const conversationId = '4eb9efbd-bb84-4092-b3e8-34c8caef8f54';

    console.log(`Escalating conversation: ${conversationId}\n`);

    const conversation = await prisma.aIConversation.findUnique({
      where: { id: conversationId }
    });

    if (!conversation) {
      console.log('Conversation not found!');
      await prisma.$disconnect();
      return;
    }

    const currentMetadata = conversation.metadata;
    const currentStatus = currentMetadata?.status || 'NOT SET';

    console.log(`Current status: ${currentStatus}`);

    const updatedMetadata = {
      ...currentMetadata,
      status: 'escalated'
    };

    await prisma.aIConversation.update({
      where: { id: conversationId },
      data: {
        metadata: updatedMetadata
      }
    });

    console.log(`✅ Successfully updated status: ${currentStatus} → escalated`);

    // Verify the update
    const updated = await prisma.aIConversation.findUnique({
      where: { id: conversationId }
    });

    console.log('\nVerification:');
    console.log('New status:', updated.metadata?.status);

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

escalateConversation();
