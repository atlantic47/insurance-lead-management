const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TENANT_ID = '3524cf31-27c7-42ef-a93f-e622924bf613';

async function checkTemplate() {
  try {
    console.log('\n=== Checking Templates ===\n');

    const templates = await prisma.whatsAppTemplate.findMany({
      where: {
        tenantId: TENANT_ID,
        name: 'hello_world'  // The template that's failing
      }
    });

    if (templates.length === 0) {
      console.log('❌ No hello_world template found');
      console.log('\nLet me show you all templates:');

      const allTemplates = await prisma.whatsAppTemplate.findMany({
        where: { tenantId: TENANT_ID },
        select: {
          id: true,
          name: true,
          language: true,
          status: true,
          category: true,
          metaTemplateId: true
        }
      });

      console.log(`Found ${allTemplates.length} templates:\n`);
      allTemplates.forEach(t => {
        console.log(`Name: ${t.name}`);
        console.log(`Language: ${t.language}`);
        console.log(`Status: ${t.status}`);
        console.log(`Meta ID: ${t.metaTemplateId}`);
        console.log('---');
      });

      return;
    }

    console.log(`Found ${templates.length} hello_world template(s):\n`);

    for (const template of templates) {
      console.log('ID:', template.id);
      console.log('Name:', template.name);
      console.log('Language:', template.language);
      console.log('Status:', template.status);
      console.log('Category:', template.category);
      console.log('Meta Template ID:', template.metaTemplateId);
      console.log('Body:', template.body?.substring(0, 100));

      if (template.metaPayload) {
        try {
          const metaPayload = typeof template.metaPayload === 'string'
            ? JSON.parse(template.metaPayload)
            : template.metaPayload;

          console.log('\nMeta Payload:');
          console.log(JSON.stringify(metaPayload, null, 2));
        } catch (e) {
          console.log('Meta Payload (raw):', template.metaPayload);
        }
      }

      console.log('---\n');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkTemplate();
