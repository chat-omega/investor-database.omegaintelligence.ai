import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { QueryProvider } from '@/providers/QueryProvider';
import { GPDatabasePage } from '@/pages/GPDatabasePage';
import { LPDatabasePage } from '@/pages/LPDatabasePage';
import { SecondaryFundsPage } from '@/pages/SecondaryFundsPage';

// Sidebar layout component
function SidebarLayout() {
  const { isCollapsed } = useSidebar();

  return (
    <div className="min-h-screen bg-slate-900 flex overflow-hidden transition-colors duration-300">
      <Sidebar />
      <main
        className={`flex-1 transition-all duration-300 ease-in-out overflow-x-hidden ${
          isCollapsed ? 'ml-14' : 'ml-64'
        }`}
      >
        <div className="h-full overflow-y-auto">
          <Routes>
            <Route path="/gp-database" element={<GPDatabasePage />} />
            <Route path="/lp-database" element={<LPDatabasePage />} />
            <Route path="/secondary-funds" element={<SecondaryFundsPage />} />
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
