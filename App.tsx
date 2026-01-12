
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
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('currentUser');
    return saved ? JSON.parse(saved) : null;
  });
  const [currentView, setCurrentView] = useState<'main' | 'settings'>('main');
  const [refreshing, setRefreshing] = useState(false);
  const [touchStartY, setTouchStartY] = useState(0);

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

  // 換頁籤時自動刷新
  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentView]);

  // --- PWA PULL TO REFRESH ---
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touchY = e.touches[0].clientY;
    const pullDistance = touchY - touchStartY;

    // 如果在頁面頂部且向下拉，顯示刷新提示
    if (window.scrollY === 0 && pullDistance > 100 && !refreshing) {
      handleRefresh();
    }
  };

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await loadData();
    setTimeout(() => setRefreshing(false), 500); // 短暫延遲讓用戶看到刷新動畫
  };

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
      localStorage.setItem('currentUser', JSON.stringify(user));
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
    localStorage.removeItem('currentUser');
    setEmail('');
    setPassword('');
    setViewMode('login');
    setCurrentView('main');
  };

  const handleSignup = async (data: Partial<Signup>) => {
    const existing = signups.find(s => s.eventId === data.eventId && s.volunteerId === data.volunteerId);

    try {
      if (existing) {
        // Optimistic Update
        setSignups(prev => prev.map(s => s.id === existing.id ? { ...s, ...data } : s));
        await api.updateSignup(existing.id, data);
      } else {
        const tempId = 'temp-' + Date.now();
        const newSignup = {
          id: tempId,
          eventId: data.eventId!,
          volunteerId: data.volunteerId!,
          submissionDate: new Date().toISOString(),
          attendingDays: [], meals: [], transportMode: 'self' as const,
          ...data
        } as Signup;

        // Optimistic Update
        setSignups(prev => [...prev, newSignup]);

        const created = await api.createSignup(newSignup);
        // Replace temp signup
        setSignups(prev => prev.map(s => s.id === tempId ? created : s));

        // Update User Stats Optimistically with RECALCULATION
        if (currentUser) {
          // Calculate count logic: All signups for this user where the event still exists
          // We include the newSignup here manually because 'signups' state in this closure doesn't have it yet
          const allUserSignups = [...signups, newSignup].filter(s => s.volunteerId === currentUser.id);
          const validSignups = allUserSignups.filter(s => events.some(e => e.id === s.eventId));
          const newTotalCount = validSignups.length;

          const updatedUser = { ...currentUser, totalServiceCount: newTotalCount };
          setCurrentUser(updatedUser);
          setUsers(prev => prev.map(u => u.id === currentUser.id ? updatedUser : u));

          await api.updateUser(currentUser.id, { totalServiceCount: newTotalCount });

          // Trigger Badge based on the ACCURATE count
          if ([3, 5, 7, 10, 15, 20].includes(newTotalCount)) {
            setShowBadge({ count: newTotalCount, streak: updatedUser.consecutiveMonths });
          }
        }
      }
      // Silently refresh in background
      loadData();
    } catch (err) {
      alert('報名或更新失敗: ' + err);
      loadData(); // Revert on actual error
    }
  };

  const handleSeriesAction = async (action: 'add' | 'edit' | 'delete', data: any) => {
    const oldSeries = [...series];
    try {
      if (action === 'add') {
        const tempId = 'temp-' + Date.now();
        const newSeries = { ...data, id: tempId };
        setSeries(prev => [...prev, newSeries]);
        const created = await api.createSeries(data);
        setSeries(prev => prev.map(s => s.id === tempId ? created : s));
      } else if (action === 'edit') {
        setSeries(prev => prev.map(s => s.id === data.id ? { ...s, ...data } : s));
        await api.updateSeries(data.id, data);
      } else if (action === 'delete') {
        setSeries(prev => prev.filter(s => s.id !== data.id));
        await api.deleteSeries(data.id);
      }
      loadData();
    } catch (err) {
      setSeries(oldSeries);
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
      const tempId = 'temp-' + Date.now();
      const newEvt = {
        id: tempId,
        seriesId: series.length > 0 ? series[0].id : '',
        startTime: '19:00', location: 'TBD',
        isRegistrationOpen: true, registrationDeadline: getRelativeDate(55),
        isReportDownloaded: false,
        mealsConfig: [],
        ...evt
      } as MinistryEvent;

      setEvents(prev => [...prev, newEvt]);

      try {
        const created = await api.createEvent(newEvt);
        setEvents(prev => prev.map(e => e.id === tempId ? created : e));
        loadData();
      } catch (err) {
        setEvents(prev => prev.filter(e => e.id !== tempId));
        alert('新增活動失敗');
      }
    },
    updateEvent: async (evt: MinistryEvent) => {
      // Optimistic Update
      const oldEvents = [...events];
      setEvents(prev => prev.map(e => e.id === evt.id ? evt : e));
      try {
        await api.updateEvent(evt.id, evt);
        loadData();
      } catch (err) {
        setEvents(oldEvents);
        alert('更新活動失敗');
      }
    },
    markReportDownloaded: async (eventId: string) => {
      // Optimistic Update
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, isReportDownloaded: true } : e));
      try {
        await api.updateEvent(eventId, { isReportDownloaded: true });
        loadData();
      } catch (err) { console.error(err); loadData(); }
    },
    deleteEvent: async (id: string) => {
      if (confirm('確定刪除？')) {
        const oldEvents = [...events];
        const oldSignups = [...signups];

        // Optimistic Update: Remove event and its associated signups
        setEvents(prev => prev.filter(e => e.id !== id));
        setSignups(prev => prev.filter(s => s.eventId !== id));

        try {
          await api.deleteEvent(id);
          loadData();
        } catch (err) {
          setEvents(oldEvents);
          setSignups(oldSignups);
          alert('刪除失敗');
        }
      }
    },
    addTask: async (task: AdminTask) => {
      // Optimistic Update
      const tempId = Date.now().toString();
      const newTask = { ...task, id: tempId };
      setTasks(prev => [newTask, ...prev]);

      try {
        const created = await api.createTask(task);
        // Replace temp task with real one from server
        setTasks(prev => prev.map(t => t.id === tempId ? created : t));
      } catch (err) {
        // Rollback on failure
        setTasks(prev => prev.filter(t => t.id !== tempId));
        alert('新增任務失敗');
      }
    },
    updateTask: async (task: AdminTask) => {
      // Optimistic Update
      const oldTasks = [...tasks];
      setTasks(prev => prev.map(t => t.id === task.id ? task : t));

      try {
        await api.updateTask(task.id, task);
        // No need to reload all data
      } catch (err) {
        // Rollback
        setTasks(oldTasks);
        console.error('Update task failed', err);
      }
    },
    deleteTask: async (id: string) => {
      if (confirm('確定刪除此任務？')) {
        const oldTasks = [...tasks];
        // Optimistic Update
        setTasks(prev => prev.filter(t => t.id !== id));

        try {
          await api.deleteTask(id);
        } catch (err) {
          // Rollback
          setTasks(oldTasks);
          alert('刪除失敗');
        }
      }
    },
    manageUser: async (action: string, data: any) => {
      const oldUsers = [...users];
      let oldSignups: Signup[] = []; // Declare oldSignups here

      try {
        if (action === 'delete') {
          oldSignups = [...signups]; // Assign here
          setUsers(prev => prev.filter(u => u.id !== data.id));
          setSignups(prev => prev.filter(s => s.volunteerId !== data.id));
          await api.deleteUser(data.id);
        } else if (action === 'approve') {
          setUsers(prev => prev.map(u => u.id === data.id ? { ...u, isApproved: true } : u));
          await api.updateUser(data.id, { isApproved: true });
        } else if (action === 'edit') {
          setUsers(prev => prev.map(u => u.id === data.id ? { ...u, ...data } : u));
          await api.updateUser(data.id, data);
        } else if (action === 'change_role') {
          setUsers(prev => prev.map(u => u.id === data.id ? { ...u, role: data.newRole } : u));
          await api.updateUser(data.id, { role: data.newRole });
        } else if (action === 'add' && data.name) {
          const tempId = 'temp-' + Date.now();
          const newUser = {
            id: tempId,
            name: data.name,
            title: data.title || '義工',
            email: data.email || '',
            role: 'volunteer',
            isApproved: true,
            totalServiceCount: 0,
            consecutiveMonths: 0
          } as User;
          setUsers(prev => [...prev, newUser]);
          const created = await api.createUser(newUser);
          setUsers(prev => prev.map(u => u.id === tempId ? created : u));
        }

        if (action === 'reset_password') {
          alert(`已重設 ${data.name} 的密碼。(模擬)`);
        }
        loadData();
      } catch (err) {
        setUsers(oldUsers);
        if (oldSignups.length > 0) setSignups(oldSignups);
        alert('操作失敗: ' + err);
      }
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
            <h1 className="text-3xl font-bold text-gray-800 tracking-widest">
              禱告山祭壇<br className="sm:hidden" />服事系統
            </h1>
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
          onUpdateEvent={handleAdminActions.updateEvent}
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
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      className="h-full"
    >
      {/* Pull-to-refresh indicator */}
      {refreshing && (
        <div className="fixed top-0 left-0 right-0 bg-mint-500 text-white text-center py-2 z-50 animate-fade-in">
          <div className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            刷新中...
          </div>
        </div>
      )}

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
    </div>
  );
}