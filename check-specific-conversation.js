const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkConversation() {
  try {
    const conversationId = '4eb9efbd-bb84-4092-b3e8-34c8caef8f54';

    console.log(`Checking conversation: ${conversationId}\n`);

    const conversation = await prisma.aIConversation.findUnique({
      where: { id: conversationId },
      include: {
        chatMessages: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });

    if (!conversation) {
      console.log('Conversation not found!');
      await prisma.$disconnect();
      return;
    }

    console.log('Conversation Details:');
    console.log('ID:', conversation.id);
    console.log('Type:', conversation.type);
    console.log('Created:', conversation.createdAt);
    console.log('\nMetadata:');
    console.log(JSON.stringify(conversation.metadata, null, 2));

    console.log('\nRecent Messages (last 10):');
    conversation.chatMessages.forEach((msg, idx) => {
      console.log(`${idx + 1}. [${msg.sender}] ${msg.content.substring(0, 100)}`);
      console.log(`   Created: ${msg.createdAt}`);
    });

    // Check current status
    const status = conversation.metadata?.status;
    console.log('\n===================');
    console.log(`CURRENT STATUS: ${status || 'NOT SET'}`);
    console.log('===================');

    if (status === 'escalated') {
      console.log('\n✅ Conversation is marked as ESCALATED - AI should NOT respond');
    } else if (status === 'active') {
      console.log('\n⚠️ Conversation is marked as ACTIVE - AI WILL respond');
    } else {
      console.log(`\n❓ Conversation has unusual status: ${status}`);
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkConversation();
