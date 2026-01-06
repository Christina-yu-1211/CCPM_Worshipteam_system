
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function check() {
    try {
        const count = await prisma.emailTemplate.count();
        const templates = await prisma.emailTemplate.findMany();
        console.log('Template Count:', count);
        console.log('Templates:', JSON.stringify(templates, null, 2));
    } catch (e) {
        console.error('Error checking DB:', e);
    } finally {
        await prisma.$disconnect();
    }
}

check();
