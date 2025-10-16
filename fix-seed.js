const fs = require('fs');
const path = require('path');

const seedPath = path.join(__dirname, 'prisma', 'seed.ts');
let content = fs.readFileSync(seedPath, 'utf8');

// Add tenant creation at the beginning
const tenantCreation = `
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

`;

// Insert tenant creation after the "Starting database seeding" log
content = content.replace(
  "console.log('🌱 Starting database seeding...');",
  "console.log('🌱 Starting database seeding...');" + tenantCreation
);

// Add tenant connection to all user.upsert create blocks
content = content.replace(
  /(prisma\.user\.upsert\(\{[^}]+create:\s*\{[^}]+)(}\s*,\s*}\))/g,
  (match, p1, p2) => {
    if (match.includes('tenant:')) return match;
    return p1 + ",\n      tenant: { connect: { id: tenant.id } }" + p2;
  }
);

// Add tenant to product.create
content = content.replace(
  /(prisma\.product\.create\(\{\s*data:\s*\{[^}]+})\s*,\s*}\s*,\s*}\s*\),)/g,
  (match, p1) => {
    if (match.includes('tenant:')) return match;
    return p1 + ",\n        tenant: { connect: { id: tenant.id } },\n      },\n    }),";
  }
);

// Add tenant to lead.create
content = content.replace(
  /(prisma\.lead\.create\(\{\s*data:\s*\{[^}]+)(}\s*,\s*}\))/g,
  (match, p1, p2) => {
    if (match.includes('tenant:')) return match;
    const lines = p1.split('\n');
    const lastLine = lines[lines.length - 1];
    const indent = lastLine.match(/^\s*/)[0];
    return p1 + ',\n' + indent + 'tenant: { connect: { id: tenant.id } }' + p2;
  }
);

// Add tenant to communication.create
content = content.replace(
  /(prisma\.communication\.create\(\{\s*data:\s*\{[^}]+)(}\s*,\s*}\))/g,
  (match, p1, p2) => {
    if (match.includes('tenant:')) return match;
    const lines = p1.split('\n');
    const lastLine = lines[lines.length - 1];
    const indent = lastLine.match(/^\s*/)[0];
    return p1 + ',\n' + indent + 'tenant: { connect: { id: tenant.id } }' + p2;
  }
);

// Add tenant to task.create
content = content.replace(
  /(prisma\.task\.create\(\{\s*data:\s*\{[^}]+)(}\s*,\s*}\))/g,
  (match, p1, p2) => {
    if (match.includes('tenant:')) return match;
    const lines = p1.split('\n');
    const lastLine = lines[lines.length - 1];
    const indent = lastLine.match(/^\s*/)[0];
    return p1 + ',\n' + indent + 'tenant: { connect: { id: tenant.id } }' + p2;
  }
);

// Add tenant to aIConversation.create
content = content.replace(
  /(prisma\.aIConversation\.create\(\{\s*data:\s*\{[^}]+)(}\s*,\s*}\))/g,
  (match, p1, p2) => {
    if (match.includes('tenant:')) return match;
    const lines = p1.split('\n');
    const lastLine = lines[lines.length - 1];
    const indent = lastLine.match(/^\s*/)[0];
    return p1 + ',\n' + indent + 'tenant: { connect: { id: tenant.id } }' + p2;
  }
);

// Add tenant to client.upsert
content = content.replace(
  /(prisma\.client\.upsert\(\{[^}]+create:\s*\{[^}]+)(}\s*,\s*}\))/g,
  (match, p1, p2) => {
    if (match.includes('tenant:')) return match;
    const lines = p1.split('\n');
    const lastLine = lines[lines.length - 1];
    const indent = lastLine.match(/^\s*/)[0];
    return p1 + ',\n' + indent + 'tenant: { connect: { id: tenant.id } }' + p2;
  }
);

fs.writeFileSync(seedPath, content);
console.log('✅ Seed file updated successfully');
