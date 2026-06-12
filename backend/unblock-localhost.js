import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const localhostVariants = ['127.0.0.1', '::1', 'localhost', '::ffff:127.0.0.1'];

const all = await prisma.blockedIP.findMany();
console.log(`Total blocked IPs: ${all.length}`);

for (const ip of all) {
  console.log(`  [${ip.id}] ${ip.ipAddress} - ${ip.reason}`);
}

const toDelete = all.filter(ip => localhostVariants.some(v => ip.ipAddress.includes(v)));
console.log(`\nDeleting ${toDelete.length} localhost entries...`);
for (const ip of toDelete) {
  await prisma.blockedIP.delete({ where: { id: ip.id } });
  console.log(`  Deleted ${ip.ipAddress}`);
}

const remaining = await prisma.blockedIP.findMany();
console.log(`\nRemaining blocked IPs: ${remaining.length}`);
for (const ip of remaining) {
  console.log(`  [${ip.id}] ${ip.ipAddress} - ${ip.reason}`);
}

await prisma.$disconnect();
process.exit(0);
