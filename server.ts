
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

import cron from 'node-cron';
import { sendEmail } from './mailService.js';

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'dist')));

// --- USERS ---
app.get('/api/users', async (req, res) => {
    try {
        const users = await prisma.user.findMany();
        res.json(users);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: '無法取得使用者列表' });
    }
});

app.post('/api/users', async (req, res) => {
    try {
        const data = { ...req.body };
        if (data.email) data.email = data.email.trim().toLowerCase();
        if (data.email === '') data.email = null;

        const user = await prisma.user.create({ data });
        res.json(user);
    } catch (e) {
        console.error(e);
        res.status(400).json({ error: '註冊失敗，請檢查資料格式' });
    }
});

app.put('/api/users/:id', async (req, res) => {
    try {
        const data = { ...req.body };
        if (data.email) data.email = data.email.trim().toLowerCase();
        if (data.email === '') data.email = null;

        const user = await prisma.user.update({
            where: { id: req.params.id },
            data: data,
        });
        res.json(user);
    } catch (e) {
        console.error(e);
        res.status(400).json({ error: '更新失敗' });
    }
});

app.delete('/api/users/:id', async (req, res) => {
    try {
        await prisma.user.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(400).json({ error: '新增活動系列失敗' });
    }
});

// --- SERIES ---
app.get('/api/series', async (req, res) => {
    try {
        const series = await prisma.eventSeries.findMany();
        res.json(series);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: '無法取得系列列表' });
    }
});

app.post('/api/series', async (req, res) => {
    try {
        const series = await prisma.eventSeries.create({ data: req.body });
        res.json(series);
    } catch (e) {
        console.error(e);
        res.status(400).json({ error: '新增活動系列失敗' });
    }
});

app.put('/api/series/:id', async (req, res) => {
    try {
        const series = await prisma.eventSeries.update({
            where: { id: req.params.id },
            data: req.body,
        });
        res.json(series);
    } catch (e) {
        console.error(e);
        res.status(400).json({ error: '修改系列失敗' });
    }
});

app.delete('/api/series/:id', async (req, res) => {
    try {
        await prisma.eventSeries.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(400).json({ error: '刪除系列失敗' });
    }
});


// --- EVENTS ---
app.get('/api/events', async (req, res) => {
    try {
        const events = await prisma.ministryEvent.findMany({
            include: { series: true },
            orderBy: { startDate: 'asc' }
        });
        const parsed = events.map(e => {
            let mealsConfig = [];
            try {
                mealsConfig = JSON.parse(e.mealsConfig as string || '[]');
            } catch (err) {
                console.error(`Failed to parse mealsConfig for event ${e.id}:`, err);
                mealsConfig = [];
            }
            return {
                ...e,
                mealsConfig
            };
        });
        res.json(parsed);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: '無法取得活動列表' });
    }
});

app.post('/api/events', async (req, res) => {
    try {
        const { mealsConfig, ...rest } = req.body;
        // Don't pass 'series' object if provided, prisma expects seriesId
        // rest should only contain scalar fields + seriesId
        const { series, ...dataToSave } = rest;

        const event = await prisma.ministryEvent.create({
            data: {
                ...dataToSave,
                mealsConfig: JSON.stringify(mealsConfig)
            }
        });

        // --- NEW: Send Email Notification to All Volunteers ---
        const volunteers = await prisma.user.findMany({
            where: { isApproved: true, role: 'volunteer', email: { not: null } }
        });

        const subject = `【新活動通知】邀請您參與 - ${event.title}`;
        const html = `
            <div style="font-size: 18px;">
                <h3>同工平安，新增了一項服事活動</h3>
                <p>敬拜團系統上已新增以下活動：</p>
                <p><strong style="color: darkblue;">${event.title}</strong></p>
                <p>日期：${event.startDate}</p>
                <hr/>
                <p>誠摯邀請您一起來同工！請登入系統查看詳情並報名。</p>
            </div>
        `;

        // Send asynchronously to avoid blocking the response too long
        console.log(`[Notification] 📧 Preparing to send new event notifications to ${volunteers.length} volunteers...`);
        (async () => {
            let successCount = 0;
            let failCount = 0;
            for (const volunteer of volunteers) {
                if (volunteer.email) {
                    try {
                        console.log(`[Notification] Sending to: ${volunteer.email}`);
                        const result = await sendEmail(volunteer.email, subject, html);
                        if (result.success) successCount++;
                        else {
                            console.error(`[Notification] ❌ Failed to send to ${volunteer.email}:`, result.error);
                            failCount++;
                        }
                    } catch (err) {
                        console.error(`[Notification] ❌ Exception sending to ${volunteer.email}:`, err);
                        failCount++;
                    }
                }
            }
            console.log(`[Notification] 📧 Finished sending. Success: ${successCount}, Failed: ${failCount}`);
        })();

        res.json(event);
    } catch (e) {
        console.error(e);
        res.status(400).json({ error: '新增活動失敗' });
    }
});

