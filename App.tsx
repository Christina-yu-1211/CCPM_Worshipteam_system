
import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { VolunteerPortal } from './pages/VolunteerPortal';
import { AdminDashboard } from './pages/AdminDashboard';
import { SettingsPage } from './pages/SettingsPage';
import { BadgeModal } from './components/BadgeModal';
import { MinistryEvent, Signup, EventSeries, User, AdminTask, EmailLog } from './types';
import { checkEmailTriggers } from './utils';
import { api } from './api';

// Helper to generate date string relative to today
const getRelativeDate = (diffDays: number) => {
  const date = new Date();
  date.setDate(date.getDate() + diffDays);
  return date.toISOString().split('T')[0];
};

export default function App() {
  // --- STATE ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<'main' | 'settings'>('main');

  const [users, setUsers] = useState<User[]>([]);
  const [events, setEvents] = useState<MinistryEvent[]>([]);
  const [signups, setSignups] = useState<Signup[]>([]);
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [series, setSeries] = useState<EventSeries[]>([]);

  // Email System State
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);

  // Login/Register Form State
  const [viewMode, setViewMode] = useState<'login' | 'register'>('login');
  const [registerRole, setRegisterRole] = useState<'volunteer' | 'admin'>('volunteer'); // Toggle for registration
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [registerName, setRegisterName] = useState(''); // For new admin
  const [registerUserId, setRegisterUserId] = useState(''); // For existing volunteer

  // Gamification
  const [showBadge, setShowBadge] = useState<{ count: number, streak: number } | null>(null);

  // --- DATA LOADING ---
  const loadData = async () => {
    try {
      const [u, e, s, t, se] = await Promise.all([
        api.getUsers(),
        api.getEvents(),
        api.getSignups(),
        api.getTasks(),
        api.getSeries()
      ]);
      setUsers(u);
      setEvents(e);
      setSignups(s);
      setTasks(t);
      setSeries(se);
    } catch (err) {
      console.error("Failed to load data", err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // --- ACTIONS ---

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    // Re-fetch users to ensure latest data
    const latestUsers = await api.getUsers();
    setUsers(latestUsers);

    const user = latestUsers.find(u => u.email === email && u.password === password);
    if (user) {
      if (!user.isApproved) {
        alert('您的帳號尚未經過核心同工核准，請耐心等候或聯繫相關人員。');
        return;
      }
      setCurrentUser(user);
    } else {
      alert('登入失敗：Email 或密碼錯誤，或者您尚未註冊。');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      alert('請填寫 Email 與密碼');
      return;
    }

    if (users.some(u => u.email === email && u.id !== registerUserId)) {
      alert('此 Email 已被使用');
      return;
    }

    try {
      if (registerRole === 'volunteer') {
        if (!registerUserId) {
          alert('請選擇您的名字');
          return;
        }
        // Update existing user
        const targetUser = users.find(u => u.id === registerUserId);
        if (targetUser) {
          const updated = await api.updateUser(targetUser.id, { email, password });
          alert('註冊成功！請使用新密碼登入。');
          setViewMode('login');
          setEmail(''); setPassword('');
          loadData();
        }
      } else {
        if (!registerName) {
          alert('請輸入您的姓名');
          return;
        }

        const newAdmin: Partial<User> = {
          name: registerName,
          email: email,
          password: password,
          role: 'admin',
          title: '同工',
          isApproved: false,
          totalServiceCount: 0,
          consecutiveMonths: 0
        };

        await api.createUser(newAdmin);
        alert('管理員帳號申請已送出！\n\n請等待核心同工核准後即可登入。');
        setViewMode('login');
        setEmail(''); setPassword(''); setRegisterName('');
        loadData();
      }
    } catch (err) {
      alert(`註冊失敗: ${err}`);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setEmail('');
    setPassword('');
    setViewMode('login');
    setCurrentView('main');
  };

  const handleSignup = async (data: Partial<Signup>) => {
    const existing = signups.find(s => s.eventId === data.eventId && s.volunteerId === data.volunteerId);

    try {
      if (existing) {
        await api.updateSignup(existing.id, data);
        alert('報名資料已更新');
      } else {
        const newSignup = {
          eventId: data.eventId!,
          volunteerId: data.volunteerId!,
          submissionDate: new Date().toISOString(),
          // Defaults
          attendingDays: [], meals: [], transportMode: 'self' as const,
          ...data
        };

        await api.createSignup(newSignup);

        // Update User Stats (Simplified)
        if (currentUser) {
          const updatedUser = await api.updateUser(currentUser.id, {
            totalServiceCount: currentUser.totalServiceCount + 1
          });
          setCurrentUser(updatedUser);

          // Check Badges
          if ([3, 5, 7, 10, 15, 20].includes(updatedUser.totalServiceCount)) {
            setShowBadge({ count: updatedUser.totalServiceCount, streak: updatedUser.consecutiveMonths });
          }
        }
      }
      loadData();
    } catch (err) {
      alert('報名失敗');
      console.error(err);
    }
  };

  const handleSeriesAction = async (action: 'add' | 'edit' | 'delete', data: any) => {
    try {
      if (action === 'add') await api.createSeries(data);
      if (action === 'edit') await api.updateSeries(data.id, data);
      if (action === 'delete') await api.deleteSeries(data.id);
      loadData();
    } catch (err) {
      console.error(err);
      alert('操作失敗');
    }
  };

  // EMAIL SIMULATION ACTION (No API change needed as it's just local logic for now, or could make an API)
  const handleTriggerEmailCheck = () => {
    const newLogs = checkEmailTriggers(events, signups, users, tasks);
    const uniqueNewLogs = newLogs.filter(nl => !emailLogs.some(el => el.id === nl.id));
    if (uniqueNewLogs.length > 0) {
      setEmailLogs([...uniqueNewLogs, ...emailLogs]);
      alert(`系統檢查完畢：已發送 ${uniqueNewLogs.length} 封通知信件。`);
    } else {
      alert('系統檢查完畢：今日無須發送任何通知。');
    }
  };

  const handleAdminActions = {
    addEvent: async (evt: Partial<MinistryEvent>) => {
      try {
        const newEvt = {
          seriesId: series.length > 0 ? series[0].id : '',
          startTime: '19:00', location: 'TBD',
          isRegistrationOpen: true, registrationDeadline: getRelativeDate(55),
          isReportDownloaded: false,
          mealsConfig: [],
          ...evt
        };
        await api.createEvent(newEvt);
        loadData();
      } catch (err) { alert('新增活動失敗'); }
    },
    markReportDownloaded: async (eventId: string) => {
      try {
        await api.updateEvent(eventId, { isReportDownloaded: true });
        loadData();
      } catch (err) { console.error(err); }
    },
    deleteEvent: async (id: string) => {
      if (confirm('確定刪除？')) {
        await api.deleteEvent(id);
        loadData();
      }
    },
    addTask: async (task: AdminTask) => {
      await api.createTask(task);
      loadData();
    },
    updateTask: async (task: AdminTask) => {
      await api.updateTask(task.id, task);
      loadData();
    },
    deleteTask: async (id: string) => {
      if (confirm('確定刪除此任務？')) {
        await api.deleteTask(id);
        loadData();
      }
    },
    manageUser: async (action: string, data: any) => {
      try {
        if (action === 'delete') await api.deleteUser(data.id);
        if (action === 'approve') await api.updateUser(data.id, { isApproved: true });
        if (action === 'edit') await api.updateUser(data.id, data);
        if (action === 'change_role') await api.updateUser(data.id, { role: data.newRole });

        if (action === 'add') {
          if (data.name) {
            await api.createUser({
              name: data.name,
              title: data.title || '義工',
              email: data.email || '',
              role: 'volunteer',
              isApproved: true
            });
          }
        }
        if (action === 'reset_password') {
          // In real app, call API to reset
          alert(`已重設 ${data.name} 的密碼。(模擬)`);
        }
        loadData();
      } catch (err) { alert('操作失敗: ' + err); }
    },
    updateUser: async (data: Partial<User>) => {
      if (!data.id) return;
      try {
        const updated = await api.updateUser(data.id, data);
        if (currentUser && currentUser.id === data.id) {
          setCurrentUser(updated);
        }
        loadData();
      } catch (err) { console.error(err); }
    }
  };

  // --- RENDER ---

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans tracking-wider leading-loose">
        <div className="bg-white p-10 rounded-3xl shadow-2xl max-w-lg w-full">
          <div className="text-center mb-10">
            <img src="https://duk.tw/s6FP48.png" alt="Logo" className="w-24 h-24 mx-auto mb-4 object-contain" />
            <h1 className="text-3xl font-bold text-gray-800 tracking-widest">禱告山祭壇服事系統</h1>
            <p className="text-gray-500 text-lg mt-2">{viewMode === 'login' ? '登入以繼續' : '帳號註冊'}</p>
          </div>
          {/* Login/Register Forms */}
          {viewMode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="block text-lg font-bold text-gray-700 mb-2">Email</label>
                <input type="text" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-4 border border-gray-300 rounded-xl bg-gray-50 text-lg focus:ring-2 focus:ring-mint-500 outline-none" placeholder="user@example.com" required />
              </div>
              <div>
                <label className="block text-lg font-bold text-gray-700 mb-2">密碼</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-4 border border-gray-300 rounded-xl bg-gray-50 text-lg focus:ring-2 focus:ring-mint-500 outline-none" placeholder="••••••" />
              </div>
              <button type="submit" className="w-full py-4 bg-mint-500 hover:bg-mint-600 text-white font-bold text-xl rounded-2xl transition shadow-lg shadow-mint-500/30">
                登入
              </button>
              <div className="text-center mt-6">
                <button type="button" onClick={() => { setViewMode('register'); setEmail(''); setPassword(''); }} className="text-mint-600 hover:underline font-bold text-lg">
                  還沒有帳號？立即註冊
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-6">
              {/* ROLE TOGGLE */}
              <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
                <button type="button" onClick={() => setRegisterRole('volunteer')} className={`flex-1 py-2 rounded-lg font-bold transition ${registerRole === 'volunteer' ? 'bg-white text-mint-600 shadow-sm' : 'text-gray-500'}`}>我是義工</button>
                <button type="button" onClick={() => setRegisterRole('admin')} className={`flex-1 py-2 rounded-lg font-bold transition ${registerRole === 'admin' ? 'bg-white text-vibrant-500 shadow-sm' : 'text-gray-500'}`}>我是管理員</button>
              </div>

              {registerRole === 'volunteer' ? (
                <div>
                  <label className="block text-lg font-bold text-gray-700 mb-2">選擇您的名字</label>
                  <p className="text-sm text-gray-400 mb-2">若名單中沒有您的名字，請聯繫管理員建立檔案。</p>
                  <select value={registerUserId} onChange={e => setRegisterUserId(e.target.value)} className="w-full p-4 border border-gray-300 rounded-xl bg-gray-50 text-lg focus:ring-2 focus:ring-mint-500 outline-none">
                    <option value="">-- 請選擇 --</option>
                    {users.filter(u => u.role === 'volunteer' && !u.password).map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-lg font-bold text-gray-700 mb-2">您的姓名</label>
                  <input type="text" value={registerName} onChange={e => setRegisterName(e.target.value)} className="w-full p-4 border border-gray-300 rounded-xl bg-gray-50 text-lg focus:ring-2 focus:ring-vibrant-500 outline-none" placeholder="請輸入姓名" />
                  <p className="text-sm text-orange-500 mt-2 font-bold bg-orange-50 p-2 rounded-lg">注意：管理員帳號需經過審核後才能登入。</p>
                </div>
              )}

              <div>
                <label className="block text-lg font-bold text-gray-700 mb-2">設定 Email</label>
                <input type="text" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-4 border border-gray-300 rounded-xl bg-gray-50 text-lg focus:ring-2 focus:ring-mint-500 outline-none" placeholder="輸入您的常用 Email" required />
              </div>
              <div>
                <label className="block text-lg font-bold text-gray-700 mb-2">設定密碼</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-4 border border-gray-300 rounded-xl bg-gray-50 text-lg focus:ring-2 focus:ring-mint-500 outline-none" placeholder="設定您的登入密碼" required />
              </div>
              <button type="submit" className="w-full py-4 bg-vibrant-500 hover:bg-vibrant-600 text-white font-bold text-xl rounded-2xl transition shadow-lg shadow-vibrant-500/30">
                {registerRole === 'volunteer' ? '完成註冊' : '送出申請'}
              </button>
              <div className="text-center mt-6">
                <button type="button" onClick={() => { setViewMode('login'); setEmail(''); setPassword(''); }} className="text-gray-500 hover:underline text-lg">
                  返回登入
                </button>
              </div>
            </form>
          )}


        </div>
      </div>
    );
  }

  // View Routing Logic
  let PageContent;
  if (currentView === 'settings') {
    PageContent = (
      <SettingsPage
        currentUser={currentUser}
        users={users}
        signups={signups}
        events={events}
        onUpdateUser={handleAdminActions.updateUser}
        onManageUser={handleAdminActions.manageUser}
        onNavigate={setCurrentView}
      />
    );
  } else {
    // Main View
    if (currentUser.role === 'volunteer') {
      PageContent = (
        <VolunteerPortal
          user={currentUser}
          users={users}
          events={events}
          series={series}
          signups={signups}
          onSignup={handleSignup}
          onUpdateUser={(data) => handleAdminActions.updateUser({ ...data, id: currentUser.id })}
        />
      );
    } else {
      PageContent = (
        <AdminDashboard
          currentUser={currentUser}
          events={events} // Should filter or paginate in real app
          series={series}
          signups={signups}
          users={users}
          tasks={tasks}
          emailLogs={emailLogs}
          onAddEvent={handleAdminActions.addEvent}
          onMarkReportDownloaded={handleAdminActions.markReportDownloaded}
          onDeleteEvent={handleAdminActions.deleteEvent}
          onAddTask={handleAdminActions.addTask}
          onUpdateTask={handleAdminActions.updateTask}
          onDeleteTask={handleAdminActions.deleteTask}
          onManageUser={handleAdminActions.manageUser}
          onSeriesAction={handleSeriesAction}
          onTriggerEmailCheck={handleTriggerEmailCheck}
        />
      );
    }
  }

  return (
    <Layout
      currentUser={{ name: currentUser.name, role: currentUser.role }}
      onSwitchUser={handleLogout}
      activeView={currentView}
      onNavigate={setCurrentView}
    >
      {/* Badge Popup */}
      {showBadge && <BadgeModal count={showBadge.count} streak={showBadge.streak} onClose={() => setShowBadge(null)} />}

      {PageContent}
    </Layout>
  );
}