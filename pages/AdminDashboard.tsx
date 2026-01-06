
import React, { useState, useEffect } from 'react';
import { MinistryEvent, Signup, EventSeries, User, AdminTask, EmailLog } from '../types';
import { calculateShuttleGroups, generateDriverListText, generateCSV, getCurrentSeasonRange, isDateInRange, getDatesInRange, formatDateShort, isEventPast } from '../utils';
import { Users, Bus, Utensils, Calendar, PlusCircle, Trash2, Download, UserPlus, CheckSquare, FileText, ChevronDown, ChevronUp, BarChart2, TrendingUp, X, Edit, AlertTriangle, Palette, CheckCircle, Archive, Key } from 'lucide-react';
import ExcelJS from 'exceljs';

interface AdminDashboardProps {
  currentUser: User;
  events: MinistryEvent[];
  signups: Signup[];
  series: EventSeries[];
  users: User[];
  tasks: AdminTask[];
  emailLogs?: EmailLog[];
  onAddEvent: (evt: any) => Promise<void>;
  onMarkReportDownloaded?: (eventId: string) => void;
  onUpdateEvent: (evt: any) => Promise<void>;
  onDeleteEvent: (id: string) => Promise<void>;
  onUpdateTask: (task: AdminTask) => void;
  onAddTask: (task: AdminTask) => void;
  onDeleteTask?: (id: string) => void;
  onManageUser: (action: 'approve' | 'delete' | 'reset_password' | 'add' | 'edit', data: any) => void;
  onSeriesAction?: (action: 'add' | 'edit' | 'delete', data: any) => void;
  onTriggerEmailCheck?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser, events, signups, series, users, tasks,
  onAddEvent, onUpdateEvent, onDeleteEvent, onUpdateTask, onAddTask, onDeleteTask, onManageUser, onSeriesAction, onTriggerEmailCheck
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'events' | 'users' | 'tasks' | 'reports'>('overview');

  // Expanded State
  const [expandedEventIds, setExpandedEventIds] = useState<string[]>([]);
  const [driverAssignments, setDriverAssignments] = useState<Record<string, string>>({});

  // Events View State
  const [showArchivedEvents, setShowArchivedEvents] = useState(false);

  // Stats Filter
  const defaultSeason = getCurrentSeasonRange();
  const [statsStart, setStatsStart] = useState(defaultSeason.start);
  const [statsEnd, setStatsEnd] = useState(defaultSeason.end);

  // --- MODAL STATES ---
  const [showEventModal, setShowEventModal] = useState(false);
  const [showVolunteerModal, setShowVolunteerModal] = useState(false);
  const [showSeriesModal, setShowSeriesModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ type: 'event' | 'series' | 'user', id: string, name: string } | null>(null);

  // PASSWORD MODAL STATE
  const [showPasswordModal, setShowPasswordModal] = useState<{ name: string, password: string } | null>(null);

  // HISTORY MODAL STATE (For Top Volunteers)
  const [showHistoryModalUser, setShowHistoryModalUser] = useState<User | null>(null);

  // --- FORM DATA ---

  // Event Form (Add/Edit)
  const defaultEventState = {
    id: '',
    title: '',
    seriesId: 's1',
    startDate: '',
    endDate: '',
    startTime: '19:00',
    location: 'TBD',
    mealsConfig: [] as { date: string, breakfast: boolean, lunch: boolean, dinner: boolean }[],
    remarks: '',
    isRegistrationOpen: true,
    registrationDeadline: ''
  };
  const [eventForm, setEventForm] = useState(defaultEventState);
  const [isEditingEvent, setIsEditingEvent] = useState(false);

  // Volunteer Form
  const [volunteerForm, setVolunteerForm] = useState({ name: '', title: '' }); // title is now Remarks

