import React, { useMemo, useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  FileSpreadsheet, 
  Trash2, 
  Plus, 
  CloudUpload, 
  ShieldCheck, 
  Copy,
  FolderOpen,
  HardDrive,
  Wifi,
  WifiOff,
  Download,
  Save,
  PanelLeftOpen
} from 'lucide-react';
import { ReconciliationModal } from './ReconciliationModal';

export const ExcelGrid = () => {
  const { 
    billingItems, 
    updateBillingItem, 
    removeBillingItem, 
    classes,
    teachers,
    settings,
    totalClassDebts,
    classDebts,
    setIsGroupedView,
    currentWeek,
    setCurrentWeek,
    availableWeeks,
    addWeek,
    handleAddBlankRow,
    duplicateBillingItem,
    syncStatus,
    syncToGoogleSheets,
    focusedItemId,
    setFocusedItemId,
    localExcelStatus,
    isOnline,
    saveToLocalExcelFile,
    openLocalExcelFile,
    handleExportExcel,
    isSidebarCollapsed,
    setIsSidebarCollapsed
  } = useApp();

  const [isReconciliationModalOpen, setIsReconciliationModalOpen] = useState(false);

  // Tự động cuộn và đặt điểm chuột (focus) ngay tại dòng vừa thêm khi chọn GV và Lớp
  useEffect(() => {
    if (!focusedItemId) return;

    const timer = setTimeout(() => {
      const rowEl = document.getElementById(`grid-row-${focusedItemId}`);
      if (rowEl) {
        rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Đặt điểm chuột vào ô Môn Học / Nội dung hoặc Tên GV
        const teacherInput = document.getElementById(`input-teacher-${focusedItemId}`);
        const subjectInput = document.getElementById(`input-subject-${focusedItemId}`);

        if (teacherInput && (!teacherInput.value || teacherInput.value.trim() === '')) {
          teacherInput.focus();
        } else if (subjectInput) {
          subjectInput.focus();
          subjectInput.select();
        }
      }
    }, 120);

    // Xóa trạng thái viền xanh highlight sau 2.5 giây
    const unhighlightTimer = setTimeout(() => {
      setFocusedItemId(null);
    }, 2500);

    return () => {
      clearTimeout(timer);
      clearTimeout(unhighlightTimer);
    };
  }, [focusedItemId, setFocusedItemId]);

  // Xử lý thêm tuần mới
  const handleAddNewWeek = () => {
    const nextNum = availableWeeks.length + 1;
    const custom = window.prompt(`Nhập tên tuần mới cần thêm vào danh sách (Gợi ý: Tuần ${nextNum}):`, `Tuần ${nextNum}`);
    if (custom && custom.trim()) {
      const added = addWeek(custom.trim());
      setCurrentWeek(added);
    }
  };

  // Lọc các dòng photo thuộc về tuần đang chọn (currentWeek)
  const displayedItems = useMemo(() => {
    return billingItems.filter(item => (item.week || currentWeek) === currentWeek);
  }, [billingItems, currentWeek]);

  // Grand Total Calculations cho riêng tuần đang chọn
  const totals = useMemo(() => {
    let totalCopies = 0;
    let totalAmount = 0;
    let totalPaid = 0;
    let totalUnpaid = 0;
    const uniqueClasses = new Set();

    displayedItems.forEach(item => {
      const copies = (Number(item.studentCount) || 0) + (Number(item.extraCount) || 0);
      const amount = copies * (Number(item.unitPrice) || 0);
      totalCopies += copies;
      totalAmount += amount;
      if (item.isPaid) {
        totalPaid += amount;
      } else {
        totalUnpaid += amount;
      }
      if (item.className) uniqueClasses.add(item.className);
    });

    return {
      classesCount: uniqueClasses.size,
      totalCopies,
      totalAmount,
      totalPaid,
      totalUnpaid
    };
  }, [displayedItems]);

  // Format currency VNĐ
  const formatVND = (value) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value || 0);
  };

  return (
    <div className="neu-card" style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Compact Table Header Bar - Fixed Single-Row */}
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          flexWrap: 'nowrap', 
          flexShrink: 0,
          overflowX: 'auto',
          gap: '12px',
          borderBottom: '1.5px solid #d8e2ef',
          paddingBottom: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {isSidebarCollapsed && (
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed(false)}
              className="neu-btn neu-btn-primary"
              style={{
                padding: '6px 11px',
                fontSize: '12.5px',
                fontWeight: 'bold',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
              title="Hiện khung Chọn Giáo Viên & Lớp"
            >
              <PanelLeftOpen size={15} />
              <span>Chọn GV & Lớp</span>
            </button>
          )}
          <div 
            className="neu-card-sm" 
            style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)', flexShrink: 0 }}
          >
            <FileSpreadsheet size={20} />
          </div>
          <div style={{ whiteSpace: 'nowrap' }}>
            <h2 style={{ fontSize: '16.5px', fontWeight: 'bold', color: 'var(--text-bold)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap' }}>
              <span>BẢNG TÍNH TIỀN PHOTO ({currentWeek})</span>
              
              {/* Đèn báo trạng thái Mạng: Online / Offline */}
              {!isOnline ? (
                <span style={{ fontSize: '11.5px', fontWeight: 'bold', color: '#c2410c', background: '#ffedd5', border: '1px solid #fed7aa', padding: '2px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <WifiOff size={12} /> Mất mạng
                </span>
              ) : (
                <span style={{ fontSize: '11px', fontWeight: '600', color: '#15803d', background: '#dcfce7', padding: '2px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Wifi size={12} /> Trực tuyến
                </span>
              )}

              {/* Trạng thái Đồng bộ Google Sheets */}
              {syncStatus.status === 'syncing' && (
                <span style={{ fontSize: '11.5px', fontWeight: 'bold', color: '#1d4ed8', background: '#dbeafe', padding: '2px 8px', borderRadius: '12px' }}>
                  🔄 Đang lưu...
                </span>
              )}
              {syncStatus.status === 'success' && (
                <span style={{ fontSize: '11.5px', fontWeight: 'bold', color: '#047857', background: '#d1fae5', padding: '2px 8px', borderRadius: '12px' }}>
                  ✅ Đã lưu CSDL
                </span>
              )}
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-sub)', margin: '2px 0 0 0' }}>
              Hiện có {displayedItems.length} dòng dữ liệu của {currentWeek} • Tự động lưu CSDL sau 2 giây
            </p>
          </div>
        </div>

        {/* Các nút thao tác riêng của Bảng Tính (Cố định 1 hàng, không trùng với Navbar) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap', flexShrink: 0 }}>
          {/* Bộ chọn Tuần & Nút Thêm mới tuần trực tiếp trên Bảng Tính */}
          <div 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px', 
              background: '#eff6ff', 
              padding: '4px 8px', 
              borderRadius: '8px', 
              border: '1.5px solid #93c5fd',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#1d4ed8' }}>📅 Tuần:</span>
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
              title="Chọn tuần làm việc để xem hoặc chỉnh sửa đơn photo"
            >
              {availableWeeks.map(w => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAddNewWeek}
              className="neu-btn"
              style={{ 
                padding: '4px 9px', 
                fontSize: '12px', 
                color: '#1d4ed8', 
                fontWeight: 'bold', 
                background: '#ffffff', 
                border: '1px solid #93c5fd',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Thêm tuần mới vào danh sách tuần"
            >
              <Plus size={13} />
              <span>Thêm tuần</span>
            </button>
          </div>

          {/* Nút Thêm Dòng Trống phát sinh trực tiếp tại Bảng tính */}
          <button 
            onClick={handleAddBlankRow}
            className="neu-btn"
            style={{ 
              fontSize: '13px', 
              padding: '6px 12px', 
              color: 'var(--color-primary)', 
              fontWeight: '600', 
              whiteSpace: 'nowrap',
              flexShrink: 0,
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px' 
            }}
            title="Thêm một dòng trống mới để nhập thủ công phát sinh"
          >
            <Plus size={14} color="var(--color-primary)" />
            <span>Thêm Dòng</span>
          </button>

          {/* Nút Sao Chép Dòng Trước để nhân bản dòng nhanh */}
          <button 
            type="button"
            onClick={() => duplicateBillingItem()}
            className="neu-btn"
            style={{ 
              fontSize: '13px', 
              padding: '6px 13px', 
              color: '#1e40af', 
              background: '#eff6ff', 
              border: '1.5px solid #93c5fd', 
              fontWeight: 'bold', 
              whiteSpace: 'nowrap',
              flexShrink: 0,
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px',
              cursor: 'pointer'
            }}
            title="Tự động sao chép toàn bộ thông tin của dòng vừa nhập phía trên để tạo dòng tiếp theo mà không phải gõ lại"
          >
            <Copy size={14} color="#2563eb" />
            <span>Sao Chép Dòng Trước</span>
          </button>
        </div>
      </div>

      {/* The Excel Table */}
      <div className="excel-table-container" style={{ flex: '1', minHeight: '320px', maxHeight: '520px' }}>
        {displayedItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            <FileSpreadsheet size={48} style={{ opacity: 0.4, marginBottom: '12px' }} />
            <p style={{ fontSize: '16px', fontWeight: 'bold' }}>Bảng tính ({currentWeek}) hiện chưa có đơn photo</p>
            <p style={{ fontSize: '13.5px', marginBottom: '16px' }}>
              Hãy chọn Giáo viên ở cột bên trái để nạp các lớp hoặc bấm "Thêm Dòng" để nhập thủ công phát sinh.
            </p>
            <button
              onClick={handleAddBlankRow}
              className="neu-btn neu-btn-primary"
              style={{ fontSize: '13px', padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={15} />
              <span>+ Thêm Dòng Trống Mới</span>
            </button>
          </div>
        ) : (
          <table className="excel-table" style={{ tableLayout: 'auto', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '1%', whiteSpace: 'nowrap', padding: '9px 6px' }}>STT</th>
                <th style={{ width: 'auto', whiteSpace: 'nowrap', textAlign: 'left', padding: '9px 10px' }}>Tên Giáo Viên</th>
                <th style={{ width: '1%', whiteSpace: 'nowrap', padding: '9px 8px' }}>Lớp</th>
                <th style={{ width: 'auto', whiteSpace: 'nowrap', textAlign: 'left', padding: '9px 10px' }}>Tài liệu</th>
                <th style={{ width: '1%', whiteSpace: 'nowrap', padding: '9px 8px' }}>Sĩ Số</th>
                <th style={{ width: '1%', whiteSpace: 'nowrap', padding: '9px 8px' }}>SL Lẻ</th>
                <th style={{ width: '1%', whiteSpace: 'nowrap', padding: '9px 8px' }}>Đơn Giá (đ)</th>
                <th style={{ width: '1%', whiteSpace: 'nowrap', padding: '9px 10px' }}>Thành Tiền (đ)</th>
                <th style={{ width: '1%', textAlign: 'center', whiteSpace: 'nowrap', padding: '9px 6px' }}>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {displayedItems.map((item, index) => {
                const isHighlighted = item.id === focusedItemId;
                const formattedUnitPrice = item.unitPrice !== '' && item.unitPrice !== null && item.unitPrice !== undefined
                  ? Number(item.unitPrice).toLocaleString('vi-VN')
                  : '';

                return (
                  <tr 
                    key={item.id}
                    id={`grid-row-${item.id}`}
                    style={{
                      backgroundColor: isHighlighted ? '#eff6ff' : undefined,
                      boxShadow: isHighlighted ? 'inset 0 0 0 2px #3b82f6' : undefined,
                      transition: 'background-color 0.35s ease, box-shadow 0.35s ease'
                    }}
                  >
                    {/* STT */}
                    <td style={{ textAlign: 'center', fontWeight: '700', whiteSpace: 'nowrap', padding: '6px 6px', color: isHighlighted ? '#1d4ed8' : 'var(--text-sub)' }}>
                      {index + 1}
                    </td>

                    {/* Tên GV - Auto-size exact pixel width */}
                    <td style={{ width: 'auto', whiteSpace: 'nowrap', padding: '5px 6px' }}>
                      <div style={{ display: 'grid', alignItems: 'center', width: '100%' }}>
                        <span
                          aria-hidden="true"
                          style={{
                            gridArea: '1 / 1 / 2 / 2',
                            visibility: 'hidden',
                            whiteSpace: 'pre',
                            padding: '4px 10px',
                            fontSize: '14.5px',
                            fontWeight: '600',
                            pointerEvents: 'none'
                          }}
                        >
                          {item.teacherName || 'Tên Giáo Viên'}
                        </span>
                        <input 
                          id={`input-teacher-${item.id}`}
                          type="text"
                          className="excel-cell-input"
                          value={item.teacherName}
                          onChange={(e) => updateBillingItem(item.id, 'teacherName', e.target.value)}
                          placeholder="Tên GV..."
                          style={{ gridArea: '1 / 1 / 2 / 2', fontWeight: '600', width: '100%', minWidth: 0 }}
                          title={item.teacherName}
                        />
                      </div>
                    </td>

                    {/* Lớp - Auto-size exact pixel width */}
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap', padding: '5px 6px' }}>
                      <div style={{ display: 'grid', alignItems: 'center', width: '100%' }}>
                        <span
                          aria-hidden="true"
                          style={{
                            gridArea: '1 / 1 / 2 / 2',
                            visibility: 'hidden',
                            whiteSpace: 'pre',
                            padding: '4px 8px',
                            fontSize: '14.5px',
                            fontWeight: '700',
                            pointerEvents: 'none'
                          }}
                        >
                          {item.className || '10A10'}
                        </span>
                        <input 
                          id={`input-class-${item.id}`}
                          type="text"
                          className="excel-cell-input"
                          value={item.className}
                          onChange={(e) => updateBillingItem(item.id, 'className', e.target.value)}
                          placeholder="Lớp..."
                          style={{ gridArea: '1 / 1 / 2 / 2', textAlign: 'center', fontWeight: '700', color: 'var(--color-primary)', width: '100%', minWidth: 0 }}
                          title={item.className}
                        />
                      </div>
                    </td>

                    {/* Tài liệu - Auto-size exact pixel width */}
                    <td style={{ width: 'auto', whiteSpace: 'nowrap', padding: '5px 6px' }}>
                      <div style={{ display: 'grid', alignItems: 'center', width: '100%' }}>
                        <span
                          aria-hidden="true"
                          style={{
                            gridArea: '1 / 1 / 2 / 2',
                            visibility: 'hidden',
                            whiteSpace: 'pre',
                            padding: '4px 10px',
                            fontSize: '14.5px',
                            pointerEvents: 'none'
                          }}
                        >
                          {item.subject || 'Tài liệu...'}
                        </span>
                        <input 
                          id={`input-subject-${item.id}`}
                          type="text"
                          className="excel-cell-input"
                          value={item.subject}
                          onChange={(e) => updateBillingItem(item.id, 'subject', e.target.value)}
                          placeholder="Tài liệu..."
                          style={{ gridArea: '1 / 1 / 2 / 2', width: '100%', minWidth: 0 }}
                          title={item.subject}
                        />
                      </div>
                    </td>

                    {/* Sĩ Số - Auto-size exact pixel width */}
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap', padding: '5px 6px' }}>
                      <div style={{ display: 'grid', alignItems: 'center', width: '100%' }}>
                        <span
                          aria-hidden="true"
                          style={{
                            gridArea: '1 / 1 / 2 / 2',
                            visibility: 'hidden',
                            whiteSpace: 'pre',
                            padding: '4px 22px 4px 8px',
                            fontSize: '14.5px',
                            fontWeight: '600',
                            pointerEvents: 'none'
                          }}
                        >
                          {String(item.studentCount ?? '00')}
                        </span>
                        <input 
                          id={`input-student-${item.id}`}
                          type="number"
                          min="0"
                          className="excel-cell-input"
                          value={item.studentCount}
                          onChange={(e) => updateBillingItem(item.id, 'studentCount', e.target.value)}
                          placeholder="0"
                          style={{ gridArea: '1 / 1 / 2 / 2', textAlign: 'right', fontWeight: '600', width: '100%', minWidth: 0 }}
                        />
                      </div>
                    </td>

                    {/* SL Lẻ - Auto-size exact pixel width */}
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap', padding: '5px 6px' }}>
                      <div style={{ display: 'grid', alignItems: 'center', width: '100%' }}>
                        <span
                          aria-hidden="true"
                          style={{
                            gridArea: '1 / 1 / 2 / 2',
                            visibility: 'hidden',
                            whiteSpace: 'pre',
                            padding: '4px 22px 4px 8px',
                            fontSize: '14.5px',
                            fontWeight: '600',
                            pointerEvents: 'none'
                          }}
                        >
                          {String(item.extraCount ?? '00')}
                        </span>
                        <input 
                          id={`input-extra-${item.id}`}
                          type="number"
                          min="0"
                          className="excel-cell-input"
                          value={item.extraCount}
                          onChange={(e) => updateBillingItem(item.id, 'extraCount', e.target.value)}
                          placeholder="0"
                          style={{ gridArea: '1 / 1 / 2 / 2', textAlign: 'right', fontWeight: '600', color: '#b45309', width: '100%', minWidth: 0 }}
                        />
                      </div>
                    </td>

                    {/* Đơn Giá - Giữ bước nhảy 380, click lần 2 là 760, lần 3 là 1.140..., không popup */}
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap', padding: '5px 6px' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '3px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            const cur = Number(item.unitPrice) || 380;
                            const next = Math.max(0, cur - 380);
                            updateBillingItem(item.id, 'unitPrice', next);
                          }}
                          title="Giảm 380đ"
                          style={{
                            padding: '1px 5px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            border: '1px solid #cbd5e1',
                            background: '#f1f5f9',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            color: '#475569',
                            flexShrink: 0
                          }}
                        >
                          -
                        </button>
                        <div style={{ display: 'inline-grid', alignItems: 'center' }}>
                          <span
                            aria-hidden="true"
                            style={{
                              gridArea: '1 / 1 / 2 / 2',
                              visibility: 'hidden',
                              whiteSpace: 'pre',
                              padding: '4px 8px',
                              fontSize: '14.5px',
                              fontWeight: 'bold',
                              pointerEvents: 'none'
                            }}
                          >
                            {formattedUnitPrice || '1.140'}
                          </span>
                          <input 
                            id={`input-price-${item.id}`}
                            type="text"
                            inputMode="numeric"
                            className="excel-cell-input"
                            value={formattedUnitPrice}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^\d]/g, '');
                              updateBillingItem(item.id, 'unitPrice', raw === '' ? '' : Number(raw));
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                const cur = Number(item.unitPrice) || 0;
                                updateBillingItem(item.id, 'unitPrice', cur <= 0 ? 380 : cur + 380);
                              } else if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                const cur = Number(item.unitPrice) || 380;
                                updateBillingItem(item.id, 'unitPrice', Math.max(0, cur - 380));
                              }
                            }}
                            style={{
                              gridArea: '1 / 1 / 2 / 2',
                              textAlign: 'right',
                              fontWeight: 'bold',
                              width: '100%',
                              minWidth: 0
                            }}
                            placeholder="380"
                            title="Bước nhảy 380đ: bấm [+] hoặc mũi tên để nhảy 760đ, 1.140đ, 1.520đ..."
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const cur = Number(item.unitPrice) || 0;
                            const next = cur <= 0 ? 380 : cur + 380;
                            updateBillingItem(item.id, 'unitPrice', next);
                          }}
                          title="Tăng 380đ (click lần 2: 760đ, lần 3: 1.140đ, tiếp theo...)"
                          style={{
                            padding: '1px 5px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            border: '1px solid #93c5fd',
                            background: '#eff6ff',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            color: '#1d4ed8',
                            flexShrink: 0
                          }}
                        >
                          +
                        </button>
                      </div>
                    </td>

                    {/* Thành Tiền (Tự Động) */}
                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--color-primary)', fontSize: '15px', whiteSpace: 'nowrap', padding: '5px 8px' }}>
                      {formatVND(item.amount)}
                    </td>

                    {/* Thao Tác: Sao Chép & Xóa dòng */}
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        onClick={() => duplicateBillingItem(item)}
                        title="Sao chép dòng này thành dòng mới tiếp theo"
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#2563eb', padding: '3px', marginRight: '6px' }}
                      >
                        <Copy size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeBillingItem(item.id)}
                        title="Xóa dòng này"
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-danger)', padding: '3px' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Grand Total Summary Card - Fixed Single-Row */}
      <div className="grand-total-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'nowrap', flexShrink: 0, overflowX: 'auto', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'nowrap', flexShrink: 0, whiteSpace: 'nowrap' }}>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-sub)' }}>Tổng Số Lớp Photo:</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-bold)' }}>
              {totals.classesCount} Lớp
            </div>
          </div>

          <div style={{ borderLeft: '1px solid #c8d6e6', paddingLeft: '24px' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-sub)' }}>Tổng Số Bản In Toàn Bộ:</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--color-primary)' }}>
              {totals.totalCopies.toLocaleString('vi-VN')} bản
            </div>
          </div>
        </div>

        {/* NÚT RÀ SOÁT & ĐỐI CHIẾU DOANH THU CHỐNG THẤT THOÁT */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setIsReconciliationModalOpen(true)}
            className="neu-btn"
            style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
              color: '#ffffff',
              padding: '11px 22px',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: 'bold',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '9px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              boxShadow: '0 4px 14px rgba(30, 58, 138, 0.35)',
              border: '1.5px solid #3b82f6',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            title="Mở Báo cáo Rà Soát & Đối Chiếu Doanh Thu 4 Chiều (Bảng tính - Google Sheet - Tách lớp - Nợ cũ)"
          >
            <ShieldCheck size={20} color="#60a5fa" />
            <span>🔍 Rà Soát & Đối Chiếu Thu Tiền</span>
          </button>
        </div>

        {/* Big Total */}
        <div style={{ textAlign: 'right', whiteSpace: 'nowrap', flexShrink: 0 }}>
          <div style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text-sub)', textTransform: 'uppercase' }}>
            TỔNG TIỀN PHOTO (TỰ ĐỘNG)
          </div>
          <div style={{ fontSize: '26px', fontWeight: 'bold', color: 'var(--color-primary-dark)', letterSpacing: '0.5px' }}>
            {formatVND(totals.totalAmount)}
          </div>
        </div>
      </div>

      {/* MODAL RÀ SOÁT & ĐỐI CHIẾU DOANH THU */}
      <ReconciliationModal 
        isOpen={isReconciliationModalOpen} 
        onClose={() => setIsReconciliationModalOpen(false)} 
      />
    </div>
  );
};
