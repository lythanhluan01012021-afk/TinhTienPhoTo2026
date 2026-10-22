import React from 'react';
import { useApp } from '../context/AppContext';
import { 
  Calculator, 
  Settings, 
  Receipt, 
  Printer, 
  Cloud, 
  HardDrive, 
  Calendar,
  FileSpreadsheet
} from 'lucide-react';

export const Navbar = () => {
  const { 
    currentTab, 
    setCurrentTab, 
    settings, 
    setIsPrintModalOpen,
    syncStatus,
    syncToGoogleSheets
  } = useApp();

  const today = new Date();
  const formattedDate = today.toLocaleDateString('vi-VN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <header className="no-print" style={{ marginBottom: '20px' }}>
      {/* Top Banner */}
      <div 
        className="neu-card" 
        style={{ 
          padding: '16px 24px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '15px'
        }}
      >
        {/* School Branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div 
            className="neu-card-sm"
            style={{ 
              width: '48px', 
              height: '48px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: 'var(--color-primary)',
              background: '#e8eef5'
            }}
          >
            <Printer size={28} />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text-bold)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              TÍNH TIỀN PHOTO HỌC LIỆU
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--color-primary)', fontWeight: '600' }}>
              {settings.departmentName} • Niên khóa {settings.schoolYear}
            </p>
          </div>
        </div>

        {/* Date & Google Drive Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
          <div 
            className="neu-card-sm"
            style={{ 
              padding: '6px 14px', 
              fontSize: '13.5px', 
              color: 'var(--text-sub)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Calendar size={15} color="var(--color-primary)" />
            <span style={{ textTransform: 'capitalize' }}>{formattedDate}</span>
          </div>

          <a 
            href={settings.driveFolderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="neu-card-sm"
            title="Nhấn để mở thư mục Google Drive lưu CSDL"
            style={{ 
              padding: '6px 14px', 
              fontSize: '13px', 
              color: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              textDecoration: 'none',
              fontWeight: '600'
            }}
          >
            <HardDrive size={15} />
            <span>Google Drive: Thư mục CSDL</span>
          </a>

          {/* Quick Print A4 Trigger */}
          <button 
            onClick={() => setIsPrintModalOpen(true)}
            className="neu-btn neu-btn-primary"
            style={{ padding: '8px 16px', fontSize: '14.5px' }}
          >
            <Printer size={16} />
            <span>In Ấn Chuẩn A4</span>
          </button>
        </div>
      </div>

      {/* Navigation Tab Bar */}
      <div 
        style={{ 
          marginTop: '15px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div className="nav-tab-container">
          <button 
            className={`nav-tab ${currentTab === 'billing' ? 'active' : ''}`}
            onClick={() => setCurrentTab('billing')}
          >
            <Calculator size={18} />
            <span>Trang 1: Bàn Tính Tiền Photo</span>
          </button>

          <button 
            className={`nav-tab ${currentTab === 'admin' ? 'active' : ''}`}
            onClick={() => setCurrentTab('admin')}
          >
            <Settings size={18} />
            <span>Trang 2: Dashboard Admin & CSDL</span>
          </button>

          <button 
            className={`nav-tab ${currentTab === 'cashflow' ? 'active' : ''}`}
            onClick={() => setCurrentTab('cashflow')}
          >
            <Receipt size={18} />
            <span>Sổ Quỹ Thu / Chi</span>
          </button>
        </div>

        {/* Sync notification message if active */}
        {syncStatus.message && (
          <div 
            className="neu-card-sm"
            style={{ 
              padding: '8px 16px', 
              fontSize: '13.5px',
              fontWeight: '600',
              color: syncStatus.status === 'error' ? 'var(--color-danger)' : 'var(--color-success)',
              background: '#f4f8fc',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              animation: 'fadeIn 0.3s ease'
            }}
          >
            <Cloud size={16} />
            <span>{syncStatus.message}</span>
          </div>
        )}
      </div>
    </header>
  );
};
