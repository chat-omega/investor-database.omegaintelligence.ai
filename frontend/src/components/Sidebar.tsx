import { useNavigate, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Users,
  ChevronLeft,
  ChevronRight,
  Database,
} from 'lucide-react';
import { useSidebar } from '@/contexts/SidebarContext';

interface NavItem {
  path: string;
  icon: React.ElementType;
  label: string;
}

const navItems: NavItem[] = [
  {
    path: '/gp-database',
    icon: BarChart3,
    label: 'GP Database',
  },
  {
    path: '/lp-database',
    icon: Users,
    label: 'LP Database',
  },
  {
    path: '/secondary-funds',
    icon: Database,
    label: 'Secondary Funds',
  },
];

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isCollapsed, setIsCollapsed } = useSidebar();

  const handleNavClick = (path: string) => {
    navigate(path);
  };

  return (
    <div
      className={`fixed left-0 top-0 h-full bg-gradient-to-b from-slate-900 to-slate-950 text-white transition-all duration-300 ease-in-out z-40 shadow-2xl flex flex-col ${
        isCollapsed ? 'w-14' : 'w-64'
      }`}
    >
      {/* Header with Logo and Collapse Button */}
      <div className="p-4 border-b border-slate-800/50">
        <div className="flex items-center space-x-3">
          {/* Collapse Button */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-8 h-8 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center justify-center shadow-lg transition-all duration-200 border border-slate-700/50 flex-shrink-0"
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4 text-slate-300" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-slate-300" />
            )}
          </button>

          {/* Logo section */}
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg">
              <Database className="w-5 h-5 text-white" />
            </div>
            {!isCollapsed && (
              <div className="overflow-hidden">
                <h1 className="text-lg font-bold text-white truncate">Investor DB</h1>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <div className="space-y-1 px-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path ||
                            location.pathname.startsWith(item.path + '/');
            const Icon = item.icon;

            return (
              <div key={item.path} className="relative group">
                <button
                  onClick={() => handleNavClick(item.path)}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${
                    isActive ? 'text-white' : 'text-slate-500 group-hover:text-white'
                  }`} />
                  {!isCollapsed && (
                    <span className="text-sm font-medium truncate">{item.label}</span>
                  )}
                </button>

                {/* Tooltip for collapsed state */}
                {isCollapsed && (
                  <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-2 px-2 py-1 bg-slate-800 text-white text-sm rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50">
                    {item.label}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
