import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Receipt, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Plus, 
  Trash2, 
  Download, 
  Filter, 
  Calendar,
  CheckCircle, 
  AlertCircle,
  AlertTriangle,
  Save,
  Target,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Layers,
  Printer,
  FileSpreadsheet,
  CheckCircle2,
  DollarSign
} from 'lucide-react';
import * as XLSX from 'xlsx';

export const CashflowPage = () => {
  const { 
    cashflow, 
    addCashflowRecord, 
    removeCashflowRecord,
    isCashflowSynced,
    syncCashflowToGoogleSheets,
    fetchCashflowFromGoogleSheets,
    syncStatus,
    billingItems,
    currentWeek,
    availableWeeks,
    setCurrentWeek,
    classDebts,
    weeklyDebts,
    totalClassDebts,
    setCurrentTab,
    setIsGroupedView,
    setIsPrintModalOpen
  } = useApp();

  // Tuần đang chọn để theo dõi thu / chi
  const [selectedWeek, setSelectedWeek] = useState(currentWeek || 'Tuần 7');

  // Bộ lọc danh sách bảng phiếu
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'THU' | 'CHI'
  const [filterWeek, setFilterWeek] = useState('ALL'); // 'ALL' hoặc theo tuần cụ thể
  const [filterMonth, setFilterMonth] = useState('ALL');
  const [filterYear, setFilterYear] = useState('2026');

  // Đồng bộ selectedWeek khi currentWeek bên ngoài đổi
  useEffect(() => {
    if (currentWeek) {
      setSelectedWeek(currentWeek);
    }
  }, [currentWeek]);

  // Form ghi sổ mới
  const [newRecord, setNewRecord] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'THU',
    category: '',
    amount: '',
    payer: '',
    note: '',
    week: currentWeek || 'Tuần 7'
  });

  const formatVND = (v) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v || 0);

  // =========================================================================
  // 1. TÍNH TOÁN DÒNG TIỀN PHOTO & CÔNG NỢ THỰC TẾ CỦA TUẦN (SELECTED WEEK)
  // =========================================================================

  // Các dòng photo thuộc tuần đang chọn
  const weekBillingItems = useMemo(() => {
    return billingItems.filter(item => (item.week || currentWeek) === selectedWeek);
  }, [billingItems, currentWeek, selectedWeek]);

  // Tiền photo phát sinh của tuần đang chọn
  const weekPhotoAmount = useMemo(() => {
    return weekBillingItems.reduce((sum, item) => {
      const copies = (Number(item.studentCount) || 0) + (Number(item.extraCount) || 0);
      const price = Number(item.unitPrice) || 380;
      const amt = (item.amount !== undefined && item.amount !== null && Number(item.amount) > 0)
        ? Number(item.amount)
        : (copies * price);
      return sum + amt;
    }, 0);
  }, [weekBillingItems]);

  // Bản đồ công nợ các lớp trong tuần đang chọn
  const weekDebtsMap = useMemo(() => {
    return (weeklyDebts && weeklyDebts[selectedWeek]) || (selectedWeek === currentWeek ? (classDebts || {}) : {});
  }, [weeklyDebts, selectedWeek, currentWeek, classDebts]);

  // Tổng tiền nợ cũ mang sang của tuần đang chọn
  const weekDebtAmount = useMemo(() => {
    return Object.values(weekDebtsMap).reduce((sum, d) => sum + (Number(d?.amount) || 0), 0);
  }, [weekDebtsMap]);

  // Số lượng lớp đang nợ/thiếu trong tuần này
  const debtClassesCount = useMemo(() => {
    return Object.keys(weekDebtsMap).filter(cls => (Number(weekDebtsMap[cls]?.amount) || 0) > 0).length;
  }, [weekDebtsMap]);

  // ⭐ TỔNG THỰC TẾ CẦN THU VỀ QUỸ CỦA TUẦN ĐÓ = TIỀN PHOTO + NỢ CŨ
  const weekTotalDue = weekPhotoAmount + weekDebtAmount;

  // Lọc các giao dịch trong Sổ Quỹ thuộc về tuần đang chọn
  const weekCashflowItems = useMemo(() => {
    return cashflow.filter(item => {
      if (item.week && item.week === selectedWeek) return true;
      const txt = `${item.category || ''} ${item.note || ''}`.toLowerCase();
      const wClean = selectedWeek.toLowerCase().replace(/\s+/g, '');
      return txt.includes(selectedWeek.toLowerCase()) || txt.includes(wClean);
    });
  }, [cashflow, selectedWeek]);

  // Tiền đã thu vào Sổ Quỹ cho tuần này
  const weekCollectedFund = useMemo(() => {
    return weekCashflowItems
      .filter(item => item.type === 'THU')
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [weekCashflowItems]);

  // Chi phí vật tư đã ghi trong Sổ Quỹ cho tuần này
  const weekExpenseFund = useMemo(() => {
    return weekCashflowItems
      .filter(item => item.type === 'CHI')
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [weekCashflowItems]);

  // Còn thiếu chưa thu về quỹ của tuần này
  const weekRemainingToCollect = Math.max(0, weekTotalDue - weekCollectedFund);

  // Lợi nhuận thực tế còn lại của tuần này trong Sổ Quỹ (Thu - Chi)
  const weekNetFund = weekCollectedFund - weekExpenseFund;

  // Tỷ lệ % đã thu về quỹ
  const collectionPercent = weekTotalDue > 0
    ? Math.min(100, Math.round((weekCollectedFund / weekTotalDue) * 100))
    : (weekCollectedFund > 0 ? 100 : 0);

  // =========================================================================
  // 2. THỐNG KÊ TOÀN DIỆN CỦA TOÀN BỘ SỔ QUỸ (THEO BỘ LỌC)
  // =========================================================================
  const filteredList = useMemo(() => {
    return cashflow.filter(item => {
      const matchType = filterType === 'ALL' || item.type === filterType;
      
      // Lọc theo tuần nếu có chọn
      let matchWeek = true;
      if (filterWeek !== 'ALL') {
        if (item.week) {
          matchWeek = item.week === filterWeek;
        } else {
          const txt = `${item.category || ''} ${item.note || ''}`.toLowerCase();
          const wClean = filterWeek.toLowerCase().replace(/\s+/g, '');
          matchWeek = txt.includes(filterWeek.toLowerCase()) || txt.includes(wClean);
        }
      }

      const itemDate = new Date(item.date);
      const matchYear = filterYear === 'ALL' || itemDate.getFullYear().toString() === filterYear;
      const matchMonth = filterMonth === 'ALL' || (itemDate.getMonth() + 1).toString() === filterMonth;
      return matchType && matchWeek && matchYear && matchMonth;
    });
  }, [cashflow, filterType, filterWeek, filterMonth, filterYear]);

  const globalStats = useMemo(() => {
    let totalThu = 0;
    let totalChi = 0;

    filteredList.forEach(item => {
      const amt = Number(item.amount) || 0;
      if (item.type === 'THU') totalThu += amt;
      else if (item.type === 'CHI') totalChi += amt;
    });

    const netProfit = totalThu - totalChi;
    return { totalThu, totalChi, netProfit };
  }, [filteredList]);

  // =========================================================================
  // 3. XỬ LÝ HÀNH ĐỘNG NHANH (SMART ACTIONS)
  // =========================================================================

  // Điền nhanh phiếu THU tiền photo tuần vào form
  const handleAutoFillWeeklyIncome = () => {
    const amountToFill = weekRemainingToCollect > 0 ? weekRemainingToCollect : weekTotalDue;
    setNewRecord({
      date: new Date().toISOString().split('T')[0],
      type: 'THU',
      category: `Thu tiền photo toàn trường (${selectedWeek})`,
      amount: amountToFill > 0 ? amountToFill : weekTotalDue,
      payer: 'Các lớp & GV toàn trường',
      note: `Gồm: Tiền photo (${formatVND(weekPhotoAmount)}) + Nợ cũ (${formatVND(weekDebtAmount)})`,
      week: selectedWeek
    });

    const formEl = document.getElementById('cashflow-record-form');
    if (formEl) {
      formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const amountInput = document.getElementById('cashflow-amount-input');
      if (amountInput) amountInput.focus();
    }
  };

  // Điền nhanh phiếu CHI vật tư (Giấy A4, Nạp Mực, Sửa máy)
  const handleQuickExpenseFill = (category, defaultAmt = '', payer = 'Văn phòng phẩm / Kỹ thuật máy') => {
    setNewRecord({
      date: new Date().toISOString().split('T')[0],
      type: 'CHI',
      category: `${category} (${selectedWeek})`,
      amount: defaultAmt,
      payer: payer,
      note: `Chi vật tư phục vụ photo ${selectedWeek}`,
      week: selectedWeek
    });

    const formEl = document.getElementById('cashflow-record-form');
    if (formEl) {
      formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const amountInput = document.getElementById('cashflow-amount-input');
      if (amountInput) amountInput.focus();
    }
  };

  // Ghi sổ
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newRecord.category || !newRecord.amount) return;

    addCashflowRecord(newRecord);
    setNewRecord({
      date: new Date().toISOString().split('T')[0],
      type: 'THU',
      category: '',
      amount: '',
      payer: '',
      note: '',
      week: selectedWeek
    });
  };

  // Xuất file Excel đối soát thu chi
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Tổng hợp dòng tiền tuần đang chọn
    const summaryWeekData = [{
      'Tuần Làm Việc': selectedWeek,
      'Tổng Thực Tế Cần Thu Về Quỹ (đ)': weekTotalDue,
      'Tiền Photo Trong Tuần (đ)': weekPhotoAmount,
      'Số Đơn Photo': weekBillingItems.length,
      'Tiền Nợ Cũ Mang Sang (đ)': weekDebtAmount,
      'Số Lớp Nợ': debtClassesCount,
      'Đã Thu Vào Sổ Quỹ (đ)': weekCollectedFund,
      'Còn Thiếu Chưa Thu (đ)': weekRemainingToCollect,
      'Chi Phí Vật Tư Tuần (đ)': weekExpenseFund,
      'Quỹ Ròng Còn Lại Tuần (đ)': weekNetFund,
      'Tỷ Lệ Thu Về Quỹ': `${collectionPercent}%`,
      'Ngày Xuất Báo Cáo': new Date().toLocaleString('vi-VN')
    }];
    const wsSummary = XLSX.utils.json_to_sheet(summaryWeekData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'TongHopThuChiTuan');

    // Sheet 2: Danh sách chi tiết các phiếu ghi sổ
    const data = filteredList.map((item, idx) => ({
      'STT': idx + 1,
      'Mã Phiếu': item.id,
      'Tuần': item.week || '',
      'Ngày Ghi Sổ': item.date,
      'Loại': item.type === 'THU' ? 'Thu (+)' : 'Chi (-)',
      'Hạng Mục': item.category,
      'Số Tiền (VNĐ)': item.amount,
      'Người Giao Dịch': item.payer,
      'Ghi Chú': item.note
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'SoQuyChiTiet');

    XLSX.writeFile(wb, `So_Quy_Thu_Chi_${selectedWeek.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="neu-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* 1. Header Bar */}
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          borderBottom: '2px solid #d8e2ef', 
          paddingBottom: '16px',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div 
            className="neu-card-sm" 
            style={{ width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6d28d9', background: '#f5f3ff', border: '1.5px solid #ddd6fe' }}
          >
            <Receipt size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text-bold)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span>SỔ QUỸ THU / CHI & QUẢN LÝ DÒNG TIỀN PHÒNG PHOTO</span>
              <span style={{ fontSize: '12.5px', fontWeight: 'bold', color: '#6d28d9', background: '#ede9fe', padding: '3px 10px', borderRadius: '12px', border: '1px solid #c4b5fd' }}>
                {selectedWeek}
              </span>
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-sub)', margin: '3px 0 0 0' }}>
              Quản lý thực thu từ các lớp, bù trừ nợ cũ mang sang và chi phí mua giấy ram A4, nạp mực
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Badge trạng thái lưu CSDL Sổ Quỹ */}
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              padding: '6px 12px', 
              borderRadius: '8px', 
              background: isCashflowSynced ? '#ecfdf5' : '#fffbeb', 
              border: `1.5px solid ${isCashflowSynced ? '#a7f3d0' : '#fde68a'}`, 
              fontSize: '12px', 
              fontWeight: 'bold', 
              color: isCashflowSynced ? '#047857' : '#b45309' 
            }}
          >
            {isCashflowSynced ? <CheckCircle size={15} color="#047857" /> : <AlertCircle size={15} color="#b45309" />}
            <span>{isCashflowSynced ? 'Đã lưu Google Sheet' : 'Sổ Quỹ chưa lưu Sheet'}</span>
          </div>

          {/* NÚT LƯU SỔ QUỸ LÊN GOOGLE SHEETS */}
          <button 
            type="button"
            onClick={() => syncCashflowToGoogleSheets()}
            className="neu-btn"
            style={{ 
              fontSize: '13px', 
              padding: '7px 15px', 
              fontWeight: 'bold',
              background: 'linear-gradient(135deg, #6d28d9, #5b21b6)',
              color: '#ffffff',
              border: 'none',
              boxShadow: '0 2px 8px rgba(109, 40, 217, 0.35)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title="Lưu toàn bộ nhật ký thu chi vào Google Sheets (Tab SoQuy_ThuChi)"
          >
            <Save size={15} />
            <span>Lưu Sheet</span>
          </button>

          {/* NÚT TẢI TỪ GOOGLE SHEETS */}
          <button 
            type="button"
            onClick={fetchCashflowFromGoogleSheets}
            className="neu-btn"
            style={{ fontSize: '13px', padding: '7px 12px', background: '#ffffff', color: '#6d28d9', border: '1.5px solid #c4b5fd', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
            title="Tải lại nhật ký thu chi từ Google Sheets (Tab SoQuy_ThuChi)"
          >
            <span>📥 Tải Từ Drive</span>
          </button>

          {/* XUẤT EXCEL */}
          <button 
            type="button"
            onClick={handleExportExcel} 
            className="neu-btn" 
            style={{ fontSize: '13px', padding: '7px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#1e40af', background: '#eff6ff', border: '1px solid #bfdbfe' }}
            title="Tải file Excel đối soát thu chi của tuần về máy"
          >
            <Download size={15} color="#2563eb" />
            <span>Xuất Excel</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. KHỐI TRỌNG TÂM: QUẢN LÝ DÒNG TIỀN PHOTO & CÔNG NỢ THEO TUẦN          */}
      {/* ========================================================================= */}
      <div 
        style={{ 
          background: 'linear-gradient(135deg, #f8fafc 0%, #edf2f9 100%)', 
          border: '1.5px solid #cbd5e1', 
          borderRadius: '16px', 
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.04)'
        }}
      >
        {/* Thanh chọn tuần & nút điều hướng nghiệp vụ */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#1e3a8a', color: '#ffffff', padding: '6px 14px', borderRadius: '10px', fontWeight: 'bold', fontSize: '13.5px' }}>
              <Calendar size={16} />
              <span>TUẦN QUẢN LÝ:</span>
            </div>
            
            <select
              value={selectedWeek}
              onChange={(e) => {
                setSelectedWeek(e.target.value);
                setNewRecord(prev => ({ ...prev, week: e.target.value }));
              }}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '2px solid #3b82f6',
                fontSize: '14px',
                fontWeight: 'bold',
                color: '#1e3a8a',
                background: '#ffffff',
                cursor: 'pointer'
              }}
              title="Chọn tuần làm việc để xem và quản lý số tiền thực tế cần thu về quỹ"
            >
              {availableWeeks.map(w => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>

            <span style={{ fontSize: '12.5px', color: 'var(--text-sub)' }}>
              ({weekBillingItems.length} đơn photo • {debtClassesCount} lớp nợ)
            </span>
          </div>

          {/* Các nút liên kết nghiệp vụ */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                setCurrentWeek(selectedWeek);
                setIsGroupedView(true);
                setCurrentTab('billing');
              }}
              className="neu-btn"
              style={{
                fontSize: '12.5px',
                padding: '6px 12px',
                fontWeight: '700',
                color: '#991b1b',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer'
              }}
              title="Chuyển sang bảng quản lý nợ từng lớp học"
            >
              <Layers size={14} color="#dc2626" />
              <span>Xem Nợ Từng Lớp ({debtClassesCount})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setCurrentWeek(selectedWeek);
                setIsPrintModalOpen(true);
              }}
              className="neu-btn"
              style={{
                fontSize: '12.5px',
                padding: '6px 12px',
                fontWeight: '700',
                color: '#1e40af',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer'
              }}
              title="Mở Bảng kê in ấn & quyết toán khổ A4"
            >
              <Printer size={14} color="#2563eb" />
              <span>In Quyết Toán Tuần</span>
            </button>
          </div>
        </div>

        {/* 4 CARD CHI TIẾT THU - CHI CỦA TUẦN ĐANG CHỌN */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          
          {/* ⭐ CARD 1: TỔNG THỰC TẾ CẦN THU VỀ QUỸ (NỔI BẬT NHẤT) */}
          <div 
            style={{ 
              padding: '18px 20px', 
              background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
              borderRadius: '14px',
              color: '#ffffff',
              boxShadow: '0 8px 20px rgba(30, 58, 138, 0.28)',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '12px'
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#bfdbfe' }}>
                  🎯 TỔNG THỰC TẾ CẦN THU VỀ QUỸ
                </span>
                <span style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold' }}>
                  {selectedWeek}
                </span>
              </div>
              <div style={{ fontSize: '27px', fontWeight: '800', letterSpacing: '0.5px', margin: '8px 0 4px 0', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                {formatVND(weekTotalDue)}
              </div>
            </div>

            {/* Chi tiết minh bạch cấu thành số tiền */}
            <div style={{ background: 'rgba(0, 0, 0, 0.18)', borderRadius: '10px', padding: '8px 12px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ opacity: 0.9 }}>📄 Tiền photo tuần:</span>
                <span style={{ fontWeight: 'bold' }}>{formatVND(weekPhotoAmount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ opacity: 0.9 }}>🔴 Nợ cũ mang sang ({debtClassesCount} lớp):</span>
                <span style={{ fontWeight: 'bold', color: '#fca5a5' }}>+{formatVND(weekDebtAmount)}</span>
              </div>
            </div>

            {/* Nút bấm 1-click điền phiếu thu */}
            <button
              type="button"
              onClick={handleAutoFillWeeklyIncome}
              style={{
                width: '100%',
                padding: '9px 14px',
                background: '#ffffff',
                color: '#1e3a8a',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '7px',
                boxShadow: '0 3px 8px rgba(0,0,0,0.15)',
                transition: 'all 0.15s'
              }}
              title="Tự động điền số tiền này vào Form Ghi Sổ Quỹ bên dưới để bạn ghi sổ chỉ trong 1 giây"
            >
              <Sparkles size={15} color="#2563eb" />
              <span>⚡ Điền Nhanh Vào Sổ Quỹ</span>
            </button>
          </div>

          {/* CARD 2: ĐÃ THU VÀO SỔ QUỸ (TUẦN NÀY) */}
          <div 
            style={{ 
              padding: '18px 20px', 
              background: '#ffffff',
              borderRadius: '14px',
              border: '1.5px solid #a7f3d0',
              boxShadow: '0 4px 14px rgba(5, 150, 105, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '12px'
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 'bold', textTransform: 'uppercase', color: '#059669' }}>
                  💵 ĐÃ THU VÀO SỔ QUỸ ({selectedWeek})
                </span>
                <TrendingUp size={20} color="#059669" />
              </div>
              <div style={{ fontSize: '25px', fontWeight: '800', color: '#065f46', margin: '8px 0 4px 0' }}>
                {formatVND(weekCollectedFund)}
              </div>
            </div>

            {/* Thanh tiến độ thu */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#047857' }}>
                <span>Tiến độ thu về quỹ:</span>
                <span>{collectionPercent}%</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                <div 
                  style={{ 
                    width: `${collectionPercent}%`, 
                    height: '100%', 
                    background: collectionPercent >= 100 ? '#10b981' : 'linear-gradient(90deg, #3b82f6, #10b981)',
                    transition: 'width 0.4s ease'
                  }} 
                />
              </div>
            </div>

            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Đã ghi nhận <b>{weekCashflowItems.filter(i => i.type === 'THU').length}</b> phiếu thu của {selectedWeek}
            </div>
          </div>

          {/* CARD 3: CÒN THIẾU CHƯA THU VỀ QUỸ */}
          <div 
            style={{ 
              padding: '18px 20px', 
              background: weekRemainingToCollect > 0 ? '#fff7ed' : '#f0fdf4',
              borderRadius: '14px',
              border: `1.5px solid ${weekRemainingToCollect > 0 ? '#fed7aa' : '#bbf7d0'}`,
              boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '12px'
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 'bold', textTransform: 'uppercase', color: weekRemainingToCollect > 0 ? '#c2410c' : '#15803d' }}>
                  ⚠️ CÒN THIẾU CHƯA THU VỀ QUỸ
                </span>
                {weekRemainingToCollect > 0 ? <AlertTriangle size={20} color="#ea580c" /> : <CheckCircle2 size={20} color="#16a34a" />}
              </div>
              <div style={{ fontSize: '25px', fontWeight: '800', color: weekRemainingToCollect > 0 ? '#b91c1c' : '#166534', margin: '8px 0 4px 0' }}>
                {formatVND(weekRemainingToCollect)}
              </div>
            </div>

            <div style={{ fontSize: '12.5px', color: weekRemainingToCollect > 0 ? '#9a3412' : '#14532d', background: weekRemainingToCollect > 0 ? 'rgba(234, 88, 12, 0.12)' : 'rgba(22, 163, 74, 0.12)', padding: '6px 10px', borderRadius: '8px', fontWeight: '600' }}>
              {weekRemainingToCollect === 0 
                ? '✅ Đã thu đủ 100% tiền của tuần này!' 
                : `👉 Cần thu thêm ${formatVND(weekRemainingToCollect)} để đủ quỹ`}
            </div>

            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              = Tổng cần thu trừ đi Số tiền đã ghi vào Sổ Quỹ
            </div>
          </div>

          {/* CARD 4: CHI PHÍ VẬT TƯ & LỢI NHUẬN TUẦN */}
          <div 
            style={{ 
              padding: '18px 20px', 
              background: '#ffffff',
              borderRadius: '14px',
              border: '1.5px solid #cbd5e1',
              boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '12px'
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 'bold', textTransform: 'uppercase', color: '#475569' }}>
                  🛠️ CHI VẬT TƯ ({selectedWeek})
                </span>
                <TrendingDown size={20} color="#dc2626" />
              </div>
              <div style={{ fontSize: '25px', fontWeight: '800', color: '#991b1b', margin: '8px 0 4px 0' }}>
                {formatVND(weekExpenseFund)}
              </div>
            </div>

            <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12.5px', fontWeight: 'bold', color: '#334155' }}>Quỹ ròng tuần này:</span>
              <span style={{ fontSize: '15px', fontWeight: '800', color: weekNetFund >= 0 ? '#047857' : '#dc2626' }}>
                {formatVND(weekNetFund)}
              </span>
            </div>

            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Đã ghi nhận <b>{weekCashflowItems.filter(i => i.type === 'CHI').length}</b> phiếu chi vật tư trong tuần
            </div>
          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. THỐNG KÊ TỔNG THỂ TOÀN BỘ SỔ QUỸ (TẤT CẢ THỜI GIAN)                   */}
      {/* ========================================================================= */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-bold)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Wallet size={18} color="var(--color-primary)" />
            <span>TỔNG HỢP QUỸ TIỀN MẶT PHÒNG PHOTO (TOÀN THỜI GIAN / THEO BỘ LỌC)</span>
          </h3>
          <span style={{ fontSize: '12.5px', color: 'var(--text-sub)' }}>
            Dựa trên {filteredList.length} phiếu ghi sổ
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
          {/* Total Income */}
          <div 
            className="neu-card-sm"
            style={{ 
              padding: '16px', 
              background: 'linear-gradient(135deg, #edf7f0, #f5fbf7)',
              borderLeft: '5px solid var(--color-success)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--color-success)' }}>TỔNG TIỀN THU VÀO</span>
              <TrendingUp size={18} color="var(--color-success)" />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#0d6338', marginTop: '4px' }}>
              {formatVND(globalStats.totalThu)}
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Tổng các phiếu THU đã ghi sổ
            </div>
          </div>

          {/* Total Expense */}
          <div 
            className="neu-card-sm"
            style={{ 
              padding: '16px', 
              background: 'linear-gradient(135deg, #fdf1f1, #fef7f7)',
              borderLeft: '5px solid var(--color-danger)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--color-danger)' }}>TỔNG CHI PHÍ VẬT TƯ</span>
              <TrendingDown size={18} color="var(--color-danger)" />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#961e1e', marginTop: '4px' }}>
              {formatVND(globalStats.totalChi)}
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Tổng chi mua giấy, nạp mực, sửa máy
            </div>
          </div>

          {/* Net Profit */}
          <div 
            className="neu-card-sm"
            style={{ 
              padding: '16px', 
              background: 'linear-gradient(135deg, #e7effa, #f1f6fd)',
              borderLeft: '5px solid var(--color-primary)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--color-primary)' }}>QUỸ TIỀN MẶT CÒN LẠI</span>
              <Wallet size={18} color="var(--color-primary)" />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 'bold', color: 'var(--color-primary-dark)', marginTop: '4px' }}>
              {formatVND(globalStats.netProfit)}
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
              = Tổng Thu trừ đi Tổng Chi
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. THANH BỘ LỌC DANH SÁCH                                                */}
      {/* ========================================================================= */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Filter size={15} /> Lọc sổ:
          </span>

          <select 
            className="neu-select" 
            value={filterType} 
            onChange={e => setFilterType(e.target.value)}
            style={{ width: '130px', padding: '6px 10px', fontSize: '13px' }}
          >
            <option value="ALL">Tất Cả Loại</option>
            <option value="THU">Chỉ Khoản Thu</option>
            <option value="CHI">Chỉ Khoản Chi</option>
          </select>

          <select 
            className="neu-select" 
            value={filterWeek} 
            onChange={e => setFilterWeek(e.target.value)}
            style={{ width: '130px', padding: '6px 10px', fontSize: '13px', fontWeight: '600' }}
          >
            <option value="ALL">Tất Cả Tuần</option>
            {availableWeeks.map(w => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>

          <select 
            className="neu-select" 
            value={filterMonth} 
            onChange={e => setFilterMonth(e.target.value)}
            style={{ width: '120px', padding: '6px 10px', fontSize: '13px' }}
          >
            <option value="ALL">Tất Cả Tháng</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m.toString()}>Tháng {m}</option>
            ))}
          </select>

          <select 
            className="neu-select" 
            value={filterYear} 
            onChange={e => setFilterYear(e.target.value)}
            style={{ width: '110px', padding: '6px 10px', fontSize: '13px' }}
          >
            <option value="ALL">Tất Cả Năm</option>
            <option value="2025">Năm 2025</option>
            <option value="2026">Năm 2026</option>
            <option value="2027">Năm 2027</option>
          </select>
        </div>

        <div style={{ fontSize: '13px', color: 'var(--text-sub)' }}>
          Hiển thị <b>{filteredList.length}</b> phiếu ghi sổ
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. FORM GHI SỔ QUỸ MỚI (CÓ NÚT GỢI Ý NHANH)                              */}
      {/* ========================================================================= */}
      <div 
        id="cashflow-record-form"
        className="neu-card-sm"
        style={{ padding: '18px', background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <span style={{ fontSize: '13.5px', fontWeight: 'bold', color: 'var(--text-bold)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={16} color="var(--color-primary)" />
            <span>GHI PHIẾU THU / CHI VÀO SỔ QUỸ:</span>
          </span>

          {/* Các nút bấm điền nhanh mẫu chi vật tư hay dùng */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => handleQuickExpenseFill('Mua giấy ram A4', '350000', 'Cửa hàng giấy')}
              style={{ padding: '3px 8px', fontSize: '11.5px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', color: '#b91c1c', fontWeight: '600' }}
              title="Điền nhanh khoản chi mua giấy A4"
            >
              + Chi Giấy A4 (350k)
            </button>

            <button
              type="button"
              onClick={() => handleQuickExpenseFill('Nạp mực máy photo', '120000', 'Kỹ thuật nạp mực')}
              style={{ padding: '3px 8px', fontSize: '11.5px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', color: '#b91c1c', fontWeight: '600' }}
              title="Điền nhanh khoản chi nạp mực máy photo"
            >
              + Chi Nạp Mực (120k)
            </button>

            <button
              type="button"
              onClick={() => handleQuickExpenseFill('Sửa chữa / Bảo dưỡng máy', '', 'Thợ kỹ thuật')}
              style={{ padding: '3px 8px', fontSize: '11.5px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', color: '#b91c1c', fontWeight: '600' }}
              title="Điền nhanh khoản chi sửa chữa máy"
            >
              + Chi Sửa Máy
            </button>
          </div>
        </div>

        <form 
          onSubmit={handleSubmit}
          style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}
        >
          <div style={{ width: '120px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '3px' }}>Ngày:</label>
            <input 
              type="date"
              className="neu-input"
              value={newRecord.date}
              onChange={e => setNewRecord({ ...newRecord, date: e.target.value })}
              required
              style={{ padding: '6px 8px', fontSize: '13px' }}
            />
          </div>

          <div style={{ width: '105px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '3px' }}>Tuần:</label>
            <select
              className="neu-select"
              value={newRecord.week || selectedWeek}
              onChange={e => setNewRecord({ ...newRecord, week: e.target.value })}
              style={{ padding: '6px 8px', fontSize: '13px', fontWeight: 'bold', color: '#1e3a8a' }}
            >
              {availableWeeks.map(w => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>

          <div style={{ width: '110px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '3px' }}>Loại:</label>
            <select 
              className="neu-select"
              value={newRecord.type}
              onChange={e => setNewRecord({ ...newRecord, type: e.target.value })}
              style={{ padding: '6px 8px', fontSize: '13px', fontWeight: 'bold', color: newRecord.type === 'THU' ? 'var(--color-success)' : 'var(--color-danger)' }}
            >
              <option value="THU">THU (+)</option>
              <option value="CHI">CHI (-)</option>
            </select>
          </div>

          <div style={{ flex: '2', minWidth: '190px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '3px' }}>Nội Dung Hạng Mục:</label>
            <input 
              type="text"
              className="neu-input"
              placeholder="VD: Thu tiền photo toàn trường (Tuần 7) / Mua giấy A4"
              value={newRecord.category}
              onChange={e => setNewRecord({ ...newRecord, category: e.target.value })}
              required
              style={{ padding: '6px 10px', fontSize: '13px', fontWeight: '600' }}
            />
          </div>

          <div style={{ width: '150px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '3px' }}>Số Tiền (VNĐ):</label>
            <input 
              id="cashflow-amount-input"
              type="number"
              min="100"
              step="100"
              className="neu-input"
              placeholder="VD: 500000"
              value={newRecord.amount}
              onChange={e => setNewRecord({ ...newRecord, amount: e.target.value })}
              required
              style={{ padding: '6px 10px', fontSize: '14px', fontWeight: 'bold', color: newRecord.type === 'THU' ? 'var(--color-success)' : 'var(--color-danger)' }}
            />
          </div>

          <div style={{ flex: '1', minWidth: '150px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '3px' }}>Người Nộp / Nhận:</label>
            <input 
              type="text"
              className="neu-input"
              placeholder="VD: Các lớp & GV toàn trường"
              value={newRecord.payer}
              onChange={e => setNewRecord({ ...newRecord, payer: e.target.value })}
              style={{ padding: '6px 10px', fontSize: '13px' }}
            />
          </div>

          <button 
            type="submit" 
            className="neu-btn neu-btn-primary" 
            style={{ 
              padding: '8px 18px', 
              fontSize: '13.5px',
              fontWeight: 'bold',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: newRecord.type === 'THU' ? 'linear-gradient(135deg, #059669, #047857)' : 'linear-gradient(135deg, #dc2626, #b91c1c)',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <Plus size={16} />
            <span>Ghi Sổ ({newRecord.type === 'THU' ? 'Thu' : 'Chi'})</span>
          </button>
        </form>
      </div>

      {/* ========================================================================= */}
      {/* 6. BẢNG DANH SÁCH CHI TIẾT CÁC PHIẾU GHI SỔ                               */}
      {/* ========================================================================= */}
      <div className="excel-table-container" style={{ maxHeight: '450px' }}>
        <table className="excel-table">
          <thead>
            <tr>
              <th style={{ width: '45px' }}>STT</th>
              <th style={{ width: '95px' }}>Mã Phiếu</th>
              <th style={{ width: '90px' }}>Tuần</th>
              <th style={{ width: '105px' }}>Ngày Ghi Sổ</th>
              <th style={{ width: '85px' }}>Loại</th>
              <th>Nội Dung Hạng Mục</th>
              <th style={{ width: '145px', textAlign: 'right' }}>Số Tiền</th>
              <th style={{ width: '180px' }}>Người Giao Dịch</th>
              <th style={{ width: '60px', textAlign: 'center' }}>Xóa</th>
            </tr>
          </thead>
          <tbody>
            {filteredList.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '35px', color: 'var(--text-muted)' }}>
                  <Receipt size={40} style={{ opacity: 0.35, marginBottom: '8px' }} />
                  <p style={{ margin: 0, fontWeight: 'bold' }}>Chưa có phiếu thu / chi nào phù hợp với bộ lọc</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12.5px' }}>
                    Hãy sử dụng nút "⚡ Điền Nhanh Vào Sổ Quỹ" ở trên để ghi khoản thu photo tuần {selectedWeek}
                  </p>
                </td>
              </tr>
            ) : (
              filteredList.map((item, idx) => (
                <tr key={item.id}>
                  <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                  <td style={{ textAlign: 'center', fontWeight: '600', fontSize: '13px' }}>{item.id}</td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#1e3a8a' }}>
                    {item.week || '—'}
                  </td>
                  <td style={{ textAlign: 'center' }}>{item.date}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span 
                      className="neu-chip"
                      style={{
                        fontSize: '11.5px',
                        fontWeight: 'bold',
                        padding: '3px 8px',
                        background: item.type === 'THU' ? 'rgba(25, 135, 84, 0.15)' : 'rgba(220, 53, 69, 0.15)',
                        color: item.type === 'THU' ? 'var(--color-success)' : 'var(--color-danger)',
                        borderColor: item.type === 'THU' ? 'var(--color-success)' : 'var(--color-danger)'
                      }}
                    >
                      {item.type === 'THU' ? '+ THU' : '- CHI'}
                    </span>
                  </td>
                  <td style={{ fontWeight: '600' }}>
                    <div>{item.category}</div>
                    {item.note && (
                      <div style={{ fontSize: '11.5px', color: 'var(--text-sub)', fontWeight: 'normal', marginTop: '2px' }}>
                        {item.note}
                      </div>
                    )}
                  </td>
                  <td 
                    style={{ 
                      textAlign: 'right', 
                      fontWeight: 'bold', 
                      fontSize: '15px',
                      color: item.type === 'THU' ? 'var(--color-success)' : 'var(--color-danger)'
                    }}
                  >
                    {item.type === 'THU' ? '+' : '-'}{formatVND(item.amount)}
                  </td>
                  <td>{item.payer || '—'}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button 
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Bạn có chắc chắn muốn xóa phiếu "${item.id}" (${formatVND(item.amount)})?`)) {
                          removeCashflowRecord(item.id);
                        }
                      }}
                      style={{ border: 'none', background: 'transparent', color: 'var(--color-danger)', cursor: 'pointer', padding: '4px' }}
                      title="Xóa phiếu ghi sổ này"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
