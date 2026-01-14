import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { QueryProvider } from '@/providers/QueryProvider';
import { GPDatabasePage } from '@/pages/GPDatabasePage';
import { LPDatabasePage } from '@/pages/LPDatabasePage';
import { SecondaryFundsPage } from '@/pages/SecondaryFundsPage';

// Preqin Pages
import { PreqinFirmsPage } from '@/pages/preqin/PreqinFirmsPage';
import { PreqinFundsPage } from '@/pages/preqin/PreqinFundsPage';
import { PreqinDealsPage } from '@/pages/preqin/PreqinDealsPage';
import { PreqinCompaniesPage } from '@/pages/preqin/PreqinCompaniesPage';
import { PreqinPeoplePage } from '@/pages/preqin/PreqinPeoplePage';
import { PreqinCoInvestmentPage } from '@/pages/preqin/PreqinCoInvestmentPage';
import { PreqinSearchPage } from '@/pages/preqin/PreqinSearchPage';
import { PreqinStatsPage } from '@/pages/preqin/PreqinStatsPage';

// Clean Data Pages
import { CleanDataGPPage } from '@/pages/clean-data/CleanDataGPPage';
import { CleanDataLPPage } from '@/pages/clean-data/CleanDataLPPage';
import { CleanDataDealsPage } from '@/pages/clean-data/CleanDataDealsPage';
import { CleanDataFundsPage } from '@/pages/clean-data/CleanDataFundsPage';

// Fund Analyst Pages
import { FundAnalystDataPage, FundAnalystDataListPage } from '@/pages/FundAnalystDataPage';

// Sidebar layout component
function SidebarLayout() {
  const { isCollapsed } = useSidebar();

  return (
    <div className="h-screen bg-slate-900 flex overflow-hidden transition-colors duration-300">
      <Sidebar />
      <main
        className={`flex-1 transition-all duration-300 ease-in-out overflow-hidden ${
          isCollapsed ? 'ml-14' : 'ml-64'
        }`}
      >
        <div className="h-full overflow-auto">
          <Routes>
            {/* Existing routes */}
            <Route path="/gp-database" element={<GPDatabasePage />} />
            <Route path="/lp-database" element={<LPDatabasePage />} />
            <Route path="/secondary-funds" element={<SecondaryFundsPage />} />

            {/* Private Market Data routes */}
            <Route path="/data/gp" element={<CleanDataGPPage />} />
            <Route path="/data/lp" element={<CleanDataLPPage />} />
            <Route path="/data/deals-export" element={<CleanDataDealsPage />} />
            <Route path="/data/private-funds" element={<CleanDataFundsPage />} />
            <Route path="/data/firms" element={<PreqinFirmsPage />} />
            <Route path="/data/funds" element={<PreqinFundsPage />} />
            <Route path="/data/deals" element={<PreqinDealsPage />} />
            <Route path="/data/companies" element={<PreqinCompaniesPage />} />
            <Route path="/data/people" element={<PreqinPeoplePage />} />
            <Route path="/data/network" element={<PreqinCoInvestmentPage />} />
            <Route path="/data/search" element={<PreqinSearchPage />} />
            <Route path="/data/stats" element={<PreqinStatsPage />} />

            {/* Fund Analyst Data routes */}
            <Route path="/fund-analyst/data" element={<FundAnalystDataListPage />} />
            <Route path="/fund-analyst/data/:exportId" element={<FundAnalystDataPage />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <QueryProvider>
        <ThemeProvider>
          <SidebarProvider>
            <Routes>
              {/* Redirect root to GP database */}
              <Route path="/" element={<Navigate to="/gp-database" replace />} />

              {/* All routes use sidebar layout */}
              <Route path="/*" element={<SidebarLayout />} />
            </Routes>
          </SidebarProvider>
        </ThemeProvider>
      </QueryProvider>
    </Router>
  );
}

export default App;
