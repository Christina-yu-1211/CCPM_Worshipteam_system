
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
    try {
        console.log('Checking database connection...');
        const users = await prisma.user.count();
        console.log(`Users count: ${users}`);

        const events = await prisma.ministryEvent.count();
        console.log(`Events count: ${events}`);

        const series = await prisma.eventSeries.count();
        console.log(`Series count: ${series}`);

        process.exit(0);
    } catch (err) {
        console.error('Database connection or query failed:');
        console.error(err);
        process.exit(1);
    }
}

check();
