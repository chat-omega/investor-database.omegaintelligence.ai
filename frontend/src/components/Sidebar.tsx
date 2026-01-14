import { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
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

const fundAnalystSection: NavSection = {
  id: 'fund-analyst',
  label: 'Fund Analyst',
  icon: BarChart3,
  accentColor: 'from-blue-500 to-indigo-500',
  items: [
    { path: '/gp-database', icon: BarChart3, label: 'GP Analyst' },
    { path: '/lp-database', icon: Users, label: 'LP Analyst' },
    { path: '/fund-analyst/data', icon: FileSpreadsheet, label: 'My Data' },
  ],
};

const privateMarketSection: NavSection = {
  id: 'private-market',
  label: 'Private Market Data',
  icon: FileSpreadsheet,
  accentColor: 'from-emerald-500 to-teal-500',
  items: [
    // Clean Data items first
    { path: '/clean-data/gp', icon: Building2, label: 'GP Dataset' },
    { path: '/clean-data/lp', icon: Users, label: 'LP Dataset' },
    { path: '/clean-data/deals', icon: ArrowLeftRight, label: 'Deals Export' },
    { path: '/clean-data/funds', icon: Briefcase, label: 'Private Funds' },
    { path: '/secondary-funds', icon: Database, label: 'Secondary Funds' },
    // Preqin items below
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

export function Sidebar() {
  const location = useLocation();
  const { isCollapsed, setIsCollapsed } = useSidebar();
  const [fundAnalystExpanded, setFundAnalystExpanded] = useState(true);
  const [privateMarketExpanded, setPrivateMarketExpanded] = useState(true);

  const isActiveRoute = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const isFundAnalystActive = fundAnalystSection.items.some(item => isActiveRoute(item.path));
  const isPrivateMarketActive = privateMarketSection.items.some(item => isActiveRoute(item.path));

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
        {/* Fund Analyst Section */}
        <div className="px-2 mb-2">
          {/* Section Header */}
          <button
            onClick={() => !isCollapsed && setFundAnalystExpanded(!fundAnalystExpanded)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200 ${
              isFundAnalystActive
                ? 'bg-gradient-to-r from-blue-500/20 to-indigo-500/20 border border-blue-500/30'
                : 'hover:bg-slate-800/50'
            }`}
            title={isCollapsed ? 'Fund Analyst' : undefined}
          >
            <div className="flex items-center space-x-3">
              <div className={`w-6 h-6 rounded flex items-center justify-center bg-gradient-to-br ${fundAnalystSection.accentColor}`}>
                <BarChart3 className="w-3.5 h-3.5 text-white" />
              </div>
              {!isCollapsed && (
                <span className={`text-sm font-semibold ${isFundAnalystActive ? 'text-blue-400' : 'text-slate-300'}`}>
                  {fundAnalystSection.label}
                </span>
              )}
            </div>
            {!isCollapsed && (
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                  fundAnalystExpanded ? 'rotate-0' : '-rotate-90'
                }`}
              />
            )}
          </button>

          {/* Section Items */}
          {(fundAnalystExpanded || isCollapsed) && (
            <div className={`space-y-0.5 ${isCollapsed ? 'mt-1' : 'mt-1 ml-2'}`}>
              {fundAnalystSection.items.map((item) => {
                const isActive = isActiveRoute(item.path);
                const Icon = item.icon;

                return (
                  <div key={item.path} className="relative group">
                    <Link
                      to={item.path}
                      className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-all duration-200 ${
                        isActive
                          ? 'bg-blue-500/20 text-blue-400 border-l-2 border-blue-500'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                      }`}
                      title={isCollapsed ? item.label : undefined}
                    >
                      <Icon className={`w-4 h-4 flex-shrink-0 ${
                        isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-white'
                      }`} />
                      {!isCollapsed && (
                        <span className="text-sm truncate">{item.label}</span>
                      )}
                    </Link>

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
        <div className="my-2 mx-4 border-t border-slate-700/50" />

        {/* Private Market Data Section */}
        <div className="px-2">
          {/* Section Header */}
          <button
            onClick={() => !isCollapsed && setPrivateMarketExpanded(!privateMarketExpanded)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200 ${
              isPrivateMarketActive
                ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30'
                : 'hover:bg-slate-800/50'
            }`}
            title={isCollapsed ? 'Private Market Data' : undefined}
          >
            <div className="flex items-center space-x-3">
              <div className={`w-6 h-6 rounded flex items-center justify-center bg-gradient-to-br ${privateMarketSection.accentColor}`}>
                <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
              </div>
              {!isCollapsed && (
                <span className={`text-sm font-semibold ${isPrivateMarketActive ? 'text-emerald-400' : 'text-slate-300'}`}>
                  {privateMarketSection.label}
                </span>
              )}
            </div>
            {!isCollapsed && (
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                  privateMarketExpanded ? 'rotate-0' : '-rotate-90'
                }`}
              />
            )}
          </button>

          {/* Section Items */}
          {(privateMarketExpanded || isCollapsed) && (
            <div className={`space-y-0.5 ${isCollapsed ? 'mt-1' : 'mt-1 ml-2'}`}>
              {privateMarketSection.items.map((item) => {
                const isActive = isActiveRoute(item.path);
                const Icon = item.icon;

                return (
                  <div key={item.path} className="relative group">
                    <Link
                      to={item.path}
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
                    </Link>

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
