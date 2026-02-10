import React from 'react';
import { LayoutDashboard, UserCircle, LogOut, Settings, CalendarCheck } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentUser: { name: string; role: string } | null;
  onSwitchUser: () => void;
  activeView: 'main' | 'settings';
  onNavigate: (view: 'main' | 'settings') => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentUser, onSwitchUser, activeView, onNavigate }) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans tracking-wider leading-loose">
      {/* Header */}
      <nav className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Logo"
            className="w-10 h-10 object-contain"
          />
          {/* Removed hidden sm:block to show on mobile */}
          <span className="font-bold text-gray-700 text-xl tracking-widest block">禱告山祭壇</span>
        </div>

        <div className="flex items-center gap-6">
          {currentUser && (
            <>
              {/* Desktop/Tablet Navigation */}
              <div className="hidden md:flex gap-4 mr-4">
                <button
                  onClick={() => onNavigate('main')}
                  className={`flex items-center gap-2 font-bold transition ${activeView === 'main' ? 'text-vibrant-500' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  {currentUser?.role === 'volunteer' ? <CalendarCheck size={20} /> : <LayoutDashboard size={20} />}
                  {currentUser?.role === 'volunteer' ? '活動報名' : '管理後台'}
                </button>
                <button
                  onClick={() => onNavigate('settings')}
                  className={`flex items-center gap-2 font-bold transition ${activeView === 'settings' ? 'text-vibrant-500' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <Settings size={20} />
                  設定
                </button>
              </div>

              <div className="text-sm text-right hidden sm:block leading-tight border-l pl-6 border-gray-200">
                <div className="font-bold text-gray-800">{currentUser.name}</div>
                <div className="text-gray-400 capitalize text-xs">
                  {currentUser.role === 'core_admin' ? '核心同工' :
                    currentUser.role === 'admin' ? '同工' : '義工'}
                </div>
              </div>
            </>
          )}
          <button
            onClick={onSwitchUser}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition"
            title="登出"
          >
            <LogOut size={24} />
          </button>
        </div>
      </nav>

      <main className="flex-1 w-full text-lg">
        {children}
      </main>

      {/* Bottom Nav for Mobile */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 py-2 px-8 flex justify-between items-center z-40 text-xs text-gray-400">
        {/* LEFT BUTTON: SETTINGS */}
        <div
          onClick={() => onNavigate('settings')}
          className={`flex flex-col items-center gap-0.5 cursor-pointer transition ${activeView === 'settings' ? 'text-vibrant-500' : 'hover:text-gray-600'}`}
        >
          <Settings size={22} />
          <span className="font-bold transform scale-90">設定</span>
        </div>

        {/* RIGHT BUTTON: MAIN (Admin: Dashboard, Vol: Portal) */}
        <div
          onClick={() => onNavigate('main')}
          className={`flex flex-col items-center gap-0.5 cursor-pointer transition ${activeView === 'main' ? (currentUser?.role === 'admin' || currentUser?.role === 'core_admin' ? 'text-mint-600' : 'text-vibrant-500') : 'hover:text-gray-600'}`}
        >
          {currentUser?.role === 'volunteer' ? <CalendarCheck size={22} /> : <LayoutDashboard size={22} />}
          <span className="font-bold transform scale-90">{currentUser?.role === 'volunteer' ? '報名' : '主畫面'}</span>
        </div>
      </div>
    </div>
  );
};