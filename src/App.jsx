import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { TeacherFilterPanel } from './components/BillingPage/TeacherFilterPanel';
import { ExcelGrid } from './components/BillingPage/ExcelGrid';
import { GroupingView } from './components/BillingPage/GroupingView';
import { AdminDashboard } from './components/AdminPage/AdminDashboard';
import { CashflowPage } from './components/Cashflow/CashflowPage';
import { PrintViewA4 } from './components/PrintModal/PrintViewA4';

const MainLayout = () => {
  const { currentTab, isGroupedView } = useApp();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '16px 24px' }}>
      {/* Header & Tabs */}
      <Navbar />

      {/* Main View Area */}
      <main style={{ flex: '1', display: 'flex', flexDirection: 'column' }}>
        {currentTab === 'billing' && (
          <div 
            style={{ 
              display: 'grid', 
              gridTemplateColumns: 'minmax(300px, 3.2fr) minmax(600px, 6.8fr)', 
              gap: '20px',
              flex: '1',
              alignItems: 'stretch'
            }}
          >
            {/* Left Column: Teacher Filter & Assigned Classes */}
            <div className="left-sidebar" style={{ minWidth: '300px' }}>
              <TeacherFilterPanel />
            </div>

            {/* Right Column: Excel-like Grid or Grouped by Class View */}
            <div style={{ minWidth: '0' }}>
              {isGroupedView ? <GroupingView /> : <ExcelGrid />}
            </div>
          </div>
        )}

        {currentTab === 'admin' && (
          <div>
            <AdminDashboard />
          </div>
        )}

        {currentTab === 'cashflow' && (
          <div>
            <CashflowPage />
          </div>
        )}
      </main>

      {/* Dedicated A4 Print Engine Modal */}
      <PrintViewA4 />

      {/* Footer */}
      <footer 
        className="no-print"
        style={{
          marginTop: '25px',
          padding: '12px 0',
          textAlign: 'center',
          fontSize: '13px',
          color: 'var(--text-muted)',
          borderTop: '1px solid #d4dfec'
        }}
      >
        Hệ Thống Tính Tiền Photo & Quản Lý Học Đường • Giao Diện Neumorphism • Font Times New Roman • CSDL Google Sheets Drive
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