app.put('/api/events/:id', async (req, res) => {
    try {
        const { id: _, series: __, signups: ___, mealsConfig, ...rest } = req.body;

        // Strictly pick only fields that exist in the schema
        const allowedFields = [
            'seriesId', 'title', 'startDate', 'endDate', 'startTime',
            'location', 'isRegistrationOpen', 'registrationDeadline',
            'remarks', 'isReportDownloaded', 'shuttleConfig'
        ];

        const updateData: any = {};
        allowedFields.forEach(field => {
            if (rest[field] !== undefined) {
                updateData[field] = rest[field];
            }
        });

        const event = await prisma.ministryEvent.update({
            where: { id: req.params.id },
            data: {
                ...updateData,
                mealsConfig: mealsConfig ? JSON.stringify(mealsConfig) : undefined
            },
        });
        res.json(event);
    } catch (e) {
        console.error('Update Event Error:', e);
        res.status(400).json({ error: '更新活動失敗' });
    }
});

app.delete('/api/events/:id', async (req, res) => {
    try {
        await prisma.ministryEvent.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(400).json({ error: '刪除活動失敗' });
    }
});

// --- SIGNUPS ---
app.get('/api/signups', async (req, res) => {
    try {
        const signups = await prisma.signup.findMany();
        const parsed = signups.map(s => {
            let attendingDays = [];
            let meals = [];
            try {
                attendingDays = JSON.parse(s.attendingDays as string || '[]');
            } catch (err) {
                console.error(`Failed to parse attendingDays for signup ${s.id}:`, err);
            }
            try {
                meals = JSON.parse(s.meals as string || '[]');
            } catch (err) {
                console.error(`Failed to parse meals for signup ${s.id}:`, err);
            }
            return {
                ...s,
                attendingDays,
                meals,
            };
        });
        res.json(parsed);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: '無法取得報名列表' });
    }
});

app.post('/api/signups', async (req, res) => {
    try {
        const { attendingDays, meals, ...rest } = req.body;

        // Pick only allowed fields to prevent schema mismatch
        const allowedFields = [
            'eventId', 'volunteerId', 'transportMode', 'arrivalLocation', 'arrivalDate', 'arrivalTime',
            'departureMode', 'departureLocation', 'departureDate', 'departureTime', 'notes', 'submissionDate',
            'earlyArrivalType', 'earlyArrivalStatus', 'earlyArrivalReason'
        ];

        const dataToSave: any = {};
        allowedFields.forEach(field => {
            if (rest[field] !== undefined) dataToSave[field] = rest[field];
        });

        const signup = await prisma.signup.create({
            data: {
                ...dataToSave,
                attendingDays: JSON.stringify(attendingDays),
                meals: JSON.stringify(meals)
            },
            include: { volunteer: true, event: true }
        });

        res.json(signup);
    } catch (e) {
        console.error('Create Signup Error:', e);
        res.status(400).json({ error: '報名失敗' });
    }
});
app.delete('/api/signups/:id', async (req, res) => {
    try {
        await prisma.signup.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(400).json({ error: '刪除報名失敗' });
    }
});

