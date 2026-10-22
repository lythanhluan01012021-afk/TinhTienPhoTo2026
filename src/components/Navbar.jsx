import React from 'react';
import { useApp } from '../context/AppContext';
import { 
  Calculator, 
  Settings, 
  Receipt, 
  Printer,
  Cloud,
  Layers,
  Plus,
  Download,
  CloudUpload,
  CloudDownload,
  ExternalLink,
  RotateCcw,
  Calendar
} from 'lucide-react';

export const Navbar = () => {
  const { 
    currentTab, 
    setCurrentTab, 
    settings,
    syncStatus,
    isGroupedView,
    setIsGroupedView,
    handleAddBlankRow,
    handleExportExcel,
    handleOpenDatabase,
    setIsPrintModalOpen,
    syncToGoogleSheets,
    fetchFromGoogleSheets,
    clearBillingGrid,
    totalClassDebts,
    currentWeek,
    setCurrentWeek,
    availableWeeks,
    addWeek
  } = useApp();

  return (
    <header 
      className="no-print app-header-sticky" 
      style={{ 
        position: 'sticky', 
        top: 0, 
        zIndex: 1000, 
        backgroundColor: 'var(--bg-main)',
        paddingTop: '10px',
        paddingBottom: '10px',
        marginBottom: '16px',
        boxShadow: '0 4px 16px rgba(19, 43, 79, 0.05)'
      }}
    >
      {/* Top Banner: School Branding (Left) + Fixed Action Toolbar (Right) */}
      <div 
        className="neu-card" 
        style={{ 
          padding: '10px 18px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        {/* School Branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <div 
            className="neu-card-sm"
            style={{ 
              width: '42px', 
              height: '42px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: 'var(--color-primary)',
              background: '#e8eef5',
              flexShrink: 0
            }}
          >
            <Printer size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '17px', fontWeight: 'bold', color: 'var(--text-bold)', textTransform: 'uppercase', letterSpacing: '0.4px', lineHeight: 1.2, margin: 0 }}>
              TÍNH TIỀN PHOTO HỌC LIỆU
            </h1>
            <p style={{ fontSize: '12.5px', color: 'var(--color-primary)', fontWeight: '600', margin: '2px 0 0 0' }}>
              {settings.departmentName} • Niên khóa {settings.schoolYear}
            </p>
          </div>
        </div>

        {/* Action Buttons Toolbar: Fixed, Single-Row with Smooth Flow */}
        <div 
          className="header-action-toolbar"
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            flexWrap: 'nowrap',
            flexShrink: 0,
            overflowX: 'auto',
            padding: '2px 0',
            maxWidth: '100%'
          }}
        >
          {/* Nút Tuần: Danh sách sổ xuống từ tuần 1 đến tuần 6 + Nút thêm tuần mới */}
          <div 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px', 
              background: '#eff6ff', 
              padding: '4px 8px', 
              borderRadius: '8px', 
              border: '1.5px solid #93c5fd', 
              flexShrink: 0 
            }}
          >
            <Calendar size={14} color="#1d4ed8" />
            <select
              value={currentWeek}
              onChange={(e) => setCurrentWeek(e.target.value)}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid #93c5fd',
                fontSize: '13px',
                fontWeight: 'bold',
                color: '#1d4ed8',
                background: '#ffffff',
                cursor: 'pointer'
              }}
              title="Chọn tuần làm việc hiện tại"
            >
              {availableWeeks.map(w => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
            <button
              onClick={() => {
                const nextNum = availableWeeks.length + 1;
                const custom = window.prompt(`Nhập tên tuần mới cần thêm vào danh sách (Gợi ý: Tuần ${nextNum}):`, `Tuần ${nextNum}`);
                if (custom && custom.trim()) {
                  addWeek(custom.trim());
                }
              }}
              className="neu-btn"
              style={{ 
                padding: '4px 8px', 
                fontSize: '11.5px', 
                color: '#1d4ed8', 
                fontWeight: 'bold', 
                background: '#ffffff', 
                border: '1px solid #93c5fd',
                whiteSpace: 'nowrap'
              }}
              title="Thêm tuần mới vào danh sách tuần"
            >
              <Plus size={12} />
              <span>Thêm tuần</span>
            </button>
          </div>

          {/* 1. Toggle Grouped View */}
          <button 
            onClick={() => {
              setIsGroupedView(!isGroupedView);
              if (currentTab !== 'billing') setCurrentTab('billing');
            }}
            className={`neu-btn ${isGroupedView ? 'active' : ''}`}
            title="Xem tổng tiền & quản lý tiền nợ/thiếu theo từng Lớp học"
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

          {/* 2. Add Row */}
          <button 
            onClick={handleAddBlankRow}
            className="neu-btn"
            title="Thêm một dòng trống mới vào bảng tính"
            style={{ fontSize: '13px', padding: '7px 13px', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            <Plus size={15} color="var(--color-primary)" />
            <span>Thêm Dòng</span>
          </button>

          {/* 3. Export Excel */}
          <button 
            onClick={handleExportExcel}
            className="neu-btn"
            title="Tải bảng tính thành file Excel (.xlsx)"
            style={{ fontSize: '13px', padding: '7px 13px', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            <Download size={15} color="var(--color-primary)" />
            <span>Xuất Excel</span>
          </button>

          {/* 4. Print A4 */}
          <button 
            onClick={() => setIsPrintModalOpen(true)}
            className="neu-btn neu-btn-primary"
            title="Mở bảng in ấn theo chuẩn mẫu A4 chính thức"
            style={{ fontSize: '13px', padding: '7px 15px', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            <Printer size={15} />
            <span>In Ấn A4</span>
          </button>

          {/* 5. Fetch from Drive */}
          <button 
            onClick={fetchFromGoogleSheets}
            className="neu-btn"
            title="Tải toàn bộ dữ liệu đơn photo từ Google Sheets trên Drive về máy"
            style={{ fontSize: '13px', padding: '7px 13px', color: '#1b5ebe', fontWeight: '600', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            <CloudDownload size={15} />
            <span>Tải Từ Drive</span>
          </button>

          {/* 6. Save to Google Sheets */}
          <button 
            onClick={syncToGoogleSheets}
            className="neu-btn neu-btn-success"
            title="Lưu & Cập nhật lên Google Sheets (Tự động chống trùng lặp)"
            style={{ fontSize: '13px', padding: '7px 15px', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            <CloudUpload size={15} />
            <span>Lưu CSDL</span>
          </button>

          {/* 7. Xem CSDL (Mở nhanh Google Sheets CSDL) */}
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

          {/* 8. Clear Grid (Làm mới) */}
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
