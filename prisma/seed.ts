
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
    console.log('DATABASE_URL present:', !!process.env.DATABASE_URL);
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is missing from environment');
    }
    const admin = await prisma.user.upsert({
        where: { id: 'root_admin' },
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
    console.log('Admin user ensured');

    const templates = [
        {
            type: 'signup_success',
            subject: '【報名成功】禱告山祭壇服事系統',
            content: `<h3>親愛的同工，您好：</h3>
<p>您已成功報名 <strong>{{eventTitle}}</strong>。</p>
<p><strong>服事日期：</strong>{{startDate}} ~ {{endDate}}</p>
<p>願神親自報答您的擺上！</p>
<hr/>
<p><em>(本郵件為系統自動發送)</em></p>`
        },
        {
            type: 'admin_overdue_notice',
            subject: '【管理員提醒】任務逾期通知',
            content: `<h3>管理員您好：</h3>
<p>系統偵測到下列任務已超過期限且尚未標示完成：</p>
<p><strong>任務名稱：</strong>{{taskTitle}}</p>
<p><strong>截止日期：</strong>{{dueDate}}</p>
<p>請撥冗核對處理。</p>`
        }
    ];

    for (const t of templates) {
        await prisma.emailTemplate.upsert({
            where: { type: t.type },
            update: {},
            create: t
        });
    }
    console.log('Default email templates seeded.');
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