app.put('/api/signups/:id', async (req, res) => {
    try {
        const { id: _, event: __, volunteer: ___, attendingDays, meals, ...rest } = req.body;
        console.log(`[Backend] Updating signup ${req.params.id}. Payload:`, rest);

        // 1. Fetch current signup and its associated event
        const oldSignup = await prisma.signup.findUnique({
            where: { id: req.params.id },
            include: { event: true, volunteer: true }
        });

        if (!oldSignup) {
            return res.status(404).json({ error: '找不到報名紀錄' });
        }

        // Strictly pick only scalar fields allowed in Signup model
        const allowedFields = [
            'eventId', 'volunteerId', 'transportMode', 'arrivalLocation', 'arrivalDate', 'arrivalTime',
            'departureMode', 'departureLocation', 'departureDate', 'departureTime', 'notes', 'submissionDate',
            'earlyArrivalType', 'earlyArrivalStatus', 'earlyArrivalReason'
        ];

        const updateData: any = {};
        allowedFields.forEach(field => {
            if (rest[field] !== undefined) {
                updateData[field] = rest[field];
            }
        });

        const signup = await prisma.signup.update({
            where: { id: req.params.id },
            data: {
                ...updateData,
                attendingDays: typeof attendingDays === 'object' ? JSON.stringify(attendingDays) : attendingDays,
                meals: typeof meals === 'object' ? JSON.stringify(meals) : meals
            }
        });

        // 2. If registration is closed, notify admins
        if (!oldSignup.event.isRegistrationOpen) {
            console.log(`[Notification] ⚠️ Closed event modified!`);
            console.log(`[Notification] Event: ${oldSignup.event.title}`);
            console.log(`[Notification] Volunteer: ${oldSignup.volunteer.name}`);

            const admins = await prisma.user.findMany({
                where: {
                    role: { in: ['core_admin', 'admin'] },
                    isApproved: true,
                    email: { not: null }
                }
            });

            console.log(`[Notification] Found ${admins.length} admins:`, admins.map(a => ({ name: a.name, email: a.email })));

            if (admins.length > 0) {
                // Parse old data
                const oldAttendingDays = JSON.parse(oldSignup.attendingDays as string || '[]');
                const oldMeals = JSON.parse(oldSignup.meals as string || '[]');

                // Parse new data
                const newAttendingDays = typeof attendingDays === 'object' ? attendingDays : JSON.parse(attendingDays || '[]');
                const newMeals = typeof meals === 'object' ? meals : JSON.parse(meals || '[]');

                // Helper function to format transport mode
                const formatTransport = (mode: string) => mode === 'shuttle' ? '搭乘交通車' : '自行前往';

                // Helper function to format location
                const formatLocation = (loc: string) => {
                    const map: any = { 'Zaoqiao': '造橋', 'Zhunan': '竹南', 'HSR_Miaoli': '高鐵苗栗' };
                    return map[loc] || loc;
                };

                // Helper function to format meals
                const formatMeals = (meals: any[]) => {
                    if (!meals || meals.length === 0) return '無';
                    return meals.map((m: any) => `${m.date} ${m.type === 'breakfast' ? '早' : m.type === 'lunch' ? '午' : '晚'}`).join('、');
                };

                // Build comparison rows
                const changes: { field: string, old: string, new: string }[] = [];

                if (oldSignup.transportMode !== (rest.transportMode || oldSignup.transportMode)) {
                    changes.push({
                        field: '去程交通',
                        old: formatTransport(oldSignup.transportMode),
                        new: formatTransport(rest.transportMode || oldSignup.transportMode)
                    });
                }

                if (oldSignup.transportMode === 'shuttle' && oldSignup.arrivalLocation !== (rest.arrivalLocation || oldSignup.arrivalLocation)) {
                    changes.push({
                        field: '去程地點',
                        old: formatLocation(oldSignup.arrivalLocation || ''),
                        new: formatLocation(rest.arrivalLocation || oldSignup.arrivalLocation || '')
                    });
                }

                if (oldSignup.arrivalTime !== (rest.arrivalTime || oldSignup.arrivalTime)) {
                    changes.push({
                        field: '去程時間',
                        old: oldSignup.arrivalTime || '',
                        new: rest.arrivalTime || oldSignup.arrivalTime || ''
                    });
                }

                if (oldSignup.departureMode !== (rest.departureMode || oldSignup.departureMode)) {
                    changes.push({
                        field: '回程交通',
                        old: formatTransport(oldSignup.departureMode || 'self'),
                        new: formatTransport(rest.departureMode || oldSignup.departureMode || 'self')
                    });
                }

                if (oldSignup.departureMode === 'shuttle' && oldSignup.departureLocation !== (rest.departureLocation || oldSignup.departureLocation)) {
                    changes.push({
                        field: '回程地點',
                        old: formatLocation(oldSignup.departureLocation || ''),
                        new: formatLocation(rest.departureLocation || oldSignup.departureLocation || '')
                    });
                }

                if (oldSignup.departureTime !== (rest.departureTime || oldSignup.departureTime)) {
                    changes.push({
                        field: '回程時間',
                        old: oldSignup.departureTime || '',
                        new: rest.departureTime || oldSignup.departureTime || ''
                    });
                }

                if (JSON.stringify(oldAttendingDays) !== JSON.stringify(newAttendingDays)) {
                    changes.push({
                        field: '參加天數',
                        old: oldAttendingDays.join('、') || '無',
                        new: newAttendingDays.join('、') || '無'
                    });
                }

                if (JSON.stringify(oldMeals) !== JSON.stringify(newMeals)) {
                    changes.push({
                        field: '餐食登記',
                        old: formatMeals(oldMeals),
                        new: formatMeals(newMeals)
                    });
                }

                if (oldSignup.notes !== (rest.notes || oldSignup.notes || '')) {
                    changes.push({
                        field: '備註',
                        old: oldSignup.notes || '無',
                        new: rest.notes || oldSignup.notes || '無'
                    });
                }

                console.log(`[Notification] Detected ${changes.length} changes:`, changes);

                // Build change table HTML
                let changeTableHtml = '';
                if (changes.length > 0) {
                    changeTableHtml = `
                        <h4 style="color: #333; margin-top: 20px;">📋 異動內容對照：</h4>
                        <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px;">
                            <thead>
                                <tr style="background-color: #f8f9fa;">
                                    <th style="border: 1px solid #dee2e6; padding: 10px; text-align: left; width: 25%;">欄位</th>
                                    <th style="border: 1px solid #dee2e6; padding: 10px; text-align: left; width: 37.5%;">原始資料</th>
                                    <th style="border: 1px solid #dee2e6; padding: 10px; text-align: left; width: 37.5%;">更新後資料</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${changes.map(c => `
                                    <tr>
                                        <td style="border: 1px solid #dee2e6; padding: 10px; font-weight: bold;">${c.field}</td>
                                        <td style="border: 1px solid #dee2e6; padding: 10px; color: #dc3545;">${c.old}</td>
                                        <td style="border: 1px solid #dee2e6; padding: 10px; color: #28a745; font-weight: bold;">${c.new}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    `;
                } else {
                    changeTableHtml = '<p style="color: #6c757d; font-style: italic;">（系統未偵測到明顯變更，可能為重新送出相同資料）</p>';
                }

                const subject = `【報名異動通知】${oldSignup.volunteer.name} 修改了已關閉報名的活動`;
                const html = `
                    <div style="font-family: sans-serif; line-height: 1.6;">
                        <h3 style="color: #d9534f;">⚠️ 報名異動提醒 (活動已關閉報名)</h3>
                        <p>義工 <strong>${oldSignup.volunteer.name}</strong> 剛剛修改了活動 <strong>${oldSignup.event.title}</strong> 的報名內容。</p>
                        <p>由於該活動目前處於「<strong>報名截止</strong>」狀態，請管理員核對內容是否有誤。</p>
                        <hr style="border: none; border-top: 1px solid #dee2e6; margin: 20px 0;"/>
                        <p><strong>活動名稱：</strong>${oldSignup.event.title}</p>
                        <p><strong>義工姓名：</strong>${oldSignup.volunteer.name}</p>
                        <p><strong>通知時間：</strong>${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</p>
                        ${changeTableHtml}
                        <hr style="border: none; border-top: 1px solid #dee2e6; margin: 20px 0;"/>
                        <p style="color: #6c757d; font-size: 14px;">💡 請登入管理後台查看完整報名資訊。</p>
                    </div>
                `;

                // Send emails synchronously to ensure they're sent before response
                console.log(`[Notification] 📧 Starting to send emails...`);
                for (const admin of admins) {
                    if (admin.email) {
                        console.log(`[Notification] Sending to: ${admin.email}`);
                        try {
                            const result = await sendEmail(admin.email, subject, html);
                            if (result.success) {
                                console.log(`[Notification] ✅ Successfully sent to ${admin.email}`);
                            } else {
                                console.error(`[Notification] ❌ Failed to send to ${admin.email}:`, result.error);
                            }
                        } catch (err) {
                            console.error(`[Notification] ❌ Exception sending to ${admin.email}:`, err);
                        }
                    }
                }
                console.log(`[Notification] 📧 Email sending completed.`);
            } else {
                console.log(`[Notification] ⚠️ No admins found to notify!`);
            }
        } else {
            console.log(`[Notification] ℹ️ Event registration is still open, no notification needed.`);
        }

        res.json(signup);
    } catch (e) {
        console.error('[Backend] Update Signup Error:', e);
        res.status(400).json({ error: '更新報名失敗' });
    }
});


// --- TASKS ---
app.get('/api/tasks', async (req, res) => {
    try {
        const tasks = await prisma.adminTask.findMany();
        res.json(tasks);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: '無法取得任務列表' });
    }
});

app.post('/api/tasks', async (req, res) => {
    try {
        const task = await prisma.adminTask.create({ data: req.body });
        res.json(task);
    } catch (e) {
        console.error(e);
        res.status(400).json({ error: '報名失敗' });
    }
});

app.put('/api/tasks/:id', async (req, res) => {
    try {
        const task = await prisma.adminTask.update({
            where: { id: req.params.id },
            data: req.body
        });
        res.json(task);
    } catch (e) {
        console.error(e);
        res.status(400).json({ error: '更新任務失敗' });
    }
});

app.delete('/api/tasks/:id', async (req, res) => {
    try {
        await prisma.adminTask.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(400).json({ error: '更新報名失敗' });
    }
});



// --- AUTOMATED JOBS (CRON) ---

// Helper to get formatted date string YYYY-MM-DD in Asia/Taipei timezone
const getDateString = (date: Date) => {
    return date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
};

const startScheduler = () => {
    console.log('📅 Scheduler started...');

    // 1. 餐食報表未下載提醒：活動前 3 天上午 09:00
    cron.schedule('0 9 * * *', async () => {
        console.log('Running job: Meal Report Reminder');
        const today = new Date();
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + 3);
        const targetDateStr = getDateString(targetDate);

        const events = await prisma.ministryEvent.findMany({
            where: {
                startDate: targetDateStr,
                isReportDownloaded: false
            }
        });

        if (events.length > 0) {
            const admins = await prisma.user.findMany({ where: { role: { in: ['core_admin', 'admin'] }, email: { not: null } } });
            const adminEmails = admins.map((a: any) => a.email).filter((e: any) => e);

            for (const event of events) {
                const subject = `【義工訂餐提醒】請下載餐食報表 - ${event.title}`;
                const html = `
                    <div style="font-size: 18px;">
                        <h3>義工訂餐提醒</h3>
                        <p>平安，提醒您以下活動即將在三天後 (${event.startDate}) 開始：</p>
                        <p><strong style="color: darkblue;">${event.title}</strong></p>
                        <p>系統偵測到尚未下載該活動的餐食統計報表。</p>
                        <p>請儘速登入系統下載並提供給訂餐同工。</p>
                    </div>
                `;
                for (const email of adminEmails) {
                    await sendEmail(email, subject, html);
                }
            }
        }
    }, { timezone: 'Asia/Taipei' });

    // 2. 邀請未報名義工：活動前 6 天下午 14:00
    cron.schedule('0 14 * * *', async () => {
        console.log('Running job: Volunteer Invitation');
        const today = new Date();
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + 6);
        const targetDateStr = getDateString(targetDate);

        const events = await prisma.ministryEvent.findMany({
            where: { startDate: targetDateStr }
        });

        if (events.length > 0) {
            const allVolunteers = await prisma.user.findMany({
                where: { isApproved: true, role: 'volunteer', email: { not: null } }
            });

            for (const event of events) {
                const signups = await prisma.signup.findMany({ where: { eventId: event.id } });
                const signedUpUserIds = new Set(signups.map((s: any) => s.volunteerId));
                const targetVolunteers = allVolunteers.filter((v: any) => !signedUpUserIds.has(v.id));

                const subject = `【邀請】下週活動邀請 - ${event.title}`;
                const html = `
                    <div style="font-size: 18px;">
                        <h3>同工平安，邀請您參與服事</h3>
                        <p>下週有即將開始的聚會活動：</p>
                        <p><strong style="color: darkblue;">${event.title}</strong></p>
                        <p>日期：${event.startDate}</p>
                        <p>誠摯邀請您一起來同工！若您時間允許，請登入系統報名。</p>
                    </div>
                `;

                for (const volunteer of targetVolunteers) {
                    if (volunteer.email) await sendEmail(volunteer.email, subject, html);
                }
            }
        }
    }, { timezone: 'Asia/Taipei' });

    // 3. 行前通知：活動前 3 天上午 09:00
    cron.schedule('0 9 * * *', async () => {
        console.log('Running job: Event Reminder');
        const today = new Date();
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + 3);
        const targetDateStr = getDateString(targetDate);

        const events = await prisma.ministryEvent.findMany({
            where: { startDate: targetDateStr }
        });

        for (const event of events) {
            const signups = await prisma.signup.findMany({
                where: { eventId: event.id },
                include: { volunteer: true }
            });

            for (const signup of signups) {
                // @ts-ignore
                if (!signup.volunteer.email) continue;

                const meals = JSON.parse(signup.meals as string || '[]');
                const attendingDays = JSON.parse(signup.attendingDays as string || '[]');
                const mealsText = meals.length > 0 ? meals.join('、') : '無登記餐點';

                const subject = `【行前提醒】本週活動通知 - ${event.title}`;
                // @ts-ignore
                const html = `
                    <div style="font-size: 18px;">
                        <h3>${signup.volunteer.name} 平安</h3>
                        <p>提醒您本週有您報名的活動：</p>
                        <p><strong style="color: darkblue;">${event.title}</strong></p>
                        <p>日期：${event.startDate}</p>
                        <hr/>
                        <p><strong>您的登記資訊：</strong></p>
                        <p>交通方式：${signup.transportMode === 'shuttle' ? '搭乘交通車' : '自行前往'}</p>
                        <p>預計參加天數：${attendingDays.length} 天</p>
                        <p>訂餐資訊：${mealsText}</p>
                        <p>請準時出席，願神祝福您的服事！</p>
                    </div>
                `;
                // @ts-ignore
                await sendEmail(signup.volunteer.email, subject, html);
            }
        }
    }, { timezone: 'Asia/Taipei' });

    // 4. 管理員任務逾期提醒 (每日 10:00 AM)
    cron.schedule('0 10 * * *', async () => {
        console.log('Running job: Task Overdue Reminder');
        const todayStr = getDateString(new Date());

        const overdueTasks = await prisma.adminTask.findMany({
            where: {
                dueDate: {
                    lt: todayStr,
                    not: ''
                },
                isCompleted: false
            }
        });

        if (overdueTasks.length > 0) {
            const admins = await prisma.user.findMany({ where: { role: { in: ['core_admin', 'admin'] }, email: { not: null } } });

            for (const task of overdueTasks) {
                const subject = `【任務逾期】請確認 - ${task.title}`;
                const html = `
                    <h3>管理員任務逾期提醒</h3>
                    <p>以下任務已超過期限且尚未標示完成：</p>
                    <p><strong>${task.title}</strong></p>
                    <p>期限：${task.dueDate}</p>
                    <p>請儘速處理。</p>
                `;
                for (const admin of admins) {
                    if (admin.email) await sendEmail(admin.email, subject, html);
                }
            }
        }
    }, { timezone: 'Asia/Taipei' });

    // 5. 防止休眠 (Anti-Hibernation)：每 14 分鐘 Ping 自己一次
    cron.schedule('*/10 * * * *', async () => {
        try {
            console.log('Self-ping: Keeping server awake...');
            const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
            await fetch(url);
        } catch (e) {
            console.error('Self-ping failed:', e);
        }
    });
};

startScheduler();

// Any request that doesn't match an API route, send back index.html
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

