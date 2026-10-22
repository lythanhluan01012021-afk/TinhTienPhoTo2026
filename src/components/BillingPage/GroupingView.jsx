import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Layers, 
  Printer, 
  UserCheck, 
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar,
  CheckCircle,
  AlertCircle,
  Clock,
  Search,
  Zap,
  DollarSign,
  TrendingDown,
  TrendingUp,
  FileSpreadsheet
} from 'lucide-react';

export const GroupingView = () => {
  const { 
    currentWeek,
    setCurrentWeek,
    availableWeeks,
    addWeek,
    updateClassPayment,
    getClassDebtSummary,
    getWeekStatistics,
    setIsGroupedView, 
    setIsPrintModalOpen, 
    setPrintClassFilter,
    getHomeroomTeacher,
    getStudentCountForClass 
  } = useApp();

  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'PAID' | 'PARTIAL' | 'UNPAID'
  const [searchClass, setSearchClass] = useState('');

  // Index of current week for prev/next buttons
  const currentWeekIdx = availableWeeks.indexOf(currentWeek);
  const handlePrevWeek = () => {
    if (currentWeekIdx > 0) {
      setCurrentWeek(availableWeeks[currentWeekIdx - 1]);
    }
  };
  const handleNextWeek = () => {
    if (currentWeekIdx < availableWeeks.length - 1) {
      setCurrentWeek(availableWeeks[currentWeekIdx + 1]);
    }
  };

  // Add new week
  const handleAddNewWeekPrompt = () => {
    const nextNum = availableWeeks.length + 1;
    const name = window.prompt(`Nhập tên tuần mới cần thêm (Ví dụ: Tuần ${nextNum}):`, `Tuần ${nextNum}`);
    if (name && name.trim()) {
      addWeek(name.trim());
    }
  };

  // Currency format
  const formatVND = (value) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value || 0);
  };

  // Statistics for current week
  const weekStats = useMemo(() => {
    return getWeekStatistics(currentWeek);
  }, [currentWeek, getWeekStatistics]);

  // Filtered class list
  const filteredSummaries = useMemo(() => {
    return weekStats.classSummaries.filter(item => {
      // 1. Status Filter
      if (statusFilter === 'PAID' && item.status !== 'PAID' && item.status !== 'OVERPAID') return false;
      if (statusFilter === 'PARTIAL' && item.status !== 'PARTIAL') return false;
      if (statusFilter === 'UNPAID' && item.status !== 'UNPAID') return false;

      // 2. Search
      if (searchClass.trim()) {
        const q = searchClass.trim().toLowerCase();
        const hr = (getHomeroomTeacher(item.className) || '').toLowerCase();
        if (!item.className.toLowerCase().includes(q) && !hr.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [weekStats, statusFilter, searchClass, getHomeroomTeacher]);

  const handlePrintSingleClass = (className) => {
    setPrintClassFilter(className);
    setIsPrintModalOpen(true);
  };

  const handlePrintAll = () => {
    setPrintClassFilter('all');
    setIsPrintModalOpen(true);
  };

  return (
    <div className="neu-card" style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 1. Header Toolbar */}
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          flexWrap: 'wrap', 
          gap: '12px',
          borderBottom: '2px solid #d8e2ef',
          paddingBottom: '14px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div 
            className="neu-card-sm" 
            style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}
          >
            <Layers size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-bold)', margin: 0 }}>
              SỔ THU TIỀN & CÔNG NỢ THEO TUẦN
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-sub)', margin: '2px 0 0 0' }}>
              Theo dõi tiền photo theo từng Lớp • Quản lý đóng đủ, đóng thiếu và tự động chuyển nợ sang tuần sau
            </p>
          </div>
        </div>

        {/* Back and Print Buttons */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button 
            onClick={() => setIsGroupedView(false)}
            className="neu-btn"
            style={{ fontSize: '13.5px', padding: '8px 14px' }}
          >
            <ArrowLeft size={16} />
            <span>Về Bảng Tính Chi Tiết</span>
          </button>

          <button 
            onClick={handlePrintAll}
            className="neu-btn neu-btn-primary"
            style={{ fontSize: '13.5px', padding: '8px 16px' }}
            title="In toàn bộ phiếu thanh toán & công nợ các lớp trong tuần này"
          >
            <Printer size={16} />
            <span>In Phiếu Thu Tất Cả Các Lớp</span>
          </button>
        </div>
      </div>

      {/* 2. Week Navigator & Fast Week Picker */}
      <div 
        className="neu-card-sm"
        style={{ 
          padding: '12px 18px', 
          background: 'linear-gradient(135deg, #f0f5fc, #e6effa)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          borderRadius: '12px'
        }}
      >
        {/* Left: Week Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button 
            onClick={handlePrevWeek}
            disabled={currentWeekIdx <= 0}
            className="neu-btn"
            style={{ padding: '6px 10px', opacity: currentWeekIdx <= 0 ? 0.4 : 1, cursor: currentWeekIdx <= 0 ? 'not-allowed' : 'pointer' }}
            title="Xem tuần trước"
          >
            <ChevronLeft size={18} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} color="var(--color-primary)" />
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-bold)' }}>Đang chọn:</span>
            <select
              value={currentWeek}
              onChange={(e) => setCurrentWeek(e.target.value)}
              style={{
                fontSize: '15px',
                fontWeight: 'bold',
                color: 'var(--color-primary-dark)',
                padding: '6px 14px',
                borderRadius: '8px',
                border: '1.5px solid #1b5ebe',
                backgroundColor: '#ffffff',
                cursor: 'pointer',
                outline: 'none',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              {availableWeeks.map(wk => (
                <option key={wk} value={wk}>{wk}</option>
              ))}
            </select>
          </div>

          <button 
            onClick={handleNextWeek}
            disabled={currentWeekIdx >= availableWeeks.length - 1}
            className="neu-btn"
            style={{ padding: '6px 10px', opacity: currentWeekIdx >= availableWeeks.length - 1 ? 0.4 : 1, cursor: currentWeekIdx >= availableWeeks.length - 1 ? 'not-allowed' : 'pointer' }}
            title="Xem tuần tiếp theo"
          >
            <ChevronRight size={18} />
          </button>

          {/* Add New Week button */}
          <button
            onClick={handleAddNewWeekPrompt}
            className="neu-btn"
            style={{ padding: '6px 12px', fontSize: '13px', color: 'var(--color-primary)', fontWeight: '600' }}
            title="Tạo tuần mới để tiếp tục phiên thu tiền tiếp theo"
          >
            <Plus size={15} />
            <span>Thêm Tuần Mới</span>
          </button>
        </div>

        {/* Quick Notice */}
        <div style={{ fontSize: '13px', color: 'var(--text-sub)' }}>
          * Nợ chưa đóng ở tuần này sẽ <b>tự động cộng dồn</b> vào tổng thu của tuần tiếp theo.
        </div>
      </div>

      {/* 3. Week Debt Scorecards (4 Ô Thống Kê Toàn Trường) */}
      <div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '12px' 
        }}
      >
        {/* Card 1: Phát sinh tuần này */}
        <div 
          className="neu-card-sm" 
          style={{ 
            padding: '12px 16px', 
            background: '#ffffff', 
            borderLeft: '4px solid #1b5ebe',
            borderRadius: '10px'
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            1. PHÁT SINH {currentWeek.toUpperCase()}
          </div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--color-primary-dark)', marginTop: '4px' }}>
            {formatVND(weekStats.totalBilled)}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-sub)', marginTop: '2px' }}>
            Tổng tiền photo các lớp in trong tuần
          </div>
        </div>

        {/* Card 2: Nợ cũ các tuần trước mang sang */}
        <div 
          className="neu-card-sm" 
          style={{ 
            padding: '12px 16px', 
            background: '#ffffff', 
            borderLeft: '4px solid #f59e0b',
            borderRadius: '10px'
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#b45309', textTransform: 'uppercase' }}>
            2. NỢ CŨ MANG SANG
          </div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#b45309', marginTop: '4px' }}>
            {formatVND(weekStats.totalPreviousDebt)}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-sub)', marginTop: '2px' }}>
            Nợ tồn đọng từ các tuần trước chuyển tiếp
          </div>
        </div>

        {/* Card 3: Tiền thực thu (Lớp đã nộp) */}
        <div 
          className="neu-card-sm" 
          style={{ 
            padding: '12px 16px', 
            background: '#ffffff', 
            borderLeft: '4px solid #10b981',
            borderRadius: '10px'
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#047857', textTransform: 'uppercase' }}>
            3. THỰC THU (LỚP ĐÃ ĐÓNG)
          </div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#047857', marginTop: '4px' }}>
            {formatVND(weekStats.totalPaid)}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-sub)', marginTop: '2px' }}>
            Đã thu thành công từ các lớp
          </div>
        </div>

        {/* Card 4: Còn thiếu chuyển tuần sau */}
        <div 
          className="neu-card-sm" 
          style={{ 
            padding: '12px 16px', 
            background: weekStats.totalRemaining > 0 ? '#fef2f2' : '#ffffff', 
            borderLeft: `4px solid ${weekStats.totalRemaining > 0 ? '#ef4444' : '#10b981'}`,
            borderRadius: '10px'
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: weekStats.totalRemaining > 0 ? '#b91c1c' : '#047857', textTransform: 'uppercase' }}>
            4. CÒN THIẾU (NỢ ĐỌNG)
          </div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: weekStats.totalRemaining > 0 ? '#dc2626' : '#047857', marginTop: '4px' }}>
            {formatVND(weekStats.totalRemaining)}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-sub)', marginTop: '2px' }}>
            {weekStats.totalRemaining > 0 ? 'Sẽ chuyển nợ vào tuần kế tiếp' : 'Toàn trường đã thanh toán đủ'}
          </div>
        </div>
      </div>

      {/* 4. Filter Toolbar & Search */}
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          flexWrap: 'wrap', 
          gap: '10px',
          padding: '4px 0'
        }}
      >
        {/* Status Filter Buttons */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`neu-chip ${statusFilter === 'ALL' ? 'active' : ''}`}
            style={{ cursor: 'pointer', padding: '6px 14px', fontSize: '13px', fontWeight: 'bold' }}
          >
            Tất cả lớp ({weekStats.classSummaries.length})
          </button>
          
          <button
            onClick={() => setStatusFilter('PAID')}
            className={`neu-chip ${statusFilter === 'PAID' ? 'active' : ''}`}
            style={{ 
              cursor: 'pointer', 
              padding: '6px 14px', 
              fontSize: '13px', 
              fontWeight: 'bold',
              color: '#047857',
              borderColor: statusFilter === 'PAID' ? '#10b981' : '#a7f3d0'
            }}
          >
            🟢 Đã đóng đủ ({weekStats.paidCount})
          </button>

          <button
            onClick={() => setStatusFilter('PARTIAL')}
            className={`neu-chip ${statusFilter === 'PARTIAL' ? 'active' : ''}`}
            style={{ 
              cursor: 'pointer', 
              padding: '6px 14px', 
              fontSize: '13px', 
              fontWeight: 'bold',
              color: '#b45309',
              borderColor: statusFilter === 'PARTIAL' ? '#f59e0b' : '#fde68a'
            }}
          >
            🟡 Còn thiếu ({weekStats.partialCount})
          </button>

          <button
            onClick={() => setStatusFilter('UNPAID')}
            className={`neu-chip ${statusFilter === 'UNPAID' ? 'active' : ''}`}
            style={{ 
              cursor: 'pointer', 
              padding: '6px 14px', 
              fontSize: '13px', 
              fontWeight: 'bold',
              color: '#b91c1c',
              borderColor: statusFilter === 'UNPAID' ? '#ef4444' : '#fecaca'
            }}
          >
            🔴 Chưa nộp ({weekStats.unpaidCount})
          </button>
        </div>

        {/* Quick Search */}
        <div style={{ position: 'relative', width: '240px' }}>
          <input 
            type="text"
            className="neu-input"
            placeholder="Tìm theo Lớp hoặc GVCN..."
            value={searchClass}
            onChange={(e) => setSearchClass(e.target.value)}
            style={{ width: '100%', paddingLeft: '32px', fontSize: '13px', paddingRight: '10px' }}
          />
          <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
        </div>
      </div>

      {/* 5. Class Settlement Cards List */}
      <div style={{ flex: '1', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingRight: '4px' }}>
        {filteredSummaries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)' }}>
            <FileSpreadsheet size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
            <p style={{ fontSize: '16px', fontWeight: 'bold' }}>Không tìm thấy lớp nào phù hợp điều kiện lọc</p>
            <p style={{ fontSize: '13.5px' }}>
              Hãy thử chọn mục "Tất cả lớp" hoặc đổi sang tuần photo khác.
            </p>
          </div>
        ) : (
          filteredSummaries.map((summary) => {
            const cls = summary.className;
            const homeroomTeacher = getHomeroomTeacher(cls);
            const studentCount = getStudentCountForClass(cls);

            // Badge Color & Text by Debt Status
            let badgeStyle = { bg: '#d1fae5', text: '#065f46', border: '#6ee7b7', label: '🟢 ĐÃ ĐÓNG ĐỦ (0 đ nợ)' };
            if (summary.status === 'PARTIAL') {
              badgeStyle = { bg: '#fef3c7', text: '#92400e', border: '#fcd34d', label: `🟡 THIẾU: ${formatVND(summary.remainingDebt)} (Nợ tuần sau)` };
            } else if (summary.status === 'UNPAID') {
              badgeStyle = { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5', label: `🔴 CHƯA ĐÓNG: ${formatVND(summary.totalDue)}` };
            } else if (summary.status === 'OVERPAID') {
              badgeStyle = { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd', label: `🔵 NỘP DƯ: ${formatVND(Math.abs(summary.remainingDebt))} (Trừ tuần sau)` };
            }

            return (
              <div 
                key={cls}
                className="neu-card-sm"
                style={{
                  background: '#ffffff',
                  border: `1.5px solid ${summary.remainingDebt > 0 ? '#fbcfe8' : '#e2e8f0'}`,
                  borderRadius: '14px',
                  overflow: 'hidden',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                {/* Header of Class */}
                <div 
                  style={{
                    background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
                    padding: '12px 18px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1.5px solid #cbd5e1',
                    flexWrap: 'wrap',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span 
                      style={{ 
                        fontSize: '18px', 
                        fontWeight: 'bold', 
                        color: 'var(--color-primary-dark)',
                        background: '#ffffff',
                        padding: '4px 14px',
                        borderRadius: '8px',
                        boxShadow: 'var(--shadow-sm)'
                      }}
                    >
                      LỚP {cls}
                    </span>
                    <div style={{ fontSize: '13.5px', color: 'var(--text-sub)' }}>
                      <UserCheck size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                      GVCN: <b style={{ color: 'var(--text-bold)' }}>{homeroomTeacher}</b> • Sĩ số: <b>{studentCount} hs</b>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span 
                      style={{
                        padding: '5px 12px',
                        borderRadius: '20px',
                        fontSize: '12.5px',
                        fontWeight: 'bold',
                        backgroundColor: badgeStyle.bg,
                        color: badgeStyle.text,
                        border: `1px solid ${badgeStyle.border}`
                      }}
                    >
                      {badgeStyle.label}
                    </span>

                    <button
                      onClick={() => handlePrintSingleClass(cls)}
                      className="neu-btn"
                      style={{ fontSize: '12.5px', padding: '6px 12px' }}
                      title={`In phiếu thanh toán & công nợ cho lớp ${cls}`}
                    >
                      <Printer size={14} color="var(--color-primary)" />
                      <span>In Phiếu Lớp {cls}</span>
                    </button>
                  </div>
                </div>

                {/* Photo Items Table (if any photo in this week) */}
                {summary.items.length > 0 ? (
                  <div style={{ padding: '8px 16px' }}>
                    <table className="excel-table" style={{ fontSize: '13.5px' }}>
                      <thead>
                        <tr>
                          <th style={{ width: '40px' }}>STT</th>
                          <th style={{ width: '170px' }}>Giáo Viên Bộ Môn</th>
                          <th>Nội Dung Tài Liệu Photo Trong {currentWeek}</th>
                          <th style={{ width: '80px' }}>Sĩ Số</th>
                          <th style={{ width: '80px' }}>Số Lẻ</th>
                          <th style={{ width: '90px' }}>Tổng Bản</th>
                          <th style={{ width: '90px' }}>Đơn Giá</th>
                          <th style={{ width: '120px' }}>Thành Tiền</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.items.map((item, idx) => {
                          const totalCopies = (Number(item.studentCount) || 0) + (Number(item.extraCount) || 0);
                          return (
                            <tr key={item.id}>
                              <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>
                              <td style={{ fontWeight: '600' }}>{item.teacherName}</td>
                              <td>{item.subject}</td>
                              <td style={{ textAlign: 'right' }}>{item.studentCount}</td>
                              <td style={{ textAlign: 'right', color: '#b45309' }}>{item.extraCount}</td>
                              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{totalCopies}</td>
                              <td style={{ textAlign: 'right' }}>{Number(item.unitPrice).toLocaleString('vi-VN')} đ</td>
                              <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                                {formatVND(item.amount)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: '10px 18px', fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic', background: '#fafbfc' }}>
                    ℹ Lớp {cls} không có tài liệu photo phát sinh trong {currentWeek}.
                    {summary.previousDebt > 0 && (
                      <span style={{ color: '#b91c1c', fontWeight: 'bold', marginLeft: '6px' }}>
                        (Đang nợ {formatVND(summary.previousDebt)} từ các tuần trước chuyển sang)
                      </span>
                    )}
                  </div>
                )}

                {/* Interactive Weekly Debt & Settlement Box */}
                <div 
                  style={{ 
                    padding: '12px 18px', 
                    background: '#f8fafc', 
                    borderTop: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div 
                    style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
                      gap: '10px',
                      alignItems: 'center'
                    }}
                  >
                    {/* Billed this week */}
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-sub)' }}>Phát sinh {currentWeek}:</div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--color-primary-dark)' }}>
                        {formatVND(summary.billedThisWeek)}
                      </div>
                    </div>

                    {/* Previous Debt */}
                    <div>
                      <div style={{ fontSize: '12px', color: '#b45309' }}>Nợ cũ tuần trước mang sang:</div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold', color: summary.previousDebt > 0 ? '#b45309' : 'var(--text-muted)' }}>
                        + {formatVND(summary.previousDebt)}
                      </div>
                    </div>

                    {/* Total Due */}
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-bold)', textTransform: 'uppercase' }}>
                        TỔNG CẦN NỘP:
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b' }}>
                        = {formatVND(summary.totalDue)}
                      </div>
                    </div>

                    {/* Paid Amount Input */}
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#047857' }}>
                        💵 Lớp Thực Nộp ({currentWeek}):
                      </div>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                        <input 
                          type="number"
                          min="0"
                          step="1000"
                          value={summary.paidAmount || ''}
                          onChange={(e) => updateClassPayment(currentWeek, cls, e.target.value, summary.note)}
                          placeholder="0 đ"
                          style={{
                            width: '120px',
                            padding: '6px 8px',
                            borderRadius: '6px',
                            border: '1.5px solid #10b981',
                            fontWeight: 'bold',
                            fontSize: '14.5px',
                            color: '#047857',
                            outline: 'none',
                            backgroundColor: '#ffffff'
                          }}
                        />
                        {/* Quick Button: Đóng Đủ */}
                        <button
                          onClick={() => updateClassPayment(currentWeek, cls, summary.totalDue, summary.note)}
                          className="neu-btn"
                          style={{ padding: '6px 10px', fontSize: '12px', color: '#047857', fontWeight: 'bold' }}
                          title="Tự động điền đúng số tiền cần nộp"
                        >
                          <Zap size={13} />
                          <span>Đủ</span>
                        </button>
                        {/* Quick Button: 0đ */}
                        <button
                          onClick={() => updateClassPayment(currentWeek, cls, 0, summary.note)}
                          className="neu-btn"
                          style={{ padding: '6px 8px', fontSize: '12px', color: '#b91c1c' }}
                          title="Chưa nộp (0 đ)"
                        >
                          0đ
                        </button>
                      </div>
                    </div>

                    {/* Remaining Debt to next week */}
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: summary.remainingDebt > 0 ? '#b91c1c' : '#047857' }}>
                        {summary.remainingDebt > 0 ? 'NỢ CHUYỂN TUẦN SAU:' : (summary.remainingDebt < 0 ? 'DƯ CHUYỂN TUẦN SAU:' : 'NỢ CÒN LẠI:')}
                      </div>
                      <div 
                        style={{ 
                          fontSize: '19px', 
                          fontWeight: 'bold', 
                          color: summary.remainingDebt > 0 ? '#dc2626' : (summary.remainingDebt < 0 ? '#1d4ed8' : '#059669')
                        }}
                      >
                        {formatVND(summary.remainingDebt)}
                      </div>
                    </div>
                  </div>

                  {/* Note Field */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <span style={{ fontSize: '12.5px', color: 'var(--text-sub)', whiteSpace: 'nowrap' }}>Ghi chú thu tiền:</span>
                    <input 
                      type="text"
                      value={summary.note || ''}
                      onChange={(e) => updateClassPayment(currentWeek, cls, summary.paidAmount, e.target.value)}
                      placeholder="Ghi chú (Ví dụ: Bạn lớp trưởng hẹn thứ 2 nộp nốt 50k, đã thu qua CK...)"
                      style={{
                        flex: '1',
                        padding: '5px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '12.5px',
                        outline: 'none',
                        background: '#ffffff'
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
