import React, { useState, useEffect } from 'react';
import { MinistryEvent, Signup, EventSeries, User } from '../types';
import { getSmartShuttleAlert, isLunchLocked, formatDateShort, isEventPast, getDatesInRange } from '../utils';
import { Clock, Utensils, AlertCircle, CheckCircle, Calendar, ArrowRight, Edit, Users, X, BarChart2, History, AlertTriangle, Info } from 'lucide-react';

interface VolunteerPortalProps {
   user: User;
   users: User[];
   events: MinistryEvent[];
   series: EventSeries[];
   signups: Signup[];
   onSignup: (data: Partial<Signup>) => void;
   onUpdateUser: (data: Partial<User>) => void;
}

export const VolunteerPortal: React.FC<VolunteerPortalProps> = ({ user, users, events, series, signups, onSignup, onUpdateUser }) => {
   const [selectedEventId, setSelectedEventId] = useState<string>('');

   // Modals for Stats
   const [showHistoryModal, setShowHistoryModal] = useState(false);
   const [showChartModal, setShowChartModal] = useState(false);

   // Initialize Chart Range to Current Year (Jan - Dec)
   const currentYear = new Date().getFullYear();
   const [chartRange, setChartRange] = useState({
      start: `${currentYear}-01`,
      end: `${currentYear}-12`
   });

   // Form State
   const [formData, setFormData] = useState<Partial<Signup>>({
      transportMode: 'shuttle',
      arrivalLocation: 'Zaoqiao',
      arrivalDate: '',
      arrivalTime: '18:00',
      departureMode: 'shuttle',
      departureLocation: 'Zaoqiao',
      departureDate: '',
      departureTime: '12:00',
      attendingDays: [],
      meals: [],
      notes: ''
   });

   const [showShuttleConflict, setShowShuttleConflict] = useState(false);
   const [isEditing, setIsEditing] = useState(false);
   const [errors, setErrors] = useState<Record<string, string>>({});

   const selectedEvent = events.find(e => e.id === selectedEventId);
   const existingSignup = signups.find(s => s.eventId === selectedEventId && s.volunteerId === user.id);

   // Filter Active Events Only for Portal & SORT BY START DATE
   const activeEvents = events
      .filter(e => !isEventPast(e.endDate))
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

   // If entering edit mode or selecting an event with existing signup
   useEffect(() => {
      if (selectedEventId) {
         if (existingSignup) {
            // Reset form to existing data
            setFormData(existingSignup);
         } else if (selectedEvent) {
            // Reset form to defaults for NEW event
            setFormData({
               transportMode: 'shuttle',
               arrivalLocation: 'Zaoqiao',
               arrivalDate: '',
               arrivalTime: '18:00',
               departureMode: 'shuttle',
               departureLocation: 'Zaoqiao',
               departureDate: '',
               departureTime: '12:00',
               attendingDays: [],
               meals: [],
               notes: ''
            });
         }
         setIsEditing(false);
         setErrors({});
      }
   }, [selectedEventId]); // Trigger explicitly when selection changes

   const startEdit = () => {
      if (existingSignup) {
         setFormData(existingSignup);
         setIsEditing(true);
      }
   };

   // --- LOGIC ---
   const handleDayToggle = (day: string) => {
      const currentDays = formData.attendingDays || [];
      if (currentDays.includes(day)) {
         setFormData({ ...formData, attendingDays: currentDays.filter(d => d !== day) });
      } else {
         setFormData({ ...formData, attendingDays: [...currentDays, day].sort() });
      }
      // Clear error
      if (errors.attendingDays) setErrors({ ...errors, attendingDays: '' });
   };

   const handleMealToggle = (date: string, type: 'breakfast' | 'lunch' | 'dinner') => {
      const currentMeals = formData.meals || [];
      const exists = currentMeals.find(m => m.date === date && m.type === type);
      if (exists) {
         setFormData({ ...formData, meals: currentMeals.filter(m => !(m.date === date && m.type === type)) });
      } else {
         setFormData({ ...formData, meals: [...currentMeals, { date, type }] });
      }
   };

   // Smart Shuttle Alert Check
   const checkShuttleConflict = (isDeparture: boolean) => {
      const time = isDeparture ? formData.departureTime : formData.arrivalTime;
      const loc = isDeparture ? formData.departureLocation : formData.arrivalLocation;
      const mode = isDeparture ? formData.departureMode : formData.transportMode;

      if (selectedEvent && mode === 'shuttle' && time && loc) {
         const relevantSignups = signups.filter(s =>
            s.eventId === selectedEventId &&
            s.volunteerId !== user.id &&
            (isDeparture ? s.departureMode === 'shuttle' && s.departureLocation === loc : s.transportMode === 'shuttle' && s.arrivalLocation === loc)
         );

         const conflictCount = getSmartShuttleAlert(time, relevantSignups, isDeparture);
         if (conflictCount > 0) setShowShuttleConflict(true); // Simple toggle for now
      }
   };

   const getExistingTimes = (isDeparture: boolean) => {
      const loc = isDeparture ? formData.departureLocation : formData.arrivalLocation;
      if (!loc) return [];

      const relevant = signups.filter(s =>
         s.eventId === selectedEventId &&
         s.volunteerId !== user.id && // Don't count self if editing
         (isDeparture
            ? (s.departureMode === 'shuttle' && s.departureLocation === loc && s.departureTime)
            : (s.transportMode === 'shuttle' && s.arrivalLocation === loc && s.arrivalTime))
      );

      // Group by time -> [names]
      const timeMap: Record<string, string[]> = {};
      relevant.forEach(s => {
         const t = isDeparture ? s.departureTime! : s.arrivalTime!;
         const volunteerName = users.find(u => u.id === s.volunteerId)?.name || 'Unknown';

         if (!timeMap[t]) timeMap[t] = [];
         timeMap[t].push(volunteerName);
      });

      return Object.entries(timeMap).sort(); // [['18:00', ['Ming', 'John']], ...]
   };

   const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedEventId) return;

      // Create a copy to manipulate for defaults
      const submitData = { ...formData };

      // --- SMART DEFAULT LOGIC ---
      // If transport is shuttle but no location is explicitly set (user didn't touch the dropdown),
      // default it to 'Zaoqiao' because that's what the UI shows as the first option.
      if (submitData.transportMode === 'shuttle' && !submitData.arrivalLocation) {
         submitData.arrivalLocation = 'Zaoqiao';
      }
      if (submitData.departureMode === 'shuttle' && !submitData.departureLocation) {
         submitData.departureLocation = 'Zaoqiao';
      }

      // VALIDATION
      const newErrors: Record<string, string> = {};

      if ((submitData.attendingDays?.length || 0) === 0) {
         newErrors.attendingDays = '請至少勾選一天參加！';
      }

      if (submitData.transportMode === 'shuttle') {
         if (!submitData.arrivalLocation) newErrors.arrivalLocation = '請選擇去程地點';
         if (!submitData.arrivalTime) newErrors.arrivalTime = '請填寫去程時間';
      }

      if (submitData.departureMode === 'shuttle') {
         if (!submitData.departureLocation) newErrors.departureLocation = '請選擇回程地點';
         if (!submitData.departureTime) newErrors.departureTime = '請填寫回程時間';
      }

      if (Object.keys(newErrors).length > 0) {
         setErrors(newErrors);
         alert('請檢查紅色標示欄位，填寫完整後再送出。');
         return;
      }

      // --- SAFETY FILTER ---
      // Ensure we only save meals and days that actually belong to THIS event
      if (selectedEvent) {
         const allowedDates = getDatesInRange(selectedEvent.startDate, selectedEvent.endDate);
         submitData.meals = (submitData.meals || []).filter(m => allowedDates.includes(m.date));
         submitData.attendingDays = (submitData.attendingDays || []).filter(d => allowedDates.includes(d));
      }

      onSignup({
         eventId: selectedEventId,
         volunteerId: user.id,
         submissionDate: new Date().toISOString(),
         ...submitData
      });

      // Reset
      setFormData({
         transportMode: 'shuttle',
         arrivalLocation: 'Zaoqiao',
         arrivalDate: '',
         arrivalTime: '18:00',
         departureMode: 'shuttle',
         departureLocation: 'Zaoqiao',
         departureDate: '',
         departureTime: '12:00',
         attendingDays: [],
         meals: [],
         notes: ''
      });
      setErrors({});
      setIsEditing(false);
      setSelectedEventId('');
      window.scrollTo(0, 0);
   };

   // Chart Data Preparation
   const getMonthlyStats = () => {
      const stats: Record<string, number> = {};
      const start = new Date(chartRange.start);
      const end = new Date(chartRange.end);
      end.setMonth(end.getMonth() + 1); // Inclusive

      // Init keys
      let curr = new Date(start);
      while (curr < end) {
         const key = curr.toISOString().slice(0, 7); // YYYY-MM
         stats[key] = 0;
         curr.setMonth(curr.getMonth() + 1);
      }

      // Count signups
      signups.filter(s => s.volunteerId === user.id).forEach(s => {
         const evt = events.find(e => e.id === s.eventId);
         if (evt) {
            const key = evt.startDate.slice(0, 7);
            if (stats[key] !== undefined) stats[key]++;
         }
      });

      return Object.entries(stats).sort();
   };

   return (
      <div className="p-6 max-w-2xl mx-auto pb-32 font-sans">
         {/* Header Name */}
         <h1 className="text-3xl font-extrabold text-gray-800 mb-8 tracking-wide">嗨，{user.name}！</h1>

         {/* Honor Stats (Clickable) */}
         <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-8 grid grid-cols-2 gap-4 text-center animate-fade-in hover:shadow-md transition">
            <div onClick={() => setShowHistoryModal(true)} className="p-2 cursor-pointer hover:bg-gray-50 rounded-xl transition">
               <div className="text-gray-400 text-sm font-bold uppercase tracking-widest mb-2 flex items-center justify-center gap-1"><History size={14} /> 累積服事</div>
               <div className="text-4xl font-black text-mint-600">{user.totalServiceCount}</div>
            </div>
            <div onClick={() => setShowChartModal(true)} className="p-2 border-l-2 border-gray-100 cursor-pointer hover:bg-gray-50 rounded-xl transition">
               <div className="text-gray-400 text-sm font-bold uppercase tracking-widest mb-2 flex items-center justify-center gap-1"><BarChart2 size={14} /> 連續月數</div>
               <div className="text-4xl font-black text-vibrant-500">{user.consecutiveMonths}</div>
            </div>
         </div>

         <div className="space-y-8">
            {/* Event List */}
            {!selectedEvent && (
               <div className="space-y-4 animate-fade-in">
                  <label className="text-lg font-extrabold text-gray-800 block mb-2 tracking-wide">近期聚會列表</label>
                  {activeEvents.length === 0 && <p className="text-gray-400 italic">目前無進行中的聚會</p>}
                  {activeEvents.map(evt => {
                     const s = series.find(se => se.id === evt.seriesId);
                     const isSigned = signups.some(si => si.eventId === evt.id && si.volunteerId === user.id);

                     return (
                        <div
                           key={evt.id}
                           onClick={() => setSelectedEventId(evt.id)}
                           className={`relative p-6 rounded-3xl border-2 cursor-pointer transition-all duration-300 bg-white shadow-sm hover:border-mint-300 hover:shadow-md hover:-translate-y-1`}
                        >
                           <div className="flex justify-between items-start mb-2">
                              <div className="text-sm font-extrabold uppercase tracking-widest px-2 py-0.5 rounded inline-block text-white" style={{ backgroundColor: s?.color || '#999' }}>
                                 {s?.name}
                              </div>
                              {isSigned && <CheckCircle className="text-mint-500 drop-shadow-sm" size={28} />}
                           </div>

                           <h3 className="font-extrabold text-2xl text-gray-800">{evt.title}</h3>

                           <div className="text-base text-gray-500 mt-2 flex items-center gap-2 font-medium">
                              <Clock size={18} /> {formatDateShort(evt.startDate)} ~ {formatDateShort(evt.endDate)}
                           </div>

                           {evt.remarks && (
                              <div className="mt-4 p-3 bg-gray-50 rounded-xl border border-gray-100 text-sm text-gray-600 flex items-start gap-2">
                                 <Info size={16} className="shrink-0 mt-0.5 text-gray-400" />
                                 <span>{evt.remarks}</span>
                              </div>
                           )}
                        </div>
                     );
                  })}
               </div>
            )}

            {/* ... (Existing Signup Summary and Form logic kept as is) ... */}
            {selectedEvent && existingSignup && !isEditing && (
               <div className="bg-white border-2 border-gray-100 p-8 rounded-3xl text-center space-y-6">
                  <div className="flex justify-between items-start">
                     <button onClick={() => setSelectedEventId('')} className="text-gray-400 font-bold hover:text-gray-600 transition">← 返回</button>
                     <button onClick={startEdit} className="text-blue-500 font-bold flex items-center gap-2 hover:bg-blue-50 px-3 py-1 rounded-lg transition"><Edit size={16} /> 修改報名</button>
                  </div>
                  <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto animate-pop">
                     <CheckCircle size={40} />
                  </div>
                  <div>
                     <h3 className="text-2xl font-extrabold text-gray-800 tracking-wide">{selectedEvent.title}</h3>
                     <span className="text-lg text-gray-500 font-medium">已完成報名</span>
                  </div>
                  <div className="bg-gray-50 rounded-2xl p-6 text-left text-lg space-y-4 shadow-inner">
                     <div className="flex justify-between border-b border-gray-200 pb-3">
                        <span className="text-gray-500 font-bold">日期</span>
                        <span className="font-bold text-gray-800">{existingSignup.attendingDays.map(formatDateShort).join(', ')}</span>
                     </div>
                     <div className="flex justify-between border-b border-gray-200 pb-3">
                        <span className="text-gray-500 font-bold">去程</span>
                        <span className="font-bold text-gray-800">{existingSignup.transportMode === 'shuttle' ? '接駁車' : '自理'} {existingSignup.arrivalTime}</span>
                     </div>
                     <div className="flex justify-between border-b border-gray-200 pb-3">
                        <span className="text-gray-500 font-bold">回程</span>
                        <span className="font-bold text-gray-800">{existingSignup.departureMode === 'shuttle' ? '接駁車' : '自理'} {existingSignup.departureTime}</span>
                     </div>
                     <div className="flex justify-between border-b border-gray-200 pb-3">
                        <span className="text-gray-500 font-bold">餐食</span>
                        <span className="font-bold text-gray-800 text-right text-sm">
                           {(() => {
                              const allowedDates = getDatesInRange(selectedEvent.startDate, selectedEvent.endDate);
                              const filteredMeals = existingSignup.meals.filter(m => allowedDates.includes(m.date));
                              return filteredMeals.length > 0
                                 ? filteredMeals.map(m => `${formatDateShort(m.date)}${m.type === 'breakfast' ? '早' : m.type === 'lunch' ? '午' : '晚'}`).join('、')
                                 : '無';
                           })()}
                        </span>
                     </div>
                  </div>
               </div>
            )}

            {/* Signup/Edit Form */}
            {selectedEvent && (!existingSignup || isEditing) && (
               <form onSubmit={handleSubmit} className="bg-white p-8 rounded-3xl shadow-lg shadow-gray-100 space-y-10 animate-fade-in border border-gray-100">
                  <div className="flex justify-between items-center border-b-2 border-gray-100 pb-4">
                     <h3 className="text-2xl font-extrabold text-gray-800 tracking-wide">{isEditing ? '修改報名資訊' : '填寫報名資訊'}</h3>
                     <button type="button" onClick={() => { setSelectedEventId(''); setIsEditing(false); }} className="text-gray-400 font-bold hover:text-gray-600">取消</button>
                  </div>

                  {/* 1. Days Selection */}
                  <section>
                     <label className="block text-lg font-extrabold text-gray-800 mb-4 flex items-center gap-3">
                        <Calendar size={24} className="text-mint-500" /> 參與日期
                        {errors.attendingDays && <span className="text-red-500 text-sm font-bold bg-red-50 px-2 rounded ml-2">{errors.attendingDays}</span>}
                     </label>
                     <div className="flex flex-wrap gap-3">
                        {getDatesInRange(selectedEvent.startDate, selectedEvent.endDate).map(dateStr => (
                           <button type="button"
                              key={dateStr}
                              onClick={() => handleDayToggle(dateStr)}
                              className={`px-4 py-3 rounded-xl text-base font-bold border-2 transition flex items-center gap-2 ${formData.attendingDays?.includes(dateStr) ? 'bg-mint-500 text-white border-mint-500 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                              <Calendar size={16} className={formData.attendingDays?.includes(dateStr) ? 'text-white' : 'text-gray-400'} />
                              {formatDateShort(dateStr)}
                           </button>
                        ))}
                     </div>
                  </section>

                  {/* 2. Arrival Transport */}
                  <section>
                     <label className="block text-lg font-extrabold text-gray-800 mb-4 flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-black">去</div>
                        去程交通
                     </label>
                     <div className="flex gap-4 mb-4">
                        <button type="button" onClick={() => setFormData({ ...formData, transportMode: 'shuttle' })}
                           className={`flex-1 py-3 rounded-xl border-2 text-base font-bold transition ${formData.transportMode === 'shuttle' ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                           接駁車
                        </button>
                        <button type="button" onClick={() => setFormData({ ...formData, transportMode: 'self' })}
                           className={`flex-1 py-3 rounded-xl border-2 text-base font-bold transition ${formData.transportMode === 'self' ? 'bg-gray-600 text-white border-gray-600 shadow-lg shadow-gray-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                           自行前往
                        </button>
                     </div>
                     {formData.transportMode === 'shuttle' && (
                        <div className="bg-blue-50/50 p-6 rounded-2xl space-y-4 border border-blue-100">
                           <div className="grid grid-cols-2 gap-6">
                              <div>
                                 <label className="text-xs font-bold uppercase tracking-wider text-blue-800 mb-2 block">地點 {errors.arrivalLocation && <span className="text-red-500 ml-1">*</span>}</label>
                                 <select className={`w-full p-3 rounded-xl border-2 text-lg bg-white focus:ring-0 outline-none ${errors.arrivalLocation ? 'border-red-300' : 'border-blue-100 focus:border-blue-500'}`}
                                    value={formData.arrivalLocation} onChange={(e) => setFormData({ ...formData, arrivalLocation: e.target.value as any })}>
                                    <option value="Zaoqiao">造橋車站</option>
                                    <option value="Zhunan">竹南車站</option>
                                    <option value="HSR_Miaoli">苗栗高鐵</option>
                                 </select>
                              </div>
                              <div>
                                 <label className="text-xs font-bold uppercase tracking-wider text-blue-800 mb-2 block">時間 {errors.arrivalTime && <span className="text-red-500 ml-1">*</span>}</label>
                                 <input type="time" className={`w-full p-3 rounded-xl border-2 text-lg bg-white focus:ring-0 outline-none ${errors.arrivalTime ? 'border-red-300' : 'border-blue-100 focus:border-blue-500'}`}
                                    value={formData.arrivalTime} onChange={(e) => setFormData({ ...formData, arrivalTime: e.target.value })}
                                    onBlur={() => checkShuttleConflict(false)} />
                              </div>
                           </div>
                           {getExistingTimes(false).length > 0 && (
                              <div className="bg-white p-3 rounded-xl shadow-sm border border-blue-100">
                                 <div className="text-xs font-bold text-blue-800 mb-2 flex items-center gap-1"><Users size={12} /> 參考他人時間（點擊套用）</div>
                                 <div className="flex flex-wrap gap-2">
                                    {getExistingTimes(false).map(([t, names]) => (
                                       <div key={t} className="flex flex-col items-start">
                                          <span className="px-2 py-1 bg-blue-100 text-blue-600 text-xs font-bold rounded cursor-pointer hover:bg-blue-200 transition mb-1" onClick={() => setFormData({ ...formData, arrivalTime: t })}>
                                             {t} ({names.length}人)
                                          </span>
                                          <span className="text-[10px] text-gray-400 pl-1">{names.join(', ')}</span>
                                       </div>
                                    ))}
                                 </div>
                              </div>
                           )}
                           {showShuttleConflict && <div className="text-sm font-bold text-blue-600 flex gap-2 bg-white p-3 rounded-xl shadow-sm"><AlertCircle size={20} /> 此時段已有人登記，建議併車</div>}
                        </div>
                     )}
                  </section>

                  {/* 3. Departure Transport */}
                  <section>
                     <label className="block text-lg font-extrabold text-gray-800 mb-4 flex items-center gap-3">
                        <div className="w-8 h-8 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-sm font-black">回</div>
                        回程交通
                     </label>
                     <div className="flex gap-4 mb-4">
                        <button type="button" onClick={() => setFormData({ ...formData, departureMode: 'shuttle' })}
                           className={`flex-1 py-3 rounded-xl border-2 text-base font-bold transition ${formData.departureMode === 'shuttle' ? 'bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                           接駁車
                        </button>
                        <button type="button" onClick={() => setFormData({ ...formData, departureMode: 'self' })}
                           className={`flex-1 py-3 rounded-xl border-2 text-base font-bold transition ${formData.departureMode === 'self' ? 'bg-gray-600 text-white border-gray-600 shadow-lg shadow-gray-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                           自行前往
                        </button>
                     </div>
                     {formData.departureMode === 'shuttle' && (
                        <div className="bg-orange-50/50 p-6 rounded-2xl space-y-4 border border-orange-100">
                           <div className="grid grid-cols-2 gap-6">
                              <div>
                                 <label className="text-xs font-bold uppercase tracking-wider text-orange-800 mb-2 block">地點 {errors.departureLocation && <span className="text-red-500 ml-1">*</span>}</label>
                                 <select className={`w-full p-3 rounded-xl border-2 text-lg bg-white focus:ring-0 outline-none ${errors.departureLocation ? 'border-red-300' : 'border-orange-100 focus:border-orange-500'}`}
                                    value={formData.departureLocation} onChange={(e) => setFormData({ ...formData, departureLocation: e.target.value as any })}>
                                    <option value="Zaoqiao">造橋車站</option>
                                    <option value="Zhunan">竹南車站</option>
                                    <option value="HSR_Miaoli">苗栗高鐵</option>
                                 </select>
                              </div>
                              <div>
                                 <label className="text-xs font-bold uppercase tracking-wider text-orange-800 mb-2 block">時間 {errors.departureTime && <span className="text-red-500 ml-1">*</span>}</label>
                                 <input type="time" className={`w-full p-3 rounded-xl border-2 text-lg bg-white focus:ring-0 outline-none ${errors.departureTime ? 'border-red-300' : 'border-orange-100 focus:border-orange-500'}`}
                                    value={formData.departureTime} onChange={(e) => setFormData({ ...formData, departureTime: e.target.value })}
                                    onBlur={() => checkShuttleConflict(true)} />
                              </div>
                           </div>
                           {getExistingTimes(true).length > 0 && (
                              <div className="bg-white p-3 rounded-xl shadow-sm border border-orange-100">
                                 <div className="text-xs font-bold text-orange-800 mb-2 flex items-center gap-1"><Users size={12} /> 參考他人時間（點擊套用）</div>
                                 <div className="flex flex-wrap gap-2">
                                    {getExistingTimes(true).map(([t, names]) => (
                                       <div key={t} className="flex flex-col items-start">
                                          <span className="px-2 py-1 bg-orange-100 text-orange-600 text-xs font-bold rounded cursor-pointer hover:bg-orange-200 transition mb-1" onClick={() => setFormData({ ...formData, departureTime: t })}>
                                             {t} ({names.length}人)
                                          </span>
                                          <span className="text-[10px] text-gray-400 pl-1">{names.join(', ')}</span>
                                       </div>
                                    ))}
                                 </div>
                              </div>
                           )}
                        </div>
                     )}
                  </section>

                  {/* 4. Meals */}
                  <section>
                     <div className="flex justify-between items-center mb-4">
                        <label className="flex items-center gap-3 text-lg font-extrabold text-gray-800">
                           <Utensils size={24} className="text-vibrant-500" /> 登記便當
                        </label>
                        {isLunchLocked(selectedEvent.startDate) && <span className="text-sm font-bold text-red-500 bg-red-100 px-3 py-1 rounded-full">已截止修改</span>}
                     </div>

                     <div className="space-y-3">
                        {selectedEvent.mealsConfig.map((m, idx) => (
                           <div key={idx} className="flex items-center justify-between text-base p-4 bg-gray-50 rounded-2xl border border-gray-100">
                              <span className="font-bold text-gray-700">{formatDateShort(m.date)}</span>
                              <div className="flex gap-2 sm:gap-6">
                                 {m.breakfast && (
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                       <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-md border-2 flex items-center justify-center transition ${formData.meals?.some(x => x.date === m.date && x.type === 'breakfast') ? 'bg-mint-500 border-mint-500' : 'bg-white border-gray-300 group-hover:border-mint-400'}`}>
                                          {formData.meals?.some(x => x.date === m.date && x.type === 'breakfast') && <CheckCircle size={14} className="text-white" />}
                                       </div>
                                       <input type="checkbox" className="hidden"
                                          disabled={isLunchLocked(selectedEvent.startDate)}
                                          checked={formData.meals?.some(x => x.date === m.date && x.type === 'breakfast')}
                                          onChange={() => handleMealToggle(m.date, 'breakfast')}
                                       /> <span className="font-bold text-gray-700 text-sm sm:text-base">早</span>
                                    </label>
                                 )}
                                 {m.lunch && (
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                       <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-md border-2 flex items-center justify-center transition ${formData.meals?.some(x => x.date === m.date && x.type === 'lunch') ? 'bg-mint-500 border-mint-500' : 'bg-white border-gray-300 group-hover:border-mint-400'}`}>
                                          {formData.meals?.some(x => x.date === m.date && x.type === 'lunch') && <CheckCircle size={14} className="text-white" />}
                                       </div>
                                       <input type="checkbox" className="hidden"
                                          disabled={isLunchLocked(selectedEvent.startDate)}
                                          checked={formData.meals?.some(x => x.date === m.date && x.type === 'lunch')}
                                          onChange={() => handleMealToggle(m.date, 'lunch')}
                                       /> <span className="font-bold text-gray-700 text-sm sm:text-base">午</span>
                                    </label>
                                 )}
                                 {m.dinner && (
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                       <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-md border-2 flex items-center justify-center transition ${formData.meals?.some(x => x.date === m.date && x.type === 'dinner') ? 'bg-mint-500 border-mint-500' : 'bg-white border-gray-300 group-hover:border-mint-400'}`}>
                                          {formData.meals?.some(x => x.date === m.date && x.type === 'dinner') && <CheckCircle size={14} className="text-white" />}
                                       </div>
                                       <input type="checkbox" className="hidden"
                                          disabled={isLunchLocked(selectedEvent.startDate)}
                                          checked={formData.meals?.some(x => x.date === m.date && x.type === 'dinner')}
                                          onChange={() => handleMealToggle(m.date, 'dinner')}
                                       /> <span className="font-bold text-gray-700 text-sm sm:text-base">晚</span>
                                    </label>
                                 )}
                              </div>
                           </div>
                        ))}
                     </div>
                  </section>

                  <div className="space-y-3">
                     {Object.keys(errors).length > 0 && (
                        <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex items-start gap-3">
                           <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
                           <div>
                              <p className="font-bold text-red-700">無法送出，請檢查以下項目：</p>
                              <ul className="text-red-600 text-sm list-disc list-inside font-medium mt-1">
                                 {Object.values(errors).map((err, i) => <li key={i}>{err}</li>)}
                              </ul>
                           </div>
                        </div>
                     )}
                     <button
                        type="submit"
                        className="w-full py-5 bg-vibrant-500 hover:bg-vibrant-600 text-white rounded-2xl font-black shadow-lg shadow-vibrant-500/30 text-xl transition transform active:scale-95 tracking-widest"
                     >
                        {isEditing ? '更新報名' : '確認報名'}
                     </button>
                  </div>
               </form>
            )}
         </div>

         {/* --- HISTORY MODAL --- */}
         {showHistoryModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
               <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl animate-pop max-h-[80vh] flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                     <h2 className="text-2xl font-extrabold text-gray-800">歷史服事紀錄</h2>
                     <button onClick={() => setShowHistoryModal(false)}><X className="text-gray-400 hover:text-gray-600" /></button>
                  </div>
                  <div className="overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                     {signups.filter(s => s.volunteerId === user.id).length === 0 && <p className="text-gray-400 text-center py-10">尚無紀錄</p>}
                     {signups.filter(s => s.volunteerId === user.id)
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

         {/* --- CHART MODAL (NOW A GRID) --- */}
         {showChartModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
               <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl animate-pop">
                  <div className="flex justify-between items-center mb-6">
                     <h2 className="text-2xl font-extrabold text-gray-800">每月服事統計</h2>
                     <button onClick={() => setShowChartModal(false)}><X className="text-gray-400 hover:text-gray-600" /></button>
                  </div>

                  <div className="flex gap-2 mb-6 items-center justify-center bg-gray-50 p-2 rounded-xl">
                     <input type="month" className="bg-white border border-gray-300 rounded-lg px-2 py-1 text-sm font-bold" value={chartRange.start} onChange={e => setChartRange({ ...chartRange, start: e.target.value })} />
                     <span className="text-gray-400">~</span>
                     <input type="month" className="bg-white border border-gray-300 rounded-lg px-2 py-1 text-sm font-bold" value={chartRange.end} onChange={e => setChartRange({ ...chartRange, end: e.target.value })} />
                  </div>

                  {/* REPLACED CHART WITH GRID */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                     {getMonthlyStats().map(([month, count]) => (
                        <div key={month} className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition ${count > 0 ? 'bg-vibrant-50 border-vibrant-200' : 'bg-gray-50 border-gray-100'}`}>
                           <span className="text-gray-500 font-bold text-sm mb-1">{month}</span>
                           <span className={`text-3xl font-black ${count > 0 ? 'text-vibrant-500' : 'text-gray-300'}`}>{count}</span>
                           <span className="text-xs text-gray-400 font-bold mt-1">次</span>
                        </div>
                     ))}
                     {getMonthlyStats().length === 0 && <div className="col-span-3 text-center text-gray-400 py-4">此區間無數據</div>}
                  </div>
               </div>
            </div>
         )}

      </div>
   );
};