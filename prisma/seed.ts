
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
    const admin = await prisma.user.upsert({
        where: { email: 'admin' },
        update: {},
        create: {
            id: 'root_admin',
            name: '系統管理員',
            email: 'admin',
            password: 'admin',
            role: 'core_admin',
            title: '系統管理',
            isApproved: true,
            totalServiceCount: 0,
            consecutiveMonths: 0
        },
    });
    console.log({ admin });
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
