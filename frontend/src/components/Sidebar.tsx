import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Users,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Database,
  Building2,
  Briefcase,
  ArrowLeftRight,
  Factory,
  UserCircle,
  Network,
  Search,
  PieChart,
  FileSpreadsheet,
} from 'lucide-react';
import { useSidebar } from '@/contexts/SidebarContext';

interface NavItem {
  path: string;
  icon: React.ElementType;
  label: string;
}

interface NavSection {
  id: string;
  label: string;
  icon: React.ElementType;
  items: NavItem[];
  accentColor: string;
}

const mainNavItems: NavItem[] = [
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

const preqinSection: NavSection = {
  id: 'preqin',
  label: 'Preqin Data',
  icon: Database,
  accentColor: 'from-amber-500 to-orange-500',
  items: [
    { path: '/preqin/firms', icon: Building2, label: 'Firms' },
    { path: '/preqin/funds', icon: Briefcase, label: 'Funds' },
    { path: '/preqin/deals', icon: ArrowLeftRight, label: 'Deals' },
    { path: '/preqin/companies', icon: Factory, label: 'Companies' },
    { path: '/preqin/people', icon: UserCircle, label: 'People' },
    { path: '/preqin/network', icon: Network, label: 'Co-Investment Network' },
    { path: '/preqin/search', icon: Search, label: 'Search' },
    { path: '/preqin/stats', icon: PieChart, label: 'Stats Dashboard' },
  ],
};

const cleanDataSection: NavSection = {
  id: 'clean-data',
  label: 'Private Market Data',
  icon: FileSpreadsheet,
  accentColor: 'from-emerald-500 to-teal-500',
  items: [
    { path: '/clean-data/gp', icon: Building2, label: 'GP Dataset' },
    { path: '/clean-data/lp', icon: Users, label: 'LP Dataset' },
    { path: '/clean-data/deals', icon: ArrowLeftRight, label: 'Deals Export' },
    { path: '/clean-data/funds', icon: Briefcase, label: 'Private Funds' },
  ],
};

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isCollapsed, setIsCollapsed } = useSidebar();
  const [preqinExpanded, setPreqinExpanded] = useState(true);
  const [cleanDataExpanded, setCleanDataExpanded] = useState(true);

  const handleNavClick = (path: string) => {
    navigate(path);
  };

  const isActiveRoute = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const isPreqinActive = preqinSection.items.some(item => isActiveRoute(item.path));
  const isCleanDataActive = cleanDataSection.items.some(item => isActiveRoute(item.path));

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
        {/* Main Navigation Items */}
        <div className="space-y-1 px-2">
          {mainNavItems.map((item) => {
            const isActive = isActiveRoute(item.path);
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

        {/* Separator */}
        <div className="my-4 mx-4 border-t border-slate-700/50" />

        {/* Preqin Section */}
        <div className="px-2">
          {/* Section Header */}
          <button
            onClick={() => !isCollapsed && setPreqinExpanded(!preqinExpanded)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200 ${
              isPreqinActive
                ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30'
                : 'hover:bg-slate-800/50'
            }`}
            title={isCollapsed ? 'Preqin Data' : undefined}
          >
            <div className="flex items-center space-x-3">
              <div className={`w-6 h-6 rounded flex items-center justify-center bg-gradient-to-br ${preqinSection.accentColor}`}>
                <Database className="w-3.5 h-3.5 text-white" />
              </div>
              {!isCollapsed && (
                <span className={`text-sm font-semibold ${isPreqinActive ? 'text-amber-400' : 'text-slate-300'}`}>
                  {preqinSection.label}
                </span>
              )}
            </div>
            {!isCollapsed && (
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                  preqinExpanded ? 'rotate-0' : '-rotate-90'
                }`}
              />
            )}
          </button>

          {/* Tooltip for collapsed section header */}
          {isCollapsed && (
            <div className="relative group">
              <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-2 px-2 py-1 bg-slate-800 text-white text-sm rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50">
                Preqin Data
              </div>
            </div>
          )}

          {/* Section Items */}
          {(preqinExpanded || isCollapsed) && (
            <div className={`space-y-0.5 ${isCollapsed ? 'mt-1' : 'mt-1 ml-2'}`}>
              {preqinSection.items.map((item) => {
                const isActive = isActiveRoute(item.path);
                const Icon = item.icon;

                return (
                  <div key={item.path} className="relative group">
                    <button
                      onClick={() => handleNavClick(item.path)}
                      className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-all duration-200 ${
                        isActive
                          ? 'bg-amber-500/20 text-amber-400 border-l-2 border-amber-500'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                      }`}
                      title={isCollapsed ? item.label : undefined}
                    >
                      <Icon className={`w-4 h-4 flex-shrink-0 ${
                        isActive ? 'text-amber-400' : 'text-slate-500 group-hover:text-white'
                      }`} />
                      {!isCollapsed && (
                        <span className="text-sm truncate">{item.label}</span>
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
          )}
        </div>

        {/* Separator */}
        <div className="my-4 mx-4 border-t border-slate-700/50" />

        {/* Clean Data Section */}
        <div className="px-2">
          {/* Section Header */}
          <button
            onClick={() => !isCollapsed && setCleanDataExpanded(!cleanDataExpanded)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200 ${
              isCleanDataActive
                ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30'
                : 'hover:bg-slate-800/50'
            }`}
            title={isCollapsed ? 'Frequent Clean Data' : undefined}
          >
            <div className="flex items-center space-x-3">
              <div className={`w-6 h-6 rounded flex items-center justify-center bg-gradient-to-br ${cleanDataSection.accentColor}`}>
                <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
              </div>
              {!isCollapsed && (
                <span className={`text-sm font-semibold ${isCleanDataActive ? 'text-emerald-400' : 'text-slate-300'}`}>
                  {cleanDataSection.label}
                </span>
              )}
            </div>
            {!isCollapsed && (
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                  cleanDataExpanded ? 'rotate-0' : '-rotate-90'
                }`}
              />
            )}
          </button>

          {/* Section Items */}
          {(cleanDataExpanded || isCollapsed) && (
            <div className={`space-y-0.5 ${isCollapsed ? 'mt-1' : 'mt-1 ml-2'}`}>
              {cleanDataSection.items.map((item) => {
                const isActive = isActiveRoute(item.path);
                const Icon = item.icon;

                return (
                  <div key={item.path} className="relative group">
                    <button
                      onClick={() => handleNavClick(item.path)}
                      className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-all duration-200 ${
                        isActive
                          ? 'bg-emerald-500/20 text-emerald-400 border-l-2 border-emerald-500'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                      }`}
                      title={isCollapsed ? item.label : undefined}
                    >
                      <Icon className={`w-4 h-4 flex-shrink-0 ${
                        isActive ? 'text-emerald-400' : 'text-slate-500 group-hover:text-white'
                      }`} />
                      {!isCollapsed && (
                        <span className="text-sm truncate">{item.label}</span>
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
          )}
        </div>
      </nav>
    </div>
  );
}
