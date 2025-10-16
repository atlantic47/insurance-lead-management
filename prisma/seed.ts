import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create or get default tenant
  const tenant = await prisma.tenant.upsert({
    where: { subdomain: 'default' },
    update: {},
    create: {
      id: 'default-tenant-000',
      name: 'Default Agency',
      subdomain: 'default',
      plan: 'enterprise',
      status: 'active',
      maxUsers: 100,
      maxLeads: 100000,
    },
  });

  console.log('✅ Default tenant created:', tenant.name);

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 12);
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@insurance.com' },
    update: {},
    create: {
      email: 'admin@insurance.com',
      password: hashedPassword,
      firstName: 'System',
      lastName: 'Administrator',
      phone: '+1234567890',
      role: 'ADMIN',
      tenant: { connect: { id: tenant.id } },
    },
  });

  console.log('✅ Admin user created:', admin.email);

  // Create manager user
  const manager = await prisma.user.upsert({
    where: { email: 'manager@insurance.com' },
    update: {},
    create: {
      email: 'manager@insurance.com',
      password: hashedPassword,
      firstName: 'Sales',
      lastName: 'Manager',
      phone: '+1234567891',
      role: 'MANAGER',
      tenant: { connect: { id: tenant.id } },
    },
  });

  console.log('✅ Manager user created:', manager.email);

  // Create agent users
  const agents = await Promise.all([
    prisma.user.upsert({
      where: { email: 'agent1@insurance.com' },
      update: {},
      create: {
        email: 'agent1@insurance.com',
        password: hashedPassword,
        firstName: 'John',
        lastName: 'Smith',
        phone: '+1234567892',
        role: 'AGENT',
        tenant: { connect: { id: tenant.id } },
      },
    }),
    prisma.user.upsert({
      where: { email: 'agent2@insurance.com' },
      update: {},
      create: {
        email: 'agent2@insurance.com',
        password: hashedPassword,
        firstName: 'Jane',
        lastName: 'Doe',
        phone: '+1234567893',
        role: 'AGENT',
        tenant: { connect: { id: tenant.id } },
      },
    }),
  ]);

  console.log('✅ Agent users created:', agents.length);

  // Create insurance products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: 'Comprehensive Life Insurance',
        description: 'Complete life insurance coverage with flexible terms',
        type: 'LIFE',
        basePrice: 150.00,
        features: {
          coverage: 'Up to $1M',
          term: '10-30 years',
          riders: ['Accidental Death', 'Disability Waiver'],
        },
        tenant: { connect: { id: tenant.id } },
      },
    }),
    prisma.product.create({
      data: {
        name: 'Premium Health Insurance',
        description: 'Comprehensive health coverage with dental and vision',
        type: 'HEALTH',
        basePrice: 350.00,
        features: {
          deductible: '$1,000',
          coverage: 'Nationwide',
          includes: ['Dental', 'Vision', 'Prescription'],
        },
        tenant: { connect: { id: tenant.id } },
      },
    }),
    prisma.product.create({
      data: {
        name: 'Auto Insurance Plus',
        description: 'Full coverage auto insurance with roadside assistance',
        type: 'AUTO',
        basePrice: 120.00,
        features: {
          coverage: 'Collision & Comprehensive',
          extras: ['Roadside Assistance', 'Rental Car Coverage'],
        },
        tenant: { connect: { id: tenant.id } },
      },
    }),
    prisma.product.create({
      data: {
        name: 'Homeowner Protection',
        description: 'Complete home insurance with personal property coverage',
        type: 'HOME',
        basePrice: 200.00,
        features: {
          coverage: 'Dwelling & Personal Property',
          liability: 'Up to $500K',
          extras: ['Natural Disaster Coverage'],
        },
        tenant: { connect: { id: tenant.id } },
      },
    }),
  ]);

  console.log('✅ Products created:', products.length);

  // Create companies
  const companies = await Promise.all([
    prisma.company.create({
      data: {
        name: 'Tech Solutions Inc.',
        address: '123 Business St, Austin, TX 78701',
        phone: '+1512555001',
        email: 'contact@techsolutions.com',
        website: 'https://techsolutions.com',
      },
    }),
    prisma.company.create({
      data: {
        name: 'Green Energy Corp',
        address: '456 Green Ave, Seattle, WA 98101',
        phone: '+1206555002',
        email: 'info@greenenergy.com',
        website: 'https://greenenergy.com',
      },
    }),
  ]);

  console.log('✅ Companies created:', companies.length);

  // Create sample leads
  const leads = await Promise.all([
    prisma.lead.create({
      data: {
        source: 'WEBSITE',
        insuranceType: 'LIFE',
        urgency: 3,
        firstName: 'Alice',
        lastName: 'Johnson',
        email: 'alice.johnson@example.com',
        phone: '+1555123001',
        preferredContact: 'EMAIL',
        address: '789 Maple St',
        city: 'Austin',
        state: 'TX',
        zipCode: '78702',
        inquiryDetails: 'Looking for life insurance coverage for a family of 4',
        budget: 200.00,
        assignedUser: { connect: { id: agents[0].id } },
        score: 75.5,
        tenant: { connect: { id: tenant.id } },
      },
    }),
    prisma.lead.create({
      data: {
        source: 'REFERRAL',
        insuranceType: 'AUTO',
        urgency: 4,
        firstName: 'Bob',
        lastName: 'Wilson',
        email: 'bob.wilson@example.com',
        phone: '+1555123002',
        preferredContact: 'PHONE',
        address: '321 Oak Drive',
        city: 'Houston',
        state: 'TX',
        zipCode: '77001',
        inquiryDetails: 'Need auto insurance for new car purchase',
        budget: 150.00,
        assignedUser: { connect: { id: agents[1].id } },
        score: 85.0,
        status: 'CONTACTED',
        tenant: { connect: { id: tenant.id } },
      },
    }),
    prisma.lead.create({
      data: {
        source: 'SOCIAL_MEDIA',
        insuranceType: 'HEALTH',
        urgency: 2,
        firstName: 'Carol',
        lastName: 'Davis',
        email: 'carol.davis@example.com',
        phone: '+1555123003',
        preferredContact: 'EMAIL',
        address: '654 Pine Road',
        city: 'Dallas',
        state: 'TX',
        zipCode: '75201',
        inquiryDetails: 'Interested in health insurance options for self-employed',
        budget: 300.00,
        assignedUser: { connect: { id: agents[0].id } },
        score: 65.0,
        status: 'ENGAGED',
        tenant: { connect: { id: tenant.id } },
      },
    }),
  ]);

  console.log('✅ Leads created:', leads.length);

  // Create sample communications
  const communications = await Promise.all([
    prisma.communication.create({
      data: {
        lead: { connect: { id: leads[0].id } },
        channel: 'EMAIL',
        direction: 'INBOUND',
        subject: 'Life Insurance Inquiry',
        content: 'Hi, I am interested in life insurance options for my family. Can you help me understand the different plans available?',
        user: { connect: { id: agents[0].id } },
        isRead: true,
        tenant: { connect: { id: tenant.id } },
      },
    }),
    prisma.communication.create({
      data: {
        lead: { connect: { id: leads[0].id } },
        channel: 'EMAIL',
        direction: 'OUTBOUND',
        subject: 'RE: Life Insurance Inquiry',
        content: 'Thank you for your interest! I would be happy to help you find the right life insurance plan for your family. Let me schedule a call to discuss your needs.',
        user: { connect: { id: agents[0].id } },
        isRead: true,
        tenant: { connect: { id: tenant.id } },
      },
    }),
    prisma.communication.create({
      data: {
        lead: { connect: { id: leads[1].id } },
        channel: 'PHONE',
        direction: 'OUTBOUND',
        content: 'Called to discuss auto insurance options. Customer is interested in full coverage plan.',
        user: { connect: { id: agents[1].id } },
        metadata: {
          duration: '15 minutes',
          outcome: 'positive',
        },
        tenant: { connect: { id: tenant.id } },
      },
    }),
  ]);

  console.log('✅ Communications created:', communications.length);

  // Create sample tasks
  const tasks = await Promise.all([
    prisma.task.create({
      data: {
        title: 'Follow up with Alice Johnson',
        description: 'Schedule call to discuss life insurance options',
        type: 'FOLLOW_UP',
        priority: 3,
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
        lead: { connect: { id: leads[0].id } },
        assignedUser: { connect: { id: agents[0].id } },
        tenant: { connect: { id: tenant.id } },
      },
    }),
    prisma.task.create({
      data: {
        title: 'Send proposal to Bob Wilson',
        description: 'Prepare and send auto insurance proposal',
        type: 'PROPOSAL',
        priority: 4,
        dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day from now
        lead: { connect: { id: leads[1].id } },
        assignedUser: { connect: { id: agents[1].id } },
        tenant: { connect: { id: tenant.id } },
      },
    }),
    prisma.task.create({
      data: {
        title: 'Health insurance consultation',
        description: 'Schedule consultation call with Carol Davis',
        type: 'CALL',
        priority: 2,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        lead: { connect: { id: leads[2].id } },
        assignedUser: { connect: { id: agents[0].id } },
        tenant: { connect: { id: tenant.id } },
      },
    }),
  ]);

  console.log('✅ Tasks created:', tasks.length);

  // Create sample AI conversations
  const aiConversations = await Promise.all([
    prisma.aIConversation.create({
      data: {
        type: 'CHATBOT',
        input: 'What types of insurance do you offer?',
        output: 'We offer various insurance products including Life, Health, Auto, Home, and Business insurance. Would you like more information about any specific type?',
        confidence: 0.95,
        lead: { connect: { id: leads[0].id } },
        metadata: {
          timestamp: new Date(),
          channel: 'website-chat',
        },
        tenant: { connect: { id: tenant.id } },
      },
    }),
    prisma.aIConversation.create({
      data: {
        type: 'SENTIMENT_ANALYSIS',
        input: 'I am very satisfied with your service and would recommend it to others',
        output: JSON.stringify({ sentiment: 'positive', score: 0.9 }),
        confidence: 0.9,
        lead: { connect: { id: leads[1].id } },
        metadata: {
          analysis: { sentiment: 'positive', score: 0.9 },
        },
        tenant: { connect: { id: tenant.id } },
      },
    }),
  ]);

  console.log('✅ AI Conversations created:', aiConversations.length);

  // Create a sample client (converted lead)
  const client = await prisma.client.upsert({
    where: { policyNumber: 'AUTO-2024-001' },
    update: {},
    create: {
      lead: { connect: { id: leads[1].id } },
      firstName: 'Bob',
      lastName: 'Wilson',
      email: 'bob.wilson@example.com',
      phone: '+1555123002',
      product: { connect: { id: products[2].id } },
      policyNumber: 'AUTO-2024-001',
      premium: 120.00,
      commission: 24.00,
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      renewalDate: new Date(Date.now() + 350 * 24 * 60 * 60 * 1000), // 350 days from now
      tenant: { connect: { id: tenant.id } },
    },
  });

  // Update the lead status to CLOSED_WON
  await prisma.lead.update({
    where: { id: leads[1].id },
    data: { status: 'CLOSED_WON' },
  });

  console.log('✅ Client created and lead converted:', client.policyNumber);

  console.log('🎉 Database seeding completed successfully!');
  
  console.log(`
📋 Summary:
- Users: ${1 + 1 + agents.length} (1 admin, 1 manager, ${agents.length} agents)
- Products: ${products.length}
- Companies: ${companies.length}  
- Leads: ${leads.length}
- Communications: ${communications.length}
- Tasks: ${tasks.length}
- AI Conversations: ${aiConversations.length}
- Clients: 1

🔐 Test Credentials:
- Admin: admin@insurance.com / admin123
- Manager: manager@insurance.com / admin123
- Agent 1: agent1@insurance.com / admin123
- Agent 2: agent2@insurance.com / admin123
  `);
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });