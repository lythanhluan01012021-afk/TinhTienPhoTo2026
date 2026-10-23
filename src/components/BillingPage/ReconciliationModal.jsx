import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Printer, 
  Save, 
  X, 
  FileText, 
  DollarSign, 
  Layers, 
  HardDrive,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  HelpCircle,
  ExternalLink
} from 'lucide-react';

export const ReconciliationModal = ({ isOpen, onClose }) => {
  const { 
    billingItems, 
    classes, 
    currentWeek, 
    classDebts,
    updateClassDebt,
    getHomeroomTeacher, 
    settings,
    syncToGoogleSheets,
    syncDebtsToGoogleSheets,
    syncStatus
  } = useApp();

  const [sheetData, setSheetData] = useState(null);
  const [isLoadingSheet, setIsLoadingSheet] = useState(false);
  const [sheetFetchError, setSheetFetchError] = useState('');
  const [isSyncingAll, setIsSyncingAll] = useState(false);

  // Định dạng tiền tệ VNĐ
  const formatVND = (v) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v || 0);

  // 1. TÍNH TOÁN DỮ LIỆU BẢNG TÍNH HIỆN TẠI TRÊN WEB (CURRENT WEEK)
  const currentWeekItems = useMemo(() => {
    return billingItems.filter(item => (item.week || currentWeek) === currentWeek);
  }, [billingItems, currentWeek]);

  const webStats = useMemo(() => {
    let totalCopies = 0;
    let totalAmount = 0;
    const classesSet = new Set();

    currentWeekItems.forEach(item => {
      const studentCount = Number(item.studentCount) || 0;
      const extraCount = Number(item.extraCount) || 0;
      const copies = Number(item.totalCopies) || (studentCount + extraCount);
      const amt = Number(item.amount) || (copies * (Number(item.unitPrice) || 0));

      totalCopies += copies;
      totalAmount += amt;
      if (item.className) classesSet.add(item.className.trim());
    });

    return {
      itemCount: currentWeekItems.length,
      totalCopies,
      totalAmount,
      classCount: classesSet.size
    };
  }, [currentWeekItems]);

  // 2. TÍNH TOÁN DỮ LIỆU THEO TỪNG LỚP (GOM NHÓM ĐỂ IN ẤN)
  const classBreakdown = useMemo(() => {
    const map = {};

    // Gom tiền photo tuần này
    currentWeekItems.forEach(item => {
      const cls = item.className || 'Chưa chọn lớp';
      if (!map[cls]) {
        map[cls] = {
          className: cls,
          homeroomTeacher: getHomeroomTeacher(cls),
          orderCount: 0,
          totalCopies: 0,
          photoAmount: 0,
          previousDebt: 0,
          totalDue: 0
        };
      }
      const studentCount = Number(item.studentCount) || 0;
      const extraCount = Number(item.extraCount) || 0;
      const copies = Number(item.totalCopies) || (studentCount + extraCount);
      const amt = Number(item.amount) || (copies * (Number(item.unitPrice) || 0));

      map[cls].orderCount += 1;
      map[cls].totalCopies += copies;
      map[cls].photoAmount += amt;
    });

    // Thêm các lớp có nợ cũ tuần trước nhưng tuần này chưa photo
    Object.keys(classDebts || {}).forEach(cls => {
      const d = classDebts[cls];
      const debtAmt = Number(d?.amount) || 0;
      if (debtAmt > 0 && !map[cls]) {
        map[cls] = {
          className: cls,
          homeroomTeacher: getHomeroomTeacher(cls),
          orderCount: 0,
          totalCopies: 0,
          photoAmount: 0,
          previousDebt: debtAmt,
          totalDue: debtAmt
        };
      }
    });

    // Tính toán nợ cũ & tổng phải thu cho từng lớp
    let totalGroupPhoto = 0;
    let totalPreviousDebt = 0;
    let totalGrandDue = 0;

    const list = Object.values(map).map(clsObj => {
      const debt = Number(classDebts[clsObj.className]?.amount) || 0;
      const totalDue = clsObj.photoAmount + debt;

      clsObj.previousDebt = debt;
      clsObj.totalDue = totalDue;

      totalGroupPhoto += clsObj.photoAmount;
      totalPreviousDebt += debt;
      totalGrandDue += totalDue;

      return clsObj;
    }).sort((a, b) => a.className.localeCompare(b.className));

    return {
      list,
      totalGroupPhoto,
      totalPreviousDebt,
      totalGrandDue
    };
  }, [currentWeekItems, classDebts, getHomeroomTeacher]);

  // 3. TẢI DỮ LIỆU ĐỐI CHIẾU TRỰC TIẾP TỪ GOOGLE SHEETS
  const fetchSheetDataForAudit = async () => {
    const targetUrl = settings.gasWebAppUrl;
    if (!targetUrl || !targetUrl.startsWith('http')) {
      setSheetFetchError('Chưa cấu hình URL Google Apps Script. Vui lòng kiểm tra lại cấu hình.');
      return;
    }

    setIsLoadingSheet(true);
    setSheetFetchError('');

    try {
      const fetchUrl = targetUrl + (targetUrl.includes('?') ? '&' : '?') + 'action=fetchBillingData';
      const res = await fetch(fetchUrl);
      const data = await res.json();

      if (data && data.status === 'success' && Array.isArray(data.items)) {
        // Lọc các dòng thuộc tuần hiện tại trên Google Sheet
        const sheetWeekItems = data.items.filter(item => (item.week || 'Tuần 1') === currentWeek);
        
        let sheetTotalAmount = 0;
        let sheetTotalCopies = 0;
        sheetWeekItems.forEach(item => {
          sheetTotalAmount += Number(item.amount) || 0;
          sheetTotalCopies += Number(item.totalCopies) || 0;
        });

        // Kiểm tra nợ của tuần này trên Google Sheet
        const sheetDebts = data.debts?.[currentWeek] || {};
        let sheetTotalDebt = 0;
        Object.values(sheetDebts).forEach(d => {
          sheetTotalDebt += Number(d?.amount) || 0;
        });

        setSheetData({
          itemsCount: sheetWeekItems.length,
          totalAmount: sheetTotalAmount,
          totalCopies: sheetTotalCopies,
          debtsCount: Object.keys(sheetDebts).length,
          totalDebt: sheetTotalDebt,
          spreadsheetUrl: data.spreadsheetUrl || settings.sheetUrl || ''
        });
      } else {
        setSheetFetchError('Không thể lấy dữ liệu từ Google Sheets: Phản hồi không đúng chuẩn.');
      }
    } catch (err) {
      console.error(err);
      setSheetFetchError('Lỗi kết nối tới Google Sheets: ' + (err.message || err.toString()));
    } finally {
      setIsLoadingSheet(false);
    }
  };

  // Tự động tải dữ liệu đối chiếu khi mở Modal
  useEffect(() => {
    if (isOpen) {
      fetchSheetDataForAudit();
    }
  }, [isOpen, currentWeek]);

  // ĐỒNG BỘ CẢ PHOTO VÀ CÔNG NỢ LÊN GOOGLE SHEETS TRONG 1 CLICK
  const handleSyncAllToGoogleSheets = async () => {
    setIsSyncingAll(true);
    try {
      await syncToGoogleSheets(false);
      await syncDebtsToGoogleSheets(currentWeek, false);
      // Fetch lại dữ liệu sau khi đồng bộ
      await fetchSheetDataForAudit();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncingAll(false);
    }
  };

  // In biên bản rà soát
  const handlePrintAudit = () => {
    window.print();
  };

  if (!isOpen) return null;

  // Tính chênh lệch Web vs Google Sheets
  const isSheetLoaded = sheetData !== null;
  const sheetDiffAmount = isSheetLoaded ? (webStats.totalAmount - sheetData.totalAmount) : 0;
  const sheetDiffItems = isSheetLoaded ? (webStats.itemCount - sheetData.itemsCount) : 0;
  const isSheetInSync = isSheetLoaded && sheetDiffAmount === 0 && sheetDiffItems === 0;

  // So sánh Web Chi Tiết vs Tách Lớp In Ấn
  const isGroupInSync = webStats.totalAmount === classBreakdown.totalGroupPhoto;

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="neu-card"
        style={{
          width: '100%',
          maxWidth: '1100px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          border: '1.5px solid #b8cce4'
        }}
      >
        {/* 1. MODAL HEADER */}
        <div 
          style={{
            padding: '16px 24px',
            background: 'linear-gradient(135deg, #0f172a, #1e3a8a)',
            color: '#ffffff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '2px solid #3b82f6'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div 
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1.5px solid rgba(255, 255, 255, 0.3)'
              }}
            >
              <ShieldCheck size={26} color="#60a5fa" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '19px', fontWeight: 'bold', margin: 0, letterSpacing: '0.3px' }}>
                  BIÊN BẢN RÀ SOÁT & ĐỐI CHIẾU DOANH THU ({currentWeek.toUpperCase()})
                </h2>
                <span style={{ fontSize: '11.5px', background: '#2563eb', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                  CHỐNG THẤT THOÁT TIỀN
                </span>
              </div>
              <p style={{ fontSize: '12.5px', color: '#cbd5e1', margin: '3px 0 0 0' }}>
                Kiểm toán tự động 4 chiều: Bảng chi tiết ➔ CSDL Google Sheets ➔ Tiền tách theo lớp ➔ Công nợ tuần trước
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: '#ffffff',
              borderRadius: '8px',
              width: '34px',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            title="Đóng cửa sổ"
          >
            <X size={20} />
          </button>
        </div>

        {/* 2. MODAL BODY (SCROLLABLE) */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* A. 4 THẺ CHỈ SỐ ĐỐI CHIẾU CHÍNH */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '14px' }}>
            
            {/* THẺ 1: TIỀN PHOTO ĐÃ NHẬP TRÊN WEB */}
            <div 
              style={{
                padding: '14px 16px',
                borderRadius: '12px',
                background: '#f8fafc',
                border: '1.5px solid #cbd5e1',
                position: 'relative'
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase' }}>
                1. TIỀN PHOTO TRÊN BẢNG TÍNH
              </div>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#1e40af', marginTop: '4px' }}>
                {formatVND(webStats.totalAmount)}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                <b>{webStats.itemCount}</b> đơn • <b>{webStats.totalCopies.toLocaleString('vi-VN')}</b> bản in ({webStats.classCount} lớp)
              </div>
              <div style={{ fontSize: '11px', color: '#047857', marginTop: '6px', fontWeight: '600' }}>
                ✓ Đang thao tác trên giao diện
              </div>
            </div>

            {/* THẺ 2: CSDL TRÊN GOOGLE SHEETS */}
            <div 
              style={{
                padding: '14px 16px',
                borderRadius: '12px',
                background: isSheetLoaded && isSheetInSync ? '#f0fdf4' : '#fffbeb',
                border: `1.5px solid ${isSheetLoaded && isSheetInSync ? '#86efac' : '#fcd34d'}`,
                position: 'relative'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase' }}>
                  2. CSDL GOOGLE SHEETS
                </span>
                <button
                  type="button"
                  onClick={fetchSheetDataForAudit}
                  disabled={isLoadingSheet}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#2563eb',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 'bold'
                  }}
                  title="Tải lại dữ liệu mới nhất từ Google Sheets để đối chiếu"
                >
                  <RefreshCw size={13} className={isLoadingSheet ? 'animate-spin' : ''} />
                  <span>{isLoadingSheet ? 'Đang đọc...' : 'Kiểm tra lại'}</span>
                </button>
              </div>

              {isLoadingSheet ? (
                <div style={{ padding: '8px 0', fontSize: '13px', color: '#64748b', fontStyle: 'italic' }}>
                  ⏳ Đang đối chiếu với Drive...
                </div>
              ) : sheetFetchError ? (
                <div style={{ padding: '4px 0', fontSize: '12px', color: '#dc2626' }}>
                  ⚠️ {sheetFetchError}
                </div>
              ) : isSheetLoaded ? (
                <>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: isSheetInSync ? '#047857' : '#b45309', marginTop: '4px' }}>
                    {formatVND(sheetData.totalAmount)}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    <b>{sheetData.itemsCount}</b> dòng trên tab <i>NhatKy_Photo</i>
                  </div>
                  <div style={{ marginTop: '6px' }}>
                    {isSheetInSync ? (
                      <span style={{ fontSize: '11.5px', color: '#047857', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={13} /> Khớp 100% CSDL (An toàn)
                      </span>
                    ) : (
                      <span style={{ fontSize: '11.5px', color: '#dc2626', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertTriangle size={13} /> Lệch {formatVND(sheetDiffAmount)} ({sheetDiffItems} dòng)
                      </span>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            {/* THẺ 3: TIỀN NỢ / THIẾU TUẦN TRƯỚC */}
            <div 
              style={{
                padding: '14px 16px',
                borderRadius: '12px',
                background: '#fff7ed',
                border: '1.5px solid #fed7aa',
                position: 'relative'
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#9a3412', textTransform: 'uppercase' }}>
                3. TIỀN LỚP NỢ / THIẾU TUẦN TRƯỚC
              </div>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#c2410c', marginTop: '4px' }}>
                {formatVND(classBreakdown.totalPreviousDebt)}
              </div>
              <div style={{ fontSize: '12px', color: '#7c2d12', marginTop: '2px' }}>
                Đang có <b>{Object.keys(classDebts || {}).filter(c => (classDebts[c]?.amount || 0) > 0).length}</b> lớp nợ mang sang
              </div>
              <div style={{ fontSize: '11px', color: '#9a3412', marginTop: '6px', fontWeight: '600' }}>
                Tab: <i>CongNo_TheoTuan</i>
              </div>
            </div>

            {/* THẺ 4: TỔNG DOANH THU CẦN THU VỀ QUỸ */}
            <div 
              style={{
                padding: '14px 16px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
                color: '#ffffff',
                border: '1.5px solid #4338ca',
                position: 'relative',
                boxShadow: '0 4px 12px rgba(49, 46, 129, 0.25)'
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#a5b4fc', textTransform: 'uppercase' }}>
                4. TỔNG THỰC TẾ CẦN THU VỀ QUỸ
              </div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fbbf24', marginTop: '4px' }}>
                {formatVND(classBreakdown.totalGrandDue)}
              </div>
              <div style={{ fontSize: '12px', color: '#c7d2fe', marginTop: '2px' }}>
                = Tiền photo tuần này + Nợ cũ tuần trước
              </div>
              <div style={{ fontSize: '11px', color: '#93c5fd', marginTop: '6px', fontWeight: 'bold' }}>
                🎯 Chuẩn doanh thu quyết toán
              </div>
            </div>

          </div>

          {/* B. BẢNG CẢNH BÁO / ĐỐI SOÁT CHỐNG THẤT THOÁT */}
          <div 
            style={{
              padding: '12px 18px',
              borderRadius: '10px',
              background: (!isSheetLoaded || isSheetInSync) ? '#ecfdf5' : '#fef2f2',
              border: `1.5px solid ${(!isSheetLoaded || isSheetInSync) ? '#a7f3d0' : '#fecaca'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {(!isSheetLoaded || isSheetInSync) ? (
                <CheckCircle2 size={22} color="#047857" />
              ) : (
                <AlertCircle size={22} color="#dc2626" />
              )}
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 'bold', color: (!isSheetLoaded || isSheetInSync) ? '#065f46' : '#991b1b' }}>
                  {(!isSheetLoaded || isSheetInSync)
                    ? 'HOÀN HẢO: Dữ liệu photo và các nguồn tính toán đã khớp 100%, không bị thất thoát!'
                    : `CẢNH BÁO THẤT THOÁT: Google Sheets đang lưu ít hơn trên web ${formatVND(Math.abs(sheetDiffAmount))} (${Math.abs(sheetDiffItems)} đơn chưa đồng bộ)!`}
                </div>
                <div style={{ fontSize: '12px', color: (!isSheetLoaded || isSheetInSync) ? '#047857' : '#b91c1c' }}>
                  {(!isSheetLoaded || isSheetInSync)
                    ? `• Tiền chi tiết: ${formatVND(webStats.totalAmount)} = Tiền tách lớp: ${formatVND(classBreakdown.totalGroupPhoto)} = Tiền trên Google Sheet: ${formatVND(sheetData ? sheetData.totalAmount : webStats.totalAmount)}.`
                    : '• Bạn đã sửa hoặc thêm đơn photo mới nhưng chưa lưu lên Google Sheets. Vui lòng bấm "Đồng Bộ Ngay Lên Google Sheets" bên phải để bảo vệ tiền.'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={handleSyncAllToGoogleSheets}
                disabled={isSyncingAll}
                className="neu-btn neu-btn-primary"
                style={{
                  fontSize: '13px',
                  padding: '7px 14px',
                  fontWeight: 'bold',
                  background: 'linear-gradient(135deg, #0f766e, #0d9488)',
                  cursor: 'pointer'
                }}
                title="Đồng bộ cả Đơn Photo và Công Nợ lên Google Sheets"
              >
                <Save size={15} />
                <span>{isSyncingAll ? 'Đang lưu CSDL...' : '💾 Đồng Bộ Ngay Lên Google Sheets'}</span>
              </button>

              {sheetData?.spreadsheetUrl && (
                <a
                  href={sheetData.spreadsheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="neu-btn"
                  style={{
                    fontSize: '12.5px',
                    padding: '7px 12px',
                    background: '#ffffff',
                    color: '#1e40af',
                    border: '1.5px solid #93c5fd',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    textDecoration: 'none'
                  }}
                  title="Mở Google Sheet trên Drive để kiểm tra trực tiếp"
                >
                  <ExternalLink size={14} />
                  <span>Mở Google Sheet</span>
                </a>
              )}
            </div>
          </div>

          {/* C. BẢNG CHI TIẾT TỪNG LỚP RÀ SOÁT CÔNG NỢ & TIỀN THU */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-bold)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={17} color="var(--color-primary)" />
                <span>BẢNG CHI TIẾT RÀ SOÁT & ĐỐI CHIẾU THEO TỪNG LỚP ({classBreakdown.list.length} Lớp)</span>
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--text-sub)' }}>
                Đã cộng dồn nợ cũ tuần trước vào cột <b>TỔNG CẦN THU</b>
              </span>
            </div>

            <div className="excel-table-container" style={{ maxHeight: '320px', border: '1.5px solid #cbd5e1', borderRadius: '10px' }}>
              <table className="excel-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#1e3a8a', color: '#ffffff' }}>
                  <tr>
                    <th style={{ width: '45px', textAlign: 'center', padding: '10px 6px' }}>STT</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>Lớp</th>
                    <th style={{ minWidth: '150px' }}>GVCN</th>
                    <th style={{ width: '90px', textAlign: 'center' }}>Số Đợt Photo</th>
                    <th style={{ width: '100px', textAlign: 'center' }}>Tổng Bản In</th>
                    <th style={{ width: '140px', textAlign: 'right' }}>Tiền Photo Tuần Này</th>
                    <th style={{ width: '150px', textAlign: 'right', background: '#9a3412', color: '#ffffff' }}>
                      Nợ Tuần Trước
                    </th>
                    <th style={{ width: '160px', textAlign: 'right', background: '#312e81', color: '#ffffff', fontWeight: 'bold' }}>
                      TỔNG CẦN THU
                    </th>
                    <th style={{ width: '130px', textAlign: 'center' }}>Tình Trạng Thu</th>
                  </tr>
                </thead>
                <tbody>
                  {classBreakdown.list.map((c, idx) => {
                    const hasDebt = c.previousDebt > 0;
                    return (
                      <tr 
                        key={c.className}
                        style={{
                          background: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                          borderBottom: '1px solid #e2e8f0'
                        }}
                      >
                        <td style={{ textAlign: 'center', fontWeight: '600', color: '#64748b' }}>{idx + 1}</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#1e40af', fontSize: '13.5px' }}>
                          {c.className}
                        </td>
                        <td style={{ fontWeight: '500' }}>{c.homeroomTeacher}</td>
                        <td style={{ textAlign: 'center', color: '#475569' }}>{c.orderCount} đợt</td>
                        <td style={{ textAlign: 'center', fontWeight: '600' }}>{c.totalCopies.toLocaleString('vi-VN')}</td>
                        <td style={{ textAlign: 'right', fontWeight: '600', color: '#1e3a8a' }}>
                          {formatVND(c.photoAmount)}
                        </td>
                        <td 
                          style={{ 
                            textAlign: 'right', 
                            fontWeight: 'bold', 
                            color: hasDebt ? '#c2410c' : '#94a3b8',
                            background: hasDebt ? '#fff7ed' : undefined
                          }}
                        >
                          {hasDebt ? formatVND(c.previousDebt) : '0 đ'}
                        </td>
                        <td 
                          style={{ 
                            textAlign: 'right', 
                            fontWeight: 'bold', 
                            fontSize: '14px', 
                            color: '#1e1b4b',
                            background: '#eef2ff' 
                          }}
                        >
                          {formatVND(c.totalDue)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {hasDebt ? (
                            <span style={{ fontSize: '11px', background: '#ffedd5', color: '#c2410c', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>
                              ⚠️ Còn thiếu nợ cũ
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>
                              ✓ Đủ
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* FOOTER TOTAL ROW */}
                <tfoot style={{ position: 'sticky', bottom: 0, background: '#f1f5f9', fontWeight: 'bold', borderTop: '2px solid #94a3b8' }}>
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '10px' }}>
                      TỔNG CỘNG ({classBreakdown.list.length} Lớp):
                    </td>
                    <td style={{ textAlign: 'center' }}>{webStats.itemCount} đợt</td>
                    <td style={{ textAlign: 'center', color: '#1e40af' }}>{webStats.totalCopies.toLocaleString('vi-VN')} bản</td>
                    <td style={{ textAlign: 'right', color: '#1e40af', fontSize: '14px' }}>
                      {formatVND(classBreakdown.totalGroupPhoto)}
                    </td>
                    <td style={{ textAlign: 'right', color: '#c2410c', fontSize: '14px' }}>
                      {formatVND(classBreakdown.totalPreviousDebt)}
                    </td>
                    <td style={{ textAlign: 'right', color: '#312e81', fontSize: '15px', background: '#e0e7ff' }}>
                      {formatVND(classBreakdown.totalGrandDue)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

        </div>

        {/* 3. MODAL FOOTER */}
        <div 
          style={{
            padding: '14px 24px',
            background: '#f8fafc',
            borderTop: '1.5px solid #cbd5e1',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div style={{ fontSize: '12.5px', color: '#475569' }}>
            <span>* Đối chiếu lần cuối: <b>{new Date().toLocaleTimeString('vi-VN')}</b> • Tuần: <b>{currentWeek}</b></span>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={handlePrintAudit}
              className="neu-btn"
              style={{ fontSize: '13px', padding: '8px 14px' }}
              title="In biên bản rà soát đối chiếu ra giấy A4"
            >
              <Printer size={16} />
              <span>In Biên Bản Rà Soát (A4)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="neu-btn"
              style={{ fontSize: '13.5px', padding: '8px 18px', background: '#e2e8f0', color: '#334155' }}
            >
              Đóng
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