  // User Edit State
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUserFormData, setEditUserFormData] = useState({ name: '', title: '', email: '' });

  // Series Form
  const [seriesForm, setSeriesForm] = useState<Partial<EventSeries>>({ name: '', color: '#10B981' });
  const [isEditingSeries, setIsEditingSeries] = useState(false);


  // Helpers
  const volunteerMap = Object.fromEntries(users.map(u => [u.id, u]));

  // Derived Event Lists
  const activeEvents = events.filter(e => !isEventPast(e.endDate));
  const archivedEvents = events.filter(e => isEventPast(e.endDate));
  const displayedEvents = activeTab === 'overview' ? activeEvents : (showArchivedEvents ? archivedEvents : activeEvents);

  const toggleEventExpand = (id: string) => {
    setExpandedEventIds(prev =>
      prev.includes(id) ? prev.filter(eid => eid !== id) : [...prev, id]
    );
  };

  // --- EVENT LOGIC ---

  // When dates change, regenerate meal config
  useEffect(() => {
    if (eventForm.startDate && eventForm.endDate) {
      const dates = getDatesInRange(eventForm.startDate, eventForm.endDate);
      setEventForm(prev => {
        // Keep existing configs if date matches
        const newConfig = dates.map(d => {
          const existing = prev.mealsConfig.find(m => m.date === d);
          return existing || { date: d, breakfast: false, lunch: false, dinner: false };
        });
        return { ...prev, mealsConfig: newConfig };
      });
    }
  }, [eventForm.startDate, eventForm.endDate]);

  const openAddEvent = () => {
    setEventForm({ ...defaultEventState, seriesId: series[0]?.id || '' });
    setIsEditingEvent(false);
    setShowEventModal(true);
  };

  const openEditEvent = (evt: MinistryEvent) => {
    // Backfill breakfast if missing from old data
    const fixedMeals = (evt.mealsConfig || []).map(m => ({
      breakfast: false,
      ...m
    }));

    setEventForm({
      ...evt,
      mealsConfig: fixedMeals,
      remarks: evt.remarks || ''
    });
    setIsEditingEvent(true);
    setShowEventModal(true);
  };

  const handleEventSubmit = () => {
    if (!eventForm.title || !eventForm.startDate || !eventForm.endDate) return alert('請填寫完整資訊');

    const payload: any = { ...eventForm };
    if (isEditingEvent) {
      onUpdateEvent(payload);
    } else {
      delete payload.id;
      onAddEvent(payload);
    }

    setShowEventModal(false);
  };

  const handleDeleteRequest = (type: 'event' | 'series' | 'user', id: string, name: string) => {
    setShowDeleteConfirm({ type, id, name });
  };

  const confirmDelete = () => {
    if (!showDeleteConfirm) return;
    if (showDeleteConfirm.type === 'event') {
      onDeleteEvent(showDeleteConfirm.id);
    } else if (showDeleteConfirm.type === 'series' && onSeriesAction) {
      onSeriesAction('delete', { id: showDeleteConfirm.id });
    } else if (showDeleteConfirm.type === 'user') {
      onManageUser('delete', { id: showDeleteConfirm.id });
    }
    setShowDeleteConfirm(null);
  };

  // --- HANDLERS FOR REPORTS & DRIVERS ---
  const handleExportMeals = async (evt: MinistryEvent, eventSignups: Signup[]) => {
    if (eventSignups.length === 0) return alert('無資料可匯出');

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('餐食統計');

    // Define Columns
    const cols = [
      { header: '姓名', key: 'name', width: 20 },
    ];
    const mealKeys: { date: string, type: 'breakfast' | 'lunch' | 'dinner', key: string }[] = [];

    evt.mealsConfig.forEach(m => {
      if (m.breakfast) {
        const key = `${m.date}_b`;
        cols.push({ header: `${formatDateShort(m.date)} 早餐`, key: key, width: 15 });
        mealKeys.push({ date: m.date, type: 'breakfast', key });
      }
      if (m.lunch) {
        const key = `${m.date}_l`;
        cols.push({ header: `${formatDateShort(m.date)} 午餐`, key: key, width: 15 });
        mealKeys.push({ date: m.date, type: 'lunch', key });
      }
      if (m.dinner) {
        const key = `${m.date}_d`;
        cols.push({ header: `${formatDateShort(m.date)} 晚餐`, key: key, width: 15 });
        mealKeys.push({ date: m.date, type: 'dinner', key });
      }
    });

    sheet.columns = cols;

    // Filter Data
    const mealSignups = eventSignups.filter(s => s.meals && s.meals.length > 0);
    if (mealSignups.length === 0) return alert('無人登記餐食');

    // Add Data Rows
    const columnTotals: Record<string, number> = {};
    mealKeys.forEach(mk => columnTotals[mk.key] = 0);

    mealSignups.forEach(s => {
      const volunteerName = volunteerMap[s.volunteerId]?.name || 'Unknown';
      const rowData: Record<string, any> = { name: volunteerName };

      mealKeys.forEach((mk) => {
        const hasMeal = s.meals.some(m => m.date === mk.date && m.type === mk.type);
        if (hasMeal) {
          rowData[mk.key] = "1";
          columnTotals[mk.key]++;
        } else {
          rowData[mk.key] = "";
        }
      });
      sheet.addRow(rowData);
    });

    // Add Total Row
    const totalRowData: Record<string, any> = { name: '總計' };
    mealKeys.forEach(mk => totalRowData[mk.key] = columnTotals[mk.key]);
    const totalRow = sheet.addRow(totalRowData);
    totalRow.font = { name: 'Microsoft JhengHei', size: 12, bold: true };

    // Set Font Style for All Cells
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.font = { name: 'Microsoft JhengHei', size: 12 };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });
      // Fix name alignment
      const nameCell = row.getCell(1);
      if (nameCell) nameCell.alignment = { vertical: 'middle', horizontal: 'left' };
    });

    // Header Style
    const headerRow = sheet.getRow(1);
    headerRow.font = { name: 'Microsoft JhengHei', size: 12, bold: true };

    // Export
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = `${evt.title}_餐食統計.xlsx`;
    link.click();
  };

  const handleCopyDriverList = (eventSignups: Signup[]) => {
    const text = generateDriverListText(eventSignups, volunteerMap, driverAssignments);
    navigator.clipboard.writeText(text).then(() => alert('已複製到剪貼簿！'));
  };

  const handleDriverAssign = (groupId: string, driverId: string) => {
    setDriverAssignments(prev => ({ ...prev, [groupId]: driverId }));
  };

  const handleViewPassword = (user: User) => {
    setShowPasswordModal({
      name: user.name,
      password: user.password || '尚未註冊密碼'
    });
  };

  // --- USER EDITING LOGIC ---
  const startEditUser = (user: User) => {
    setEditingUserId(user.id);
    setEditUserFormData({ name: user.name, title: user.title || '', email: user.email });
  };

  const cancelEditUser = () => {
    setEditingUserId(null);
  };

  const saveEditUser = (userId: string) => {
    onManageUser('edit', { id: userId, ...editUserFormData });
    setEditingUserId(null);
  };

  // --- SERIES LOGIC ---
  const openSeriesModal = (s?: EventSeries) => {
    if (s) {
      setSeriesForm(s);
      setIsEditingSeries(true);
    } else {
      setSeriesForm({ name: '', color: '#10B981' });
      setIsEditingSeries(false);
    }
    setShowSeriesModal(true);
  };

  const handleSeriesSubmit = () => {
    if (!seriesForm.name) return alert('請輸入系列名稱');
    if (onSeriesAction) {
      onSeriesAction(isEditingSeries ? 'edit' : 'add', seriesForm);
    }
    setShowSeriesModal(false);
  };

  // --- VOLUNTEER LOGIC ---
  const handleVolunteerSubmit = () => {
    if (!volunteerForm.name) return alert('請輸入姓名');
    onManageUser('add', volunteerForm);
    setShowVolunteerModal(false);
    setVolunteerForm({ name: '', title: '' });
  };

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-6 pb-32 relative">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-800 tracking-widest">管理員儀表板</h1>
          <p className="text-gray-500 text-lg mt-2">
            {currentUser.name} ({currentUser.role === 'core_admin' ? '核心同工' : '一般同工'})
          </p>
        </div>
        <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 flex overflow-x-auto no-scrollbar">
          {[
            { id: 'overview', icon: Users, label: '總覽' },
            { id: 'reports', icon: BarChart2, label: '報表' },
            { id: 'events', icon: Calendar, label: '活動管理' },
            { id: 'users', icon: UserPlus, label: '義工' },
            { id: 'tasks', icon: CheckSquare, label: '任務' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'overview' | 'events' | 'users' | 'tasks' | 'reports')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-base font-bold transition whitespace-nowrap ${activeTab === tab.id
                ? 'bg-mint-300 text-mint-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
                }`}
            >
              <tab.icon size={18} /> {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* --- OVERVIEW TAB --- */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {displayedEvents.length === 0 && <div className="text-center text-gray-400 text-xl py-10">目前沒有進行中的活動</div>}

          {displayedEvents.map(evt => {
            const evtSignups = signups.filter(s => s.eventId === evt.id);
            const isExpanded = expandedEventIds.includes(evt.id);
            const s = series.find(ser => ser.id === evt.seriesId);
            const shuttleGroups = calculateShuttleGroups(evtSignups, volunteerMap);
            const uniqueDays = Array.from(new Set(evtSignups.flatMap(signup => signup.attendingDays))).sort();

            return (
              <div key={evt.id} className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300">
                {/* Card Header */}
                <div
                  onClick={() => toggleEventExpand(evt.id)}
                  className="p-6 cursor-pointer hover:bg-gray-50 flex justify-between items-center"
                >
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      {/* Desaturated Badge */}
                      <span
                        className="text-xs font-extrabold uppercase tracking-widest px-2 py-1 rounded text-white shadow-sm"
                        style={{ backgroundColor: s?.color || '#999', filter: 'saturate(0.9) brightness(1.05)' }}
                      >
                        {s?.name}
                      </span>
                      {/* NO YEAR HERE */}
                      <span className="text-base text-gray-500 font-medium tracking-wider">{formatDateShort(evt.startDate)} ~ {formatDateShort(evt.endDate)}</span>
                    </div>
                    <h2 className="text-2xl font-extrabold text-gray-800 tracking-wide flex items-center gap-3">
                      {evt.title}
                      {!evt.isRegistrationOpen && <span className="text-xs bg-red-100 text-red-500 px-2 py-1 rounded-full">報名截止</span>}
                    </h2>
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <div className="text-4xl font-black text-mint-600">{evtSignups.length}</div>
                      <div className="text-xs font-bold text-gray-400 mt-1">總報名人數</div>
                    </div>
                    {isExpanded ? <ChevronUp size={28} className="text-gray-400" /> : <ChevronDown size={28} className="text-gray-400" />}
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50/50 p-4 md:p-8 grid grid-cols-1 lg:grid-cols-2 gap-10 animate-fade-in">
                    {/* Left Col */}
                    <div className="space-y-8">
                      {/* Attendance List */}
                      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                        <h3 className="text-xl font-extrabold text-gray-700 mb-4 flex items-center gap-3">
                          <Users size={24} className="text-blue-500" /> 出席名單
                        </h3>
                        <div className="space-y-4">
                          {uniqueDays.map(day => {
                            const people = evtSignups.filter(si => si.attendingDays.includes(day)).map(si => volunteerMap[si.volunteerId]?.name);
                            return (
                              <div key={day} className="text-base">
                                <div className="flex justify-between font-bold text-gray-700 mb-2 border-b border-gray-100 pb-1">
                                  <span>{formatDateShort(day)}</span>
                                  <span className="text-blue-600">{people.length} 人</span>
                                </div>
                                <div className="text-gray-500 leading-relaxed tracking-wide">{people.join('、 ')}</div>
                              </div>
                            )
                          })}
                          {uniqueDays.length === 0 && <p className="text-gray-400 italic">尚無資料</p>}
                        </div>
                      </div>

                      {/* Meal Stats (COMPACT) */}
                      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-xl font-extrabold text-gray-700 flex items-center gap-3">
                            <Utensils size={24} className="text-vibrant-500" /> 餐食統計
                          </h3>
                          <button onClick={() => handleExportMeals(evt, evtSignups)} className="text-sm bg-white border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 flex items-center gap-2 font-bold text-gray-600 transition">
                            <Download size={16} /> 匯出報表 (Excel)
                          </button>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-center text-base">
                            <thead>
                              <tr className="bg-gray-50 text-gray-500 border-b border-gray-200">
                                <th className="py-2 px-1 font-extrabold text-left text-sm">日</th>
                                <th className="py-2 px-1 font-extrabold text-center text-sm">早</th>
                                <th className="py-2 px-1 font-extrabold text-center text-sm">午</th>
                                <th className="py-2 px-1 font-extrabold text-center text-sm">晚</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {evt.mealsConfig.map((m, idx) => {
                                if (!m.breakfast && !m.lunch && !m.dinner) return null;
                                const b = evtSignups.filter(s => s.meals.some(x => x.date === m.date && x.type === 'breakfast')).length;
                                const l = evtSignups.filter(s => s.meals.some(x => x.date === m.date && x.type === 'lunch')).length;
                                const d = evtSignups.filter(s => s.meals.some(x => x.date === m.date && x.type === 'dinner')).length;
                                return (
                                  <tr key={idx} className="text-gray-700 hover:bg-gray-50">
                                    <td className="py-2 px-1 font-bold text-left whitespace-nowrap">{formatDateShort(m.date)}</td>
                                    <td className="py-2 px-1">
                                      {m.breakfast ? <span className="text-vibrant-600 font-black text-lg">{b}</span> : <span className="text-gray-300">-</span>}
                                    </td>
                                    <td className="py-2 px-1">
                                      {m.lunch ? <span className="text-vibrant-600 font-black text-lg">{l}</span> : <span className="text-gray-300">-</span>}
                                    </td>
                                    <td className="py-2 px-1">
                                      {m.dinner ? <span className="text-vibrant-600 font-black text-lg">{d}</span> : <span className="text-gray-300">-</span>}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    {/* Right Col: Shuttle Stats */}
                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-extrabold text-gray-700 flex items-center gap-3">
                          <Bus size={24} className="text-mint-600" /> 接駁統計
                        </h3>
                        <button onClick={() => handleCopyDriverList(evtSignups)} className="text-sm bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 font-bold tracking-wide shadow-md shadow-green-200 flex items-center gap-2 transition">
                          <FileText size={16} /> 複製給司機
                        </button>
                      </div>

                      <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        {shuttleGroups.length === 0 && <p className="text-gray-400 italic text-center py-10">無接駁需求</p>}
                        {shuttleGroups.map((group) => (
                          <div key={group.id} className={`border-2 rounded-2xl p-5 ${group.type === 'arrival' ? 'bg-blue-50/30 border-blue-100' : 'bg-orange-50/30 border-orange-100'} hover:shadow-md transition`}>
                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <span className={`text-sm font-black px-3 py-1 rounded-full ${group.type === 'arrival' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                                  {group.type === 'arrival' ? '去程' : '回程'}
                                </span>
                                <span className="ml-3 font-extrabold text-xl text-gray-800">{group.location}</span>
                              </div>
                              <div className="text-right">
                                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">建議發車</div>
                                <div className="font-black text-2xl text-gray-700">{group.suggestedDeparture}</div>
                              </div>
                            </div>

                            {/* Passengers (No Phone) */}
                            <div className="space-y-3 mb-5">
                              {group.passengers.map((p, i) => (
                                <div key={i} className="text-base flex justify-between text-gray-700 border-b border-gray-100/50 pb-1 last:border-0">
                                  <span className="font-medium">{p.name}</span>
                                  <span className="font-bold font-mono">{p.time}</span>
                                </div>
                              ))}
                            </div>

                            {/* Driver Assignment */}
                            <div className="mt-4 border-t-2 border-gray-100 pt-3">
                              <label className="text-sm font-extrabold text-gray-500 block mb-2 tracking-wide">指派司機</label>
                              <select
                                className="w-full text-base p-3 border-2 border-gray-200 rounded-xl bg-white focus:border-mint-500 focus:ring-0 outline-none transition"
                                value={driverAssignments[group.id] || ''}
                                onChange={(e) => handleDriverAssign(group.id, e.target.value)}
                              >
                                <option value="">-- 請選擇 --</option>
                                {users.map(u => (
                                  <option key={u.id} value={u.id}>{u.name} ({u.role === 'volunteer' ? '義工' : '同工'})</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* --- TASKS TAB --- */}
      {activeTab === 'tasks' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white rounded-3xl shadow-sm p-8 border border-gray-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-extrabold text-gray-800">待辦事項</h3>
              <button
                onClick={() => onAddTask({ id: Date.now().toString(), title: '新任務', dueDate: '', isCompleted: false, isArchived: false })}
                className="text-mint-600 hover:bg-mint-50 p-2 rounded-full transition"
              >
                <PlusCircle size={32} />
              </button>
            </div>
            <ul className="space-y-4">
              {tasks.filter(t => !t.isCompleted && !t.isArchived).map(task => (
                <li key={task.id} className="flex flex-col gap-3 p-4 hover:bg-gray-50 rounded-2xl border border-transparent hover:border-gray-100 transition group">
                  <div className="flex items-center gap-3 w-full">
                    <button onClick={() => onUpdateTask({ ...task, isCompleted: true })} className="text-gray-300 hover:text-green-500 transition shrink-0">
                      <div className="w-6 h-6 border-2 border-gray-300 rounded-lg hover:border-green-500"></div>
                    </button>
                    <input
                      defaultValue={task.title}
                      onBlur={(e) => onUpdateTask({ ...task, title: e.target.value })}
                      className="flex-1 bg-transparent border-none outline-none text-xl text-gray-700 font-bold min-w-0"
                    />
                    <button
                      onClick={() => onDeleteTask?.(task.id)}
                      className="text-gray-300 hover:text-red-500 p-2 transition shrink-0 bg-transparent hover:bg-red-50 rounded-lg"
                      title="刪除任務"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 pl-9">
                    <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-xl border border-gray-200 focus-within:ring-2 focus-within:ring-mint-300 transition-all w-full max-w-[180px]">
                      <Calendar size={14} className="text-gray-400 shrink-0" />
                      <input
                        type="date"
                        value={task.dueDate}
                        onChange={(e) => onUpdateTask({ ...task, dueDate: e.target.value })}
                        className="text-sm font-bold text-gray-700 bg-transparent border-none outline-none w-full"
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-white rounded-3xl shadow-sm p-8 border border-gray-200 opacity-70">
            <h3 className="text-2xl font-extrabold text-gray-500 mb-6">已完成 / 封存</h3>
            <ul className="space-y-4">
              {tasks.filter(t => t.isCompleted || t.isArchived).map(task => (
                <li key={task.id} className="flex items-center gap-4 p-3 text-gray-400">
                  <button onClick={() => onUpdateTask({ ...task, isCompleted: false })} className="hover:text-green-500 transition" title="標示為未完成">
                    <CheckCircle size={24} className="text-green-500" />
                  </button>
                  <span className="text-lg line-through flex-1">{task.title}</span>
                  <button
                    onClick={() => onDeleteTask?.(task.id)}
                    className="text-gray-300 hover:text-red-500 p-2 transition shrink-0"
                    title="刪除任務"
                  >
                    <Trash2 size={18} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* --- REPORTS TAB (Restored) --- */}
      {activeTab === 'reports' && (
        <div className="space-y-8 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition">
              <div className="p-4 bg-mint-100 text-mint-600 rounded-full"><Users size={32} /></div>
              <div>
                <div className="text-gray-400 font-bold uppercase tracking-wider text-sm">總義工數</div>
                <div className="text-4xl font-black text-gray-800">{users.filter(u => u.role === 'volunteer').length}</div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition">
              <div className="p-4 bg-vibrant-100 text-vibrant-600 rounded-full"><CheckCircle size={32} /></div>
              <div>
                {/* CHANGED METRIC */}
                <div className="text-gray-400 font-bold uppercase tracking-wider text-sm">本月活動數</div>
                <div className="text-4xl font-black text-gray-800">
                  {events.filter(e => e.startDate.startsWith(new Date().toISOString().slice(0, 7))).length}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Top Volunteers (UPDATED TO BE CLICKABLE) */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200">
              <h3 className="text-2xl font-extrabold text-gray-800 mb-6 flex items-center gap-2">
                <TrendingUp className="text-red-500" /> 年度服事排行榜
              </h3>
              {/* SCROLLABLE CONTAINER */}
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {users.filter(u => u.role === 'volunteer').map(u => {
                  const count = signups.filter(s => s.volunteerId === u.id).length;
                  return { ...u, dynamicCount: count };
                }).sort((a, b) => b.dynamicCount - a.dynamicCount).slice(0, 10).map((u, idx) => (
                  <div
                    key={u.id}
                    onClick={() => setShowHistoryModalUser(u)}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-white ${idx === 0 ? 'bg-yellow-400' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-orange-400' : 'bg-mint-200 text-mint-700'}`}>
                        {idx + 1}
                      </div>
                      <span className="font-bold text-lg text-gray-700 group-hover:text-vibrant-600 transition">{u.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xl text-gray-800">{u.dynamicCount} <span className="text-xs text-gray-400">次</span></span>
                      <span className="text-gray-300 text-sm group-hover:text-vibrant-500">→</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Series Stats with Range Filter */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h3 className="text-2xl font-extrabold text-gray-800 flex items-center gap-2">
                  <BarChart2 className="text-blue-500" /> 各系列活動熱度
                </h3>
                <div className="flex flex-wrap items-center gap-2 bg-gray-50 p-2 rounded-xl">
                  <div className="relative flex items-center bg-white border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-mint-300 transition-all flex-1 min-w-[140px]">
                    <Calendar size={12} className="ml-2 text-gray-400" />
                    <input type="date" value={statsStart} onChange={e => setStatsStart(e.target.value)} className="bg-transparent border-none outline-none px-2 py-2 text-xs sm:text-sm font-bold text-gray-600 w-full" />
                  </div>
                  <span className="text-gray-400 font-bold">~</span>
                  <div className="relative flex items-center bg-white border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-mint-300 transition-all flex-1 min-w-[140px]">
                    <Calendar size={12} className="ml-2 text-gray-400" />
                    <input type="date" value={statsEnd} onChange={e => setStatsEnd(e.target.value)} className="bg-transparent border-none outline-none px-2 py-2 text-xs sm:text-sm font-bold text-gray-600 w-full" />
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {series.map(s => {
                  // Filter events in this series AND in range
                  const seriesEventsInRange = events.filter(e =>
                    e.seriesId === s.id &&
                    isDateInRange(e.startDate, statsStart, statsEnd)
                  );

                  const eventCount = seriesEventsInRange.length;

                  const totalSignups = signups.filter(si => {
                    const evt = seriesEventsInRange.find(e => e.id === si.eventId);
                    return !!evt;
                  }).length;

                  const avgSignups = eventCount > 0 ? (totalSignups / eventCount).toFixed(1) : '0';

                  // For progress bar visualization (normalized)
                  const max = 100; // Arbitrary max for visual
                  const percentage = Math.min((totalSignups / (eventCount * 20 || 1)) * 100, 100);

                  return (
                    <div key={s.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <div className="flex justify-between mb-2">
                        <span className="font-bold text-gray-700 text-lg">{s.name}</span>
                        <span className="font-bold text-gray-500" style={{ color: s.color }}>共 {eventCount} 場</span>
                      </div>
                      <div className="flex justify-between items-end mb-2">
                        <div className="text-sm text-gray-500 font-bold">平均 <span className="text-xl text-gray-800 font-black mx-1">{avgSignups}</span> 人/場</div>
                        <div className="text-sm text-gray-400">總計 {totalSignups} 人次</div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${percentage}%`, backgroundColor: s.color }}></div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- USERS TAB --- */}
      {activeTab === 'users' && (
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-extrabold text-3xl text-gray-800">義工名單</h3>
            <div className="space-x-4 flex">
              <button onClick={() => setShowVolunteerModal(true)} className="text-sm bg-mint-500 text-white border border-mint-600 px-3 py-2 rounded-lg font-bold hover:bg-mint-600 transition flex items-center gap-2 shadow-sm">
                <UserPlus size={16} /> 新增義工
              </button>
            </div>
          </div>
          {/* ... Table logic ... */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-base">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500">
                <tr>
                  <th className="p-4 font-extrabold uppercase tracking-wider w-1/4">姓名</th>
                  <th className="p-4 font-extrabold uppercase tracking-wider w-1/3">備註</th>
                  <th className="p-4 font-extrabold uppercase tracking-wider text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.filter(u => u.role === 'volunteer').map(u => (
                  <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                    {editingUserId === u.id ? (
                      <>
                        <td className="p-4">
                          <input
                            className="w-full p-2 border border-gray-300 rounded font-bold"
                            value={editUserFormData.name}
                            onChange={e => setEditUserFormData({ ...editUserFormData, name: e.target.value })}
                          />
                          <input
                            className="w-full p-2 border border-gray-300 rounded text-sm mt-1"
                            placeholder="Email"
                            value={editUserFormData.email}
                            onChange={e => setEditUserFormData({ ...editUserFormData, email: e.target.value })}
                          />
                        </td>
                        <td className="p-4">
                          <input
                            className="w-full p-2 border border-gray-300 rounded font-medium"
                            value={editUserFormData.title}
                            onChange={e => setEditUserFormData({ ...editUserFormData, title: e.target.value })}
                          />
                        </td>
                        <td className="p-4 text-right space-x-2 whitespace-nowrap">
                          <button onClick={() => saveEditUser(u.id)} className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition">
                            <CheckCircle size={20} />
                          </button>
                          <button onClick={cancelEditUser} className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition">
                            <X size={20} />
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="p-4 font-bold text-gray-800">
                          {u.name}
                          {!u.password && <span className="ml-2 text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded">未註冊</span>}
                          {!u.isApproved && <span className="text-red-500 text-sm ml-1">(未核准)</span>}
                          <div className="text-xs text-gray-400 font-normal">{u.email}</div>
                        </td>
                        <td className="p-4 font-medium text-gray-500">{u.title}</td>
                        <td className="p-4 text-right space-x-2 whitespace-nowrap">
                          <button onClick={() => startEditUser(u)} className="text-blue-500 hover:text-blue-700 p-2 hover:bg-blue-50 rounded-full transition">
                            <Edit size={18} />
                          </button>
                          {u.password ? (
                            <button onClick={() => handleViewPassword(u)} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full transition" title="查看密碼">
                              <Key size={18} />
                            </button>
                          ) : (
                            <button disabled className="text-gray-200 p-2 cursor-not-allowed" title="尚未註冊密碼">
                              <Key size={18} />
                            </button>
                          )}
                          {currentUser.role === 'core_admin' && u.id !== currentUser.id && (
                            <button onClick={() => handleDeleteRequest('user', u.id, u.name)} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-full transition">
                              <Trash2 size={18} />
                            </button>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- EVENTS & SERIES MANAGEMENT TAB (RESTORED) --- */}
      {activeTab === 'events' && (
        <div className="space-y-10">

          <div>
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-4">
                <h3 className="font-extrabold text-3xl text-gray-800">活動管理</h3>
                <div className="flex gap-2">
                  <button onClick={() => setShowArchivedEvents(!showArchivedEvents)} className={`text-sm border px-3 py-2 rounded-lg font-bold transition flex items-center gap-2 ${showArchivedEvents ? 'bg-gray-200 text-gray-800' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                    <Archive size={16} /> {showArchivedEvents ? '顯示進行中' : '過去活動'}
                  </button>
                  <button onClick={() => openSeriesModal()} className="text-sm bg-gray-100 border border-gray-300 px-3 py-2 rounded-lg hover:bg-gray-200 font-bold text-gray-600 transition flex items-center gap-2">
                    <Palette size={16} /> 管理系列
                  </button>
                  {/* Resized Add Event Button to match neighbors */}
                  {!showArchivedEvents && (
                    <button onClick={openAddEvent} className="text-sm bg-mint-500 text-white border border-mint-600 px-3 py-2 rounded-lg font-bold hover:bg-mint-600 transition flex items-center gap-2 shadow-sm">
                      <PlusCircle size={16} /> 新增活動
                    </button>
                  )}
                </div>
              </div>
            </div>

            <ul className="space-y-4">
              {displayedEvents.length === 0 && <p className="text-gray-400 italic">無活動資料</p>}
              {displayedEvents.map(e => (
                <li key={e.id} className="bg-white p-6 rounded-2xl border-2 border-transparent hover:border-mint-200 shadow-sm flex justify-between items-center transition duration-300">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-xl text-gray-800">{e.title}</h4>
                      {!e.isRegistrationOpen && <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded">已關閉</span>}
                    </div>
                    {/* Show Year if Archived */}
                    <span className="text-gray-500 font-medium mt-1 block">
                      {showArchivedEvents ? `${e.startDate} ~ ${e.endDate}` : `${formatDateShort(e.startDate)} ~ ${formatDateShort(e.endDate)}`}
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => openEditEvent(e)} className="p-2 bg-blue-50 text-blue-500 rounded-full hover:bg-blue-100 transition"><Edit size={20} /></button>
                    {/* Only allow hard delete in archive or core admin */}
                    <button onClick={() => handleDeleteRequest('event', e.id, e.title)} className="p-2 bg-red-50 text-red-500 rounded-full hover:bg-red-100 transition"><Trash2 size={20} /></button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* --- CONFIRM DELETE MODAL --- */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 animate-fade-in">
          <div className="bg-white p-8 rounded-3xl max-w-sm w-full shadow-2xl text-center">
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={32} />
            </div>
            <h3 className="text-xl font-extrabold text-gray-800 mb-2">確定要刪除嗎？</h3>
            <p className="text-gray-500 mb-6">您正在刪除「{showDeleteConfirm.name}」，此動作無法復原。</p>
            <div className="flex gap-4">
              <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200">取消</button>
              <button onClick={confirmDelete} className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600">確認刪除</button>
            </div>
          </div>
        </div>
      )}

      {/* --- PASSWORD MODAL (NEW) --- */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 animate-fade-in">
          <div className="bg-white p-8 rounded-3xl max-w-sm w-full shadow-2xl text-center animate-pop">
            <div className="w-16 h-16 bg-blue-100 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Key size={32} />
            </div>
            <h3 className="text-xl font-extrabold text-gray-800 mb-2">{showPasswordModal.name} 的密碼</h3>
            <div className="bg-gray-100 p-4 rounded-xl mb-6">
              <span className="text-2xl font-mono font-black text-gray-800 tracking-wider select-all">{showPasswordModal.password}</span>
            </div>
            <button onClick={() => setShowPasswordModal(null)} className="w-full py-3 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 shadow-lg shadow-blue-500/30">關閉</button>
          </div>
        </div>
      )}

      {/* --- HISTORY MODAL (FOR ADMIN REPORTS) --- */}
      {showHistoryModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl animate-pop max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-extrabold text-gray-800">{showHistoryModalUser.name} 的紀錄</h2>
              <button onClick={() => setShowHistoryModalUser(null)}><X className="text-gray-400 hover:text-gray-600" /></button>
            </div>
            <div className="overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {signups.filter(s => s.volunteerId === showHistoryModalUser.id).length === 0 && <p className="text-gray-400 text-center py-10">尚無紀錄</p>}
              {signups.filter(s => s.volunteerId === showHistoryModalUser.id)
                .sort((a, b) => b.submissionDate.localeCompare(a.submissionDate))
                .map(s => {
                  const evt = events.find(e => e.id === s.eventId) || { title: '未知活動', startDate: '??' } as any;
                  return (
                    <div key={s.id} className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                      <div className="font-bold text-gray-800">{evt.title}</div>
                      <div className="text-sm text-gray-500 flex justify-between mt-1">
                        <span>{formatDateShort(evt.startDate)}</span>
                        <span className="text-mint-600 font-bold">已參加</span>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      )}

      {/* --- SERIES MODAL --- */}
      {showSeriesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-pop">
            <h2 className="text-2xl font-extrabold text-gray-800 mb-6">{isEditingSeries ? '編輯系列' : '管理系列'}</h2>
            {!isEditingSeries && (
              <div className="mb-6 space-y-2 max-h-40 overflow-y-auto">
                {series.map(s => (
                  <div key={s.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-xl">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: s.color }}></div>
                      <span className="font-bold text-gray-700">{s.name}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setSeriesForm(s); setIsEditingSeries(true) }} className="text-blue-500"><Edit size={16} /></button>
                      <button onClick={() => { if (confirm('刪除此系列？')) onSeriesAction?.('delete', { id: s.id }) }} className="text-red-500"><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* ... inputs for series ... */}
            <div className="space-y-4 border-t border-gray-100 pt-4">
              <h3 className="font-bold text-gray-500 text-sm">{isEditingSeries ? '修改資訊' : '新增系列'}</h3>
              <input className="w-full p-3 bg-gray-50 rounded-xl border-2 border-gray-200 font-bold" placeholder="系列名稱" value={seriesForm.name} onChange={e => setSeriesForm({ ...seriesForm, name: e.target.value })} />
              <div>
                <label className="block text-gray-400 font-bold text-sm mb-2">代表色</label>
                <div className="flex gap-2 flex-wrap">
                  {/* Darker Pastel Colors (400 weight) */}
                  {['#F87171', '#FBBF24', '#34D399', '#60A5FA', '#A78BFA', '#F472B6', '#94A3B8'].map(c => (
                    <button key={c} onClick={() => setSeriesForm({ ...seriesForm, color: c })} className={`w-8 h-8 rounded-full border-2 ${seriesForm.color === c ? 'border-gray-800 scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowSeriesModal(false)} className="flex-1 py-3 bg-gray-100 font-bold text-gray-600 rounded-xl">關閉</button>
                <button onClick={handleSeriesSubmit} className="flex-1 py-3 bg-mint-500 text-white font-bold rounded-xl">儲存</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- VOLUNTEER MODAL (UPDATED) --- */}
      {showVolunteerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-pop">
            <h2 className="text-2xl font-extrabold text-gray-800 mb-6">新增義工名單</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-500 text-sm font-bold mb-1">姓名</label>
                <input className="w-full p-3 bg-gray-50 rounded-xl border-2 border-gray-200 font-bold" placeholder="姓名" value={volunteerForm.name} onChange={e => setVolunteerForm({ ...volunteerForm, name: e.target.value })} />
              </div>

              <div>
                <label className="block text-gray-500 text-sm font-bold mb-1">備註</label>
                <input className="w-full p-3 bg-gray-50 rounded-xl border-2 border-gray-200 font-bold" placeholder="例如：擅長駕駛、餐飲組..." value={volunteerForm.title} onChange={e => setVolunteerForm({ ...volunteerForm, title: e.target.value })} />
              </div>

              <div className="flex gap-3 pt-4">
                <button onClick={() => setShowVolunteerModal(false)} className="flex-1 py-3 bg-gray-100 font-bold text-gray-600 rounded-xl">取消</button>
                <button onClick={handleVolunteerSubmit} className="flex-1 py-3 bg-mint-500 text-white font-bold rounded-xl">建立</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- EVENT MODAL (ADD/EDIT) --- */}
      {showEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          {/* ... Event Form Content (Kept same) ... */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-[92vw] sm:w-full shadow-2xl animate-pop my-10 border border-gray-100">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-extrabold text-gray-800">{isEditingEvent ? '編輯活動' : '新增活動'}</h2>
              <button onClick={() => setShowEventModal(false)}><X className="text-gray-400 hover:text-gray-600" /></button>
            </div>
            <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
              {/* Basic Info */}
              <div>
                <label className="block text-gray-500 text-sm font-bold mb-1">系列與標題</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select className="w-full sm:w-1/3 p-3 bg-gray-50 rounded-xl border-2 border-gray-200 font-bold outline-none focus:ring-2 focus:ring-mint-300" value={eventForm.seriesId} onChange={e => setEventForm({ ...eventForm, seriesId: e.target.value })}>
                    {series.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <input className="w-full sm:w-2/3 p-3 bg-gray-50 rounded-xl border-2 border-gray-200 font-bold outline-none focus:ring-2 focus:ring-mint-300" placeholder="活動標題" value={eventForm.title} onChange={e => setEventForm({ ...eventForm, title: e.target.value })} />
                </div>
              </div>

              {/* Dates */}
              <div>
                <label className="block text-gray-500 text-sm font-bold mb-1">活動日期</label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <div className="text-[10px] uppercase font-black text-gray-400 ml-1 mb-0.5">開始</div>
                    <div className="relative flex items-center bg-gray-50 rounded-xl border-2 border-gray-200 focus-within:ring-2 focus-within:ring-mint-300 transition-all">
                      <Calendar size={16} className="ml-3 text-gray-400 pointer-events-none" />
                      <input type="date" className="w-full p-3 bg-transparent border-none outline-none font-bold text-gray-700" value={eventForm.startDate} onChange={e => setEventForm({ ...eventForm, startDate: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="text-[10px] uppercase font-black text-gray-400 ml-1 mb-0.5">結束</div>
                    <div className="relative flex items-center bg-gray-50 rounded-xl border-2 border-gray-200 focus-within:ring-2 focus-within:ring-mint-300 transition-all">
                      <Calendar size={16} className="ml-3 text-gray-400 pointer-events-none" />
                      <input type="date" className="w-full p-3 bg-transparent border-none outline-none font-bold text-gray-700" value={eventForm.endDate} onChange={e => setEventForm({ ...eventForm, endDate: e.target.value })} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Meal Config Generator */}
              {eventForm.mealsConfig.length > 0 && (
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <label className="block text-gray-500 text-sm font-bold mb-3">餐食設定 (勾選開放登記)</label>
                  <div className="space-y-2">
                    {eventForm.mealsConfig.map((m, idx) => (
                      <div key={m.date} className="flex items-center justify-between text-sm py-1 border-b border-gray-100 last:border-0">
                        <span className="font-bold text-gray-700">{formatDateShort(m.date)}</span>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input type="checkbox" checked={m.breakfast} onChange={(e) => {
                              const newCfg = [...eventForm.mealsConfig];
                              newCfg[idx].breakfast = e.target.checked;
                              setEventForm({ ...eventForm, mealsConfig: newCfg });
                            }} className="accent-mint-500 w-4 h-4" /> <span className="font-bold">早</span>
                          </label>
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input type="checkbox" checked={m.lunch} onChange={(e) => {
                              const newCfg = [...eventForm.mealsConfig];
                              newCfg[idx].lunch = e.target.checked;
                              setEventForm({ ...eventForm, mealsConfig: newCfg });
                            }} className="accent-mint-500 w-4 h-4" /> <span className="font-bold">午</span>
                          </label>
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input type="checkbox" checked={m.dinner} onChange={(e) => {
                              const newCfg = [...eventForm.mealsConfig];
                              newCfg[idx].dinner = e.target.checked;
                              setEventForm({ ...eventForm, mealsConfig: newCfg });
                            }} className="accent-mint-500 w-4 h-4" /> <span className="font-bold">晚</span>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Registration Control */}
              <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                <label className="block text-orange-700 text-sm font-bold mb-3">報名控制</label>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-gray-700">開放報名</span>
                  <div
                    onClick={() => setEventForm({ ...eventForm, isRegistrationOpen: !eventForm.isRegistrationOpen })}
                    className={`w-12 h-6 rounded-full cursor-pointer transition relative ${eventForm.isRegistrationOpen ? 'bg-mint-500' : 'bg-gray-300'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${eventForm.isRegistrationOpen ? 'left-7' : 'left-1'}`}></div>
                  </div>
                </div>
                <div>
                  <label className="block text-gray-500 text-xs font-bold mb-1">截止日期</label>
                  <div className="relative flex items-center bg-white rounded-lg border border-orange-200 focus-within:ring-2 focus-within:ring-orange-300 transition-all">
                    <Calendar size={14} className="ml-2.5 text-orange-400 pointer-events-none" />
                    <input type="date" className="w-full p-2 bg-transparent border-none outline-none text-sm font-bold text-gray-700" value={eventForm.registrationDeadline} onChange={e => setEventForm({ ...eventForm, registrationDeadline: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-gray-500 text-sm font-bold mb-1">備註</label>
                <textarea className="w-full p-3 bg-gray-50 rounded-xl border-2 border-gray-200 font-bold h-24" value={eventForm.remarks || ''} onChange={e => setEventForm({ ...eventForm, remarks: e.target.value })} placeholder="例如：請自備水杯..." />
              </div>

              <button onClick={handleEventSubmit} className="w-full py-4 bg-mint-500 text-white font-black rounded-xl hover:bg-mint-600 transition">
                {isEditingEvent ? '儲存變更' : '建立活動'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
