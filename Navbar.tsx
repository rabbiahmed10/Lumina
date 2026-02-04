
import React from 'react';
import { ICONS } from '../constants';
import { User } from '../types';

interface NavbarProps {
  onTabChange: (tab: string) => void;
  activeTab: string;
}

const Navbar: React.FC<NavbarProps> = ({ onTabChange, activeTab }) => {
  const currentUser: User | null = (() => {
    try {
      const saved = localStorage.getItem('lumina_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  })();

  const navItems = [
    { id: 'home', icon: ICONS.Home },
    { id: 'friends', icon: ICONS.Friends },
    { id: 'create', icon: ICONS.Create },
    { id: 'chat', icon: ICONS.Chat },
    { id: 'profile', icon: 'avatar' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 z-[100] transition-colors duration-300">
      <div className="flex w-full justify-around items-end px-2 pb-[calc(12px+env(safe-area-inset-bottom))] md:pb-4 md:max-w-lg md:mx-auto">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          
          if (item.id === 'create') {
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className="relative -top-5 flex flex-col items-center justify-center transition-all duration-300 active:scale-90 group"
                aria-label="Create Post"
              >
                <div className="w-16 h-16 bg-brand-gradient rounded-[22px] flex items-center justify-center shadow-[0_8px_20px_rgba(244,42,65,0.2)] dark:shadow-[0_8px_25px_rgba(0,0,0,0.5)] group-hover:shadow-[0_12px_25px_rgba(0,106,78,0.3)] transform group-hover:-translate-y-1 transition-all border-4 border-white dark:border-slate-900">
                  <ICONS.Create 
                    className="w-8 h-8 text-white" 
                  />
                </div>
                <span className="absolute -bottom-6 text-[10px] font-bold text-[#f42a41] dark:text-[#f42a41] opacity-0 group-hover:opacity-100 transition-opacity">Create</span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center justify-center py-3 px-4 transition-all duration-200 active:scale-90 ${isActive ? 'text-[#006a4e] dark:text-[#f42a41]' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
              aria-label={item.id}
            >
              {item.id === 'profile' ? (
                <div className={`p-0.5 rounded-full border-2 transition-all duration-300 ${isActive ? 'border-[#f42a41] dark:border-[#f42a41] scale-110 shadow-sm' : 'border-transparent'}`}>
                  <img 
                    src={currentUser?.avatar || 'https://picsum.photos/seed/default/100/100'} 
                    alt="Profile" 
                    className="w-7 h-7 rounded-full object-cover bg-gray-100 dark:bg-slate-800 shadow-sm" 
                    loading="lazy"
                  />
                </div>
              ) : (
                typeof item.icon === 'function' && (
                  <item.icon 
                    className={`w-7 h-7 transition-all duration-300 ${isActive ? 'scale-110 text-[#006a4e] dark:text-[#f42a41]' : 'text-gray-400 dark:text-gray-500'}`} 
                    fill={isActive ? "currentColor" : "none"}
                    fillOpacity={isActive ? 0.2 : 0}
                  />
                )
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default Navbar;
