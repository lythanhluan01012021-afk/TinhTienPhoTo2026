import React from 'react';
import { useApp } from '../context/AppContext';
import { 
  Calculator, 
  Settings, 
  Receipt, 
  Printer,
  Cloud,
  Layers,
  Download,
  CloudUpload,
  CloudDownload,
  ExternalLink,
  RotateCcw,
  WifiOff
} from 'lucide-react';

export const Navbar = () => {
  const { 
    currentTab, 
    setCurrentTab, 
    settings,
    syncStatus,
    isGroupedView,
    setIsGroupedView,
    handleExportExcel,
    handleOpenDatabase,
    setIsPrintModalOpen,
    syncToGoogleSheets,
    fetchFromGoogleSheets,
    clearBillingGrid,
    totalClassDebts,
    isOnline
  } = useApp();

  return (
    <header 
      className="no-print app-header-sticky" 
      style={{ 
        position: 'sticky', 
        top: 0, 
        zIndex: 1000, 
        backgroundColor: 'var(--bg-main)',
        paddingTop: '8px',
        paddingBottom: '10px',
        marginBottom: '12px',
        boxShadow: '0 4px 16px rgba(19, 43, 79, 0.06)'
      }}
    >
      {/* Top Banner: School Branding (Left) + Fixed Action Toolbar (Right) */}
      <div 
        className="neu-card" 
        style={{ 
          padding: '10px 16px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          flexWrap: 'nowrap',
          gap: '12px',
          overflowX: 'auto'
        }}
      >
        {/* School Branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <div 
            className="neu-card-sm"
            style={{ 
              width: '38px', 
              height: '38px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: 'var(--color-primary)',
              background: '#e8eef5',
              flexShrink: 0
            }}
          >
            <Printer size={22} />
          </div>
          <div style={{ whiteSpace: 'nowrap' }}>
            <h1 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-bold)', textTransform: 'uppercase', letterSpacing: '0.3px', lineHeight: 1.2, margin: 0 }}>
              TÍNH TIỀN PHOTO HỌC LIỆU
            </h1>
            <p style={{ fontSize: '12px', color: 'var(--color-primary)', fontWeight: '600', margin: '2px 0 0 0' }}>
              {settings.departmentName} • Niên khóa {settings.schoolYear}
            </p>
          </div>
        </div>

        {/* Action Buttons Toolbar: Fixed Single-Row, Never Wraps on Browser Resize */}
        <div 
          className="header-action-toolbar"
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            flexWrap: 'nowrap',
            flexShrink: 0,
            padding: '2px 0'
          }}
        >
          {/* Đèn báo Ngoại Tuyến nếu mất mạng */}
          {!isOnline && (
            <span 
              style={{
                fontSize: '12px',
                fontWeight: 'bold',
                color: '#c2410c',
                background: '#ffedd5',
                border: '1px solid #fed7aa',
                padding: '5px 10px',
                borderRadius: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
              title="Đang ngoại tuyến: Hệ thống đang lưu trực tiếp vào CSDL_PHOTO_LOCAL.xlsx trên máy"
            >
              <WifiOff size={14} /> Ngoại Tuyến
            </span>
          )}

          {/* 1. Toggle Grouped View */}
          <button 
            onClick={() => {
              setIsGroupedView(!isGroupedView);
              if (currentTab !== 'billing') setCurrentTab('billing');
            }}
            className={`neu-btn ${isGroupedView ? 'active' : ''}`}
            title="Chuyển đổi giữa Bảng Chi Tiết và Bảng Tổng Hợp / Công Nợ Theo Lớp"
            style={{ fontSize: '13px', padding: '7px 13px', whiteSpace: 'nowrap', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Layers size={15} color="var(--color-primary)" />
            <span>{isGroupedView ? 'Hiện Bảng Chi Tiết' : 'Tổng Theo Lớp'}</span>
            {totalClassDebts > 0 && !isGroupedView && (
              <span 
                style={{
                  width: '8px',
                  height: '8px',
                  backgroundColor: '#ef4444',
                  borderRadius: '50%',
                  display: 'inline-block',
                  boxShadow: '0 0 6px #ef4444'
                }}
                title="Đang có lớp ghi nhận nợ/thiếu"
              />
            )}
          </button>

          {/* 2. Print A4 */}
          <button 
            onClick={() => setIsPrintModalOpen(true)}
            className="neu-btn neu-btn-primary"
            title="Mở bảng xem trước và in ấn chuẩn mẫu A4"
            style={{ fontSize: '13px', padding: '7px 14px', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            <Printer size={15} />
            <span>In Ấn A4</span>
          </button>

          {/* 3. Save CSDL (Google Sheets + File Excel Máy) */}
          <button 
            onClick={() => syncToGoogleSheets(false)}
            className="neu-btn neu-btn-success"
            title="Lưu đồng thời vào Google Sheets trên Drive và File Excel trên máy tính"
            style={{ fontSize: '13px', padding: '7px 14px', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            <CloudUpload size={15} />
            <span>Lưu CSDL</span>
          </button>

          {/* 4. Fetch from Drive */}
          <button 
            onClick={fetchFromGoogleSheets}
            className="neu-btn"
            title="Tải toàn bộ dữ liệu từ Google Sheets trên Drive về máy"
            style={{ fontSize: '13px', padding: '7px 13px', color: '#1b5ebe', fontWeight: '600', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            <CloudDownload size={15} />
            <span>Tải Từ Drive</span>
          </button>

          {/* 5. Export Excel */}
          <button 
            onClick={handleExportExcel}
            className="neu-btn"
            title="Tải toàn bộ CSDL 4 sheet thành file Excel (.xlsx) về máy"
            style={{ fontSize: '13px', padding: '7px 13px', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            <Download size={15} color="var(--color-primary)" />
            <span>Xuất Excel</span>
          </button>

          {/* 6. Xem CSDL (Mở nhanh Google Sheets CSDL) */}
          <button 
            onClick={handleOpenDatabase}
            className="neu-btn"
            title="Mở nhanh bảng tính Google Sheets CSDL trên Google Drive"
            style={{ 
              fontSize: '13px', 
              padding: '7px 13px', 
              whiteSpace: 'nowrap', 
              flexShrink: 0,
              color: '#065f46',
              backgroundColor: '#ecfdf5',
              border: '1px solid #a7f3d0',
              fontWeight: '700'
            }}
          >
            <ExternalLink size={15} color="#059669" />
            <span>Xem CSDL</span>
          </button>

          {/* 7. Clear Grid (Làm mới) */}
          <button 
            onClick={clearBillingGrid}
            className="neu-btn"
            title="Làm mới / Xóa toàn bộ bảng tính hiện tại để bắt đầu phiên mới"
            style={{ padding: '7px 11px', color: 'var(--color-danger)', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            <RotateCcw size={15} />
          </button>
        </div>
      </div>

      {/* Navigation Tab Bar: Fixed Single-Row */}
      <div 
        style={{ 
          marginTop: '10px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          flexWrap: 'nowrap',
          gap: '12px',
          overflowX: 'auto'
        }}
      >
        <div className="nav-tab-container" style={{ flexWrap: 'nowrap', flexShrink: 0 }}>
          <button 
            className={`nav-tab ${currentTab === 'billing' ? 'active' : ''}`}
            onClick={() => setCurrentTab('billing')}
            style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            <Calculator size={17} />
            <span>Trang 1: Bàn Tính Tiền Photo</span>
          </button>

          <button 
            className={`nav-tab ${currentTab === 'admin' ? 'active' : ''}`}
            onClick={() => setCurrentTab('admin')}
            style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            <Settings size={17} />
            <span>Trang 2: Dashboard Admin & CSDL</span>
          </button>

          <button 
            className={`nav-tab ${currentTab === 'cashflow' ? 'active' : ''}`}
            onClick={() => setCurrentTab('cashflow')}
            style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            <Receipt size={17} />
            <span>Sổ Quỹ Thu / Chi</span>
          </button>
        </div>

        {/* Sync notification message if active */}
        {syncStatus.message && (
          <div 
            className="neu-card-sm"
            style={{ 
              padding: '6px 14px', 
              fontSize: '13px',
              fontWeight: '600',
              color: syncStatus.status === 'error' ? 'var(--color-danger)' : 'var(--color-success)',
              background: '#f4f8fc',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            <Cloud size={15} />
            <span>{syncStatus.message}</span>
          </div>
        )}
      </div>
    </header>
  );
};
