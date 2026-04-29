const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const events = await prisma.ministryEvent.findMany({ select: { id: true, title: true } });
  console.log(JSON.stringify(events, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
