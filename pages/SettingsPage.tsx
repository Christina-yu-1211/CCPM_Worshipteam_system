import React, { useState } from 'react';
import { User, Signup, MinistryEvent } from '../types';
import { UserCog, History, Shield, CheckCircle, Trash2, Key, Mail, ChevronDown } from 'lucide-react';

interface SettingsPageProps {
  currentUser: User;
  users: User[];
  signups: Signup[];
  events: MinistryEvent[];
  onUpdateUser: (data: Partial<User>) => void;
  onManageUser: (action: 'approve' | 'delete' | 'change_role', data: any) => void;
  onNavigate: (view: 'main' | 'settings') => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ 
  currentUser, users, signups, events, onUpdateUser, onManageUser, onNavigate 
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'admins'>('profile');
  const [formData, setFormData] = useState({
     name: currentUser.name,
     email: currentUser.email || '',
     password: currentUser.password || ''
  });

  const handleSaveProfile = (e: React.FormEvent) => {
      e.preventDefault();
      onUpdateUser({ ...currentUser, ...formData });
      alert('個人資料已更新！');
      onNavigate('main');
  };

  return (
    <div className="p-6 max-w-4xl mx-auto pb-32">
       <h1 className="text-3xl font-extrabold text-gray-800 mb-8 tracking-wide">設定與管理</h1>
       
       {/* Tabs */}
       <div className="flex gap-4 border-b border-gray-200 mb-8 overflow-x-auto no-scrollbar">
          <button 
             onClick={() => setActiveTab('profile')}
             className={`pb-3 px-4 font-bold text-lg whitespace-nowrap transition ${activeTab === 'profile' ? 'text-vibrant-500 border-b-4 border-vibrant-500' : 'text-gray-400'}`}
          >
             <UserCog size={20} className="inline mr-2"/> 個人資料
          </button>

          {(currentUser.role === 'admin' || currentUser.role === 'core_admin') && (
             <button 
                onClick={() => setActiveTab('admins')}
                className={`pb-3 px-4 font-bold text-lg whitespace-nowrap transition ${activeTab === 'admins' ? 'text-mint-600 border-b-4 border-mint-500' : 'text-gray-400'}`}
             >
                <Shield size={20} className="inline mr-2"/> 成員管理
             </button>
          )}
       </div>

       {/* --- PROFILE TAB --- */}
       {activeTab === 'profile' && (
          <form onSubmit={handleSaveProfile} className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6 animate-fade-in">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                   <label className="block text-gray-500 font-bold mb-2">姓名</label>
                   <input 
                      type="text" 
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full p-4 bg-gray-50 rounded-xl border-2 border-gray-200 focus:border-vibrant-300 outline-none font-bold text-gray-800"
                   />
                </div>
                <div>
                   <label className="block text-gray-500 font-bold mb-2">通知 Email</label>
                   <div className="relative">
                      <Mail className="absolute left-4 top-4 text-gray-400" size={20}/>
                      <input 
                          type="email" 
                          value={formData.email}
                          onChange={(e) => setFormData({...formData, email: e.target.value})}
                          className="w-full p-4 pl-12 bg-gray-50 rounded-xl border-2 border-gray-200 focus:border-vibrant-300 outline-none font-bold text-gray-800"
                      />
                   </div>
                </div>
                <div className="md:col-span-2">
                   <label className="block text-gray-500 font-bold mb-2">密碼</label>
                   <div className="relative">
                      <Key className="absolute left-4 top-4 text-gray-400" size={20}/>
                      <input 
                          type="text" 
                          value={formData.password}
                          onChange={(e) => setFormData({...formData, password: e.target.value})}
                          className="w-full p-4 pl-12 bg-gray-50 rounded-xl border-2 border-gray-200 focus:border-vibrant-300 outline-none font-bold text-gray-800"
                      />
                   </div>
                   <p className="text-xs text-gray-400 mt-2 ml-1">直接修改文字即可更新密碼</p>
                </div>
             </div>
             <button className="w-full py-4 bg-vibrant-500 text-white font-black text-xl rounded-2xl shadow-lg shadow-vibrant-500/30 hover:bg-vibrant-600 transition">
                儲存變更
             </button>
          </form>
       )}

       {/* --- ADMINS TAB (Admin) --- */}
       {activeTab === 'admins' && (
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 animate-fade-in">
             <h3 className="text-xl font-extrabold text-gray-700 mb-6">管理員列表</h3>
             <div className="space-y-4">
                {users.filter(u => u.role === 'admin' || u.role === 'core_admin').map(admin => (
                   <div key={admin.id} className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 gap-4">
                      <div>
                         <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-lg text-gray-800">{admin.name}</span>
                            {admin.role === 'core_admin' && <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-1 rounded font-bold">核心</span>}
                            {!admin.isApproved && <span className="bg-red-100 text-red-600 text-xs px-2 py-1 rounded font-bold">待審核</span>}
                         </div>
                         <div className="text-gray-500 text-sm">{admin.email}</div>
                      </div>
                      
                      <div className="flex items-center gap-3 w-full md:w-auto">
                         {/* Role Switcher (Core Admin Only) */}
                         {currentUser.role === 'core_admin' && admin.id !== currentUser.id && (
                             <select 
                                value={admin.role}
                                onChange={(e) => onManageUser('change_role', { id: admin.id, newRole: e.target.value })}
                                className="bg-white border border-gray-300 rounded-lg px-2 py-1 text-sm font-bold text-gray-600 outline-none"
                             >
                                 <option value="admin">一般同工</option>
                                 <option value="core_admin">核心同工</option>
                             </select>
                         )}

                         {!admin.isApproved && (
                            <button onClick={() => onManageUser('approve', admin)} className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition" title="核准">
                               <CheckCircle size={20} />
                            </button>
                         )}
                         {/* Core admin can delete others, but not themselves */}
                         {currentUser.role === 'core_admin' && admin.id !== currentUser.id && (
                            <button onClick={() => onManageUser('delete', admin)} className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition" title="刪除">
                               <Trash2 size={20} />
                            </button>
                         )}
                      </div>
                   </div>
                ))}
             </div>
          </div>
       )}
    </div>
  );
};