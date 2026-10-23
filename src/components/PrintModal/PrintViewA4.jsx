import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Printer, X, FileText, CheckCircle2 } from 'lucide-react';

// Chuyển đổi số thành chữ tiếng Việt chuẩn hóa
function numberToVietnameseWords(num) {
  if (!num || isNaN(num) || num === 0) return 'Không đồng';
  
  const units = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];
  const digits = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

  function readGroup(n) {
    let a = Math.floor(n / 100);
    let b = Math.floor((n % 100) / 10);
    let c = n % 10;
    let res = '';

    if (a > 0) {
      res += digits[a] + ' trăm ';
    }
    if (b > 1) {
      res += digits[b] + ' mươi ';
      if (c === 1) res += 'mốt ';
      else if (c === 5) res += 'lăm ';
      else if (c > 0) res += digits[c] + ' ';
    } else if (b === 1) {
      res += 'mười ';
      if (c === 5) res += 'lăm ';
      else if (c > 0) res += digits[c] + ' ';
    } else if (b === 0 && a > 0 && c > 0) {
      res += 'lẻ ' + digits[c] + ' ';
    } else if (c > 0) {
      res += digits[c] + ' ';
    }
    return res;
  }

  let str = Math.floor(num).toString();
  let groups = [];
  while (str.length > 0) {
    groups.unshift(parseInt(str.slice(-3), 10));
    str = str.slice(0, -3);
  }

  let result = '';
  for (let i = 0; i < groups.length; i++) {
    let g = groups[i];
    if (g > 0) {
      let gStr = readGroup(g);
      let unit = units[groups.length - 1 - i];
      result += gStr + unit + ' ';
    }
  }

  result = result.trim();
  result = result.charAt(0).toUpperCase() + result.slice(1) + ' đồng chẵn.';
  return result;
}

export const PrintViewA4 = () => {
  const { 
    isPrintModalOpen, 
    setIsPrintModalOpen, 
    billingItems, 
    settings, 
    printClassFilter, 
    setPrintClassFilter,
    getHomeroomTeacher,
    getStudentCountForClass,
    classDebts,
    totalClassDebts,
    currentWeek
  } = useApp();

  const [printTemplate, setPrintTemplate] = useState('class_invoice'); // 'class_invoice' | 'school_summary'
  const [showSignatures, setShowSignatures] = useState(false); // Mặc định tắt để tiết kiệm giấy in theo yêu cầu
  const [compactMode, setCompactMode] = useState(true); // Mặc định gom nhiều lớp trên cùng 1 trang A4 để tiết kiệm giấy tối đa
  const [includeSummarySheet, setIncludeSummarySheet] = useState(true); // Kèm Bảng Kê Tổng Hợp Chi Tiết Các Lớp để kiểm soát thu tiền & đối chiếu
  const [showClassDetailsDrawer, setShowClassDetailsDrawer] = useState(false); // Xem nhanh bảng tổng hợp chi tiết từng lớp trên modal

  // Danh sách các dòng photo thuộc tuần đang chọn
  const currentWeekItems = useMemo(() => {
    return billingItems.filter(i => (i.week || currentWeek) === currentWeek);
  }, [billingItems, currentWeek]);

  // Danh sách các lớp có đơn photo hoặc có nợ trong tuần đang chọn
  const availableClasses = useMemo(() => {
    const list = Array.from(new Set([
      ...currentWeekItems.map(i => i.className).filter(Boolean),
      ...Object.keys(classDebts || {}).filter(c => (classDebts[c]?.amount || 0) > 0)
    ]));
    return list.sort();
  }, [currentWeekItems, classDebts]);

  // Gom nhóm dữ liệu theo lớp cho tuần đang chọn
  const classGroups = useMemo(() => {
    const map = {};
    currentWeekItems.forEach(item => {
      const cls = item.className || 'Khác';
      if (!map[cls]) {
        map[cls] = {
          className: cls,
          items: [],
          totalCopies: 0,
          totalAmount: 0
        };
      }
      const copies = (Number(item.studentCount) || 0) + (Number(item.extraCount) || 0);
      const amount = copies * (Number(item.unitPrice) || 0);
      map[cls].items.push(item);
      map[cls].totalCopies += copies;
      map[cls].totalAmount += amount;
    });

    // Thêm các lớp có nợ dù không photo đợt này
    Object.keys(classDebts || {}).forEach(cls => {
      const d = classDebts[cls];
      if ((d?.amount || 0) > 0 && !map[cls]) {
        map[cls] = {
          className: cls,
          items: [],
          totalCopies: 0,
          totalAmount: 0
        };
      }
    });

    if (printClassFilter !== 'all') {
      return Object.values(map).filter(g => g.className === printClassFilter);
    }
    return Object.values(map).sort((a, b) => a.className.localeCompare(b.className));
  }, [currentWeekItems, printClassFilter, classDebts]);

  // Tổng cộng toàn trường cho tuần đang chọn
  const grandTotal = useMemo(() => {
    let copies = 0;
    let amount = 0;
    currentWeekItems.forEach(item => {
      const c = (Number(item.studentCount) || 0) + (Number(item.extraCount) || 0);
      copies += c;
      amount += c * (Number(item.unitPrice) || 0);
    });
    return { copies, amount };
  }, [currentWeekItems]);

  // Grand Summary toàn diện dùng cho đối chiếu & in ấn (Đối chiếu chính xác 100% với Bảng Nhập Liệu và Nút Rà Soát)
  const grandSummary = useMemo(() => {
    let totalCopies = 0;
    let photoAmount = 0;
    let debtAmount = 0;

    classGroups.forEach(g => {
      totalCopies += g.totalCopies;
      photoAmount += g.totalAmount;
      const debt = Number(classDebts?.[g.className]?.amount) || 0;
      debtAmount += debt;
    });

    const totalDue = photoAmount + debtAmount;

    // Tính tổng ở bảng nhập liệu để đối chiếu
    const gridTotalAmount = currentWeekItems.reduce((sum, item) => {
      const copies = (Number(item.studentCount) || 0) + (Number(item.extraCount) || 0);
      return sum + copies * (Number(item.unitPrice) || 0);
    }, 0);

    const isMatched = Math.abs(photoAmount - gridTotalAmount) < 1;

    return {
      classesCount: classGroups.length,
      totalCopies,
      photoAmount,
      debtAmount,
      totalDue,
      gridTotalAmount,
      isMatched,
      diff: photoAmount - gridTotalAmount
    };
  }, [classGroups, currentWeekItems, classDebts]);

  const formatVND = (v) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v || 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* 1. Modal Xem Trước A4 trên màn hình máy tính (Ẩn hoàn toàn khi in) */}
      {isPrintModalOpen && (
        <div 
          className="modal-backdrop no-print"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(19, 43, 79, 0.45)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div 
            className="neu-card no-print"
            style={{
              width: '95%',
              maxWidth: '920px',
              maxHeight: '94vh',
              display: 'flex',
              flexDirection: 'column',
              background: '#e8eef5',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.25)'
            }}
          >
            {/* Modal Top Control Bar */}
            <div 
              style={{
                padding: '16px 24px',
                background: 'linear-gradient(135deg, #1b5ebe, #134694)',
                color: '#ffffff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Printer size={22} />
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 'bold' }}>
                    XEM TRƯỚC VÀ IN ẤN KHỔ A4 CHUẨN
                  </h3>
                  <p style={{ fontSize: '12.5px', opacity: 0.9 }}>
                    Hệ thống tự động cộng dồn tiền thiếu / nợ cũ vào Bill in
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setIsPrintModalOpen(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  color: '#ffffff',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Print Options & Filters Bar */}
            <div 
              style={{
                padding: '12px 24px',
                background: '#ffffff',
                borderBottom: '1px solid #cad7e8',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {/* Chọn Mẫu In */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-bold)' }}>Mẫu in:</span>
                  <select 
                    value={printTemplate} 
                    onChange={(e) => setPrintTemplate(e.target.value)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #b8cce4',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: 'var(--color-primary-dark)'
                    }}
                  >
                    <option value="class_invoice">Phiếu Quyết Toán Từng Lớp</option>
                    <option value="school_summary">Bảng Tổng Hợp Toàn Trường</option>
                  </select>
                </div>

                {/* Chọn Lớp cần in */}
                {printTemplate === 'class_invoice' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-bold)' }}>Lớp:</span>
                    <select 
                      value={printClassFilter} 
                      onChange={(e) => setPrintClassFilter(e.target.value)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: '1.5px solid #b8cce4',
                        fontSize: '13px',
                        fontWeight: '600',
                        color: 'var(--color-primary-dark)'
                      }}
                    >
                      <option value="all">Tất cả các lớp ({availableClasses.length})</option>
                      {availableClasses.map(cls => (
                        <option key={cls} value={cls}>Lớp {cls}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {printTemplate === 'class_invoice' && printClassFilter === 'all' && (
                  <label 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px', 
                      fontSize: '13px', 
                      fontWeight: '700',
                      cursor: 'pointer', 
                      userSelect: 'none', 
                      color: '#1e40af',
                      background: '#eff6ff',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #93c5fd'
                    }}
                    title="Kèm Bảng Kê Tổng Hợp Chi Tiết Từng Lớp ở đầu bản in để đối chiếu và kiểm soát thu tiền"
                  >
                    <input 
                      type="checkbox" 
                      checked={includeSummarySheet} 
                      onChange={(e) => setIncludeSummarySheet(e.target.checked)} 
                      style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                    />
                    <span>Kèm Bảng Kê Tổng Hợp Các Lớp</span>
                  </label>
                )}

                {printTemplate === 'class_invoice' && printClassFilter === 'all' && (
                  <label 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px', 
                      fontSize: '13px', 
                      fontWeight: '600',
                      cursor: 'pointer', 
                      userSelect: 'none', 
                      color: 'var(--text-main)',
                      background: '#e8eef5',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cad7e8'
                    }}
                    title="Gom nhiều lớp trên cùng trang A4 để tiết kiệm giấy in"
                  >
                    <input 
                      type="checkbox" 
                      checked={compactMode} 
                      onChange={(e) => setCompactMode(e.target.checked)} 
                      style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                    />
                    <span>Gom lớp tiết kiệm giấy A4</span>
                  </label>
                )}

                <label 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px', 
                    fontSize: '13px', 
                    fontWeight: '600',
                    cursor: 'pointer', 
                    userSelect: 'none', 
                    color: 'var(--text-main)',
                    background: '#e8eef5',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cad7e8'
                  }}
                  title="Mặc định tắt chữ ký để tiết kiệm giấy in A4"
                >
                  <input 
                    type="checkbox" 
                    checked={showSignatures} 
                    onChange={(e) => setShowSignatures(e.target.checked)} 
                    style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                  />
                  <span>Kèm phần chữ ký</span>
                </label>

                {/* Nút In */}
                <button 
                  onClick={handlePrint}
                  className="neu-btn neu-btn-primary"
                  style={{ padding: '8px 22px', fontSize: '15px' }}
                >
                  <Printer size={18} />
                  <span>Thực Hiện In Ngay (Ctrl + P)</span>
                </button>
              </div>
            </div>

            {/* BĂNG ĐỐI CHIẾU & KIỂM SOÁT DOANH THU CÁC LỚP TRÊN MODAL */}
            <div 
              style={{
                padding: '10px 24px',
                background: '#f8fafc',
                borderBottom: '1.5px solid #cbd5e1',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '13px' }}>
                  <span style={{ color: '#64748b' }}>Tổng số lớp: </span>
                  <b style={{ color: '#0f172a' }}>{grandSummary.classesCount} Lớp</b>
                </div>
                <div style={{ fontSize: '13px', borderLeft: '1px solid #cbd5e1', paddingLeft: '14px' }}>
                  <span style={{ color: '#64748b' }}>Tổng bản in: </span>
                  <b style={{ color: '#0f172a' }}>{grandSummary.totalCopies.toLocaleString('vi-VN')} bản</b>
                </div>
                <div style={{ fontSize: '13px', borderLeft: '1px solid #cbd5e1', paddingLeft: '14px' }}>
                  <span style={{ color: '#64748b' }}>Tiền photo tuần này: </span>
                  <b style={{ color: '#1d4ed8', fontSize: '14px' }}>{formatVND(grandSummary.photoAmount)}</b>
                </div>
                {grandSummary.debtAmount > 0 && (
                  <div style={{ fontSize: '13px', borderLeft: '1px solid #cbd5e1', paddingLeft: '14px' }}>
                    <span style={{ color: '#64748b' }}>Nợ cũ: </span>
                    <b style={{ color: '#b91c1c' }}>+{formatVND(grandSummary.debtAmount)}</b>
                  </div>
                )}
                <div style={{ fontSize: '13.5px', borderLeft: '1px solid #cbd5e1', paddingLeft: '14px' }}>
                  <span style={{ color: '#64748b' }}>TỔNG CỘNG THU (BILL): </span>
                  <b style={{ color: '#15803d', fontSize: '15px' }}>{formatVND(grandSummary.totalDue)}</b>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {grandSummary.isMatched ? (
                  <span style={{ 
                    fontSize: '12px', 
                    fontWeight: 'bold', 
                    color: '#15803d', 
                    background: '#dcfce7', 
                    border: '1px solid #86efac', 
                    padding: '4px 10px', 
                    borderRadius: '20px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}>
                    <CheckCircle2 size={14} color="#16a34a" />
                    <span>Khớp 100% Bảng Nhập Liệu & Rà Soát</span>
                  </span>
                ) : (
                  <span style={{ 
                    fontSize: '12px', 
                    fontWeight: 'bold', 
                    color: '#b91c1c', 
                    background: '#fee2e2', 
                    border: '1px solid #fca5a5', 
                    padding: '4px 10px', 
                    borderRadius: '20px'
                  }}>
                    ⚠️ Lệch {formatVND(Math.abs(grandSummary.diff))} so với Bảng Nhập Liệu
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => setShowClassDetailsDrawer(!showClassDetailsDrawer)}
                  style={{
                    background: showClassDetailsDrawer ? '#1d4ed8' : '#ffffff',
                    color: showClassDetailsDrawer ? '#ffffff' : '#1d4ed8',
                    border: '1.5px solid #93c5fd',
                    borderRadius: '8px',
                    padding: '5px 12px',
                    fontSize: '12.5px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <FileText size={14} />
                  <span>{showClassDetailsDrawer ? 'Đóng Bảng Chi Tiết' : 'Xem Bảng Chi Tiết Từng Lớp'}</span>
                </button>
              </div>
            </div>

            {/* Ngăn kéo xem chi tiết tổng tiền từng lớp */}
            {showClassDetailsDrawer && (
              <div style={{
                background: '#ffffff',
                borderBottom: '2px solid #93c5fd',
                maxHeight: '260px',
                overflowY: 'auto',
                padding: '12px 24px',
                boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.05)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <b style={{ fontSize: '13.5px', color: '#1e3a8a' }}>
                    DANH SÁCH CHI TIẾT TỔNG THÀNH TIỀN TỪNG LỚP ({grandSummary.classesCount} LỚP):
                  </b>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Tổng cộng: <b style={{ color: '#15803d' }}>{formatVND(grandSummary.totalDue)}</b>
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                  {classGroups.map(group => {
                    const debt = Number(classDebts?.[group.className]?.amount) || 0;
                    const total = group.totalAmount + debt;
                    return (
                      <div 
                        key={group.className}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          background: '#f8fafc',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <b style={{ fontSize: '13px', color: '#1e40af' }}>Lớp {group.className}</b>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            {group.totalCopies} bản • {group.items.length} đợt
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <b style={{ fontSize: '13px', color: '#0f172a' }}>{formatVND(total)}</b>
                          {debt > 0 && (
                            <div style={{ fontSize: '10px', color: '#b91c1c' }}>
                              (nợ: +{formatVND(debt)})
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* A4 Paper Simulation Preview Box */}
            <div 
              style={{
                flex: '1',
                overflowY: 'auto',
                padding: '24px',
                background: '#c0cdda',
                display: 'flex',
                justifyContent: 'center'
              }}
            >
              {/* Virtual Sheet of Paper */}
              <div 
                style={{
                  width: '100%',
                  maxWidth: '210mm',
                  minHeight: '297mm',
                  background: '#ffffff',
                  padding: '16mm 14mm',
                  boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
                  color: '#000000',
                  fontFamily: '"Times New Roman", Times, serif',
                  fontSize: '13pt',
                  lineHeight: 1.4
                }}
              >
                {printTemplate === 'class_invoice' ? (
                  // TEMPLATE 1: PHIẾU BÀN GIAO & THANH TOÁN THEO LỚP
                  <div>
                    {/* BẢNG TỔNG HỢP CHI TIẾT TẤT CẢ CÁC LỚP TOÀN TRƯỜNG ĐỐI CHIẾU DOANH THU */}
                    {includeSummarySheet && printClassFilter === 'all' && (
                      <div 
                        className="print-page-wrapper print-class-block force-page-break"
                        style={{ 
                          marginBottom: '26px',
                          paddingBottom: '22px',
                          borderBottom: '2.5px solid #1e3a8a'
                        }}
                      >
                        <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                          <h2 style={{ fontSize: '13.5pt', fontWeight: 'bold', textTransform: 'uppercase', margin: '0 0 3px 0' }}>
                            BẢNG KÊ TỔNG HỢP QUYẾT TOÁN TIỀN PHOTO TỪNG LỚP ({currentWeek.toUpperCase()})
                          </h2>
                          <div style={{ fontSize: '10pt', fontStyle: 'italic', color: '#374151' }}>
                            (Bảng kiểm soát đối chiếu doanh thu các lớp • Khớp 100% với Bảng Nhập Liệu & Hệ Thống Rà Soát)
                          </div>
                        </div>

                        <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f3f4f6' }}>
                              <th style={{ border: '1px solid #000', padding: '4px 5px', width: '32px' }}>STT</th>
                              <th style={{ border: '1px solid #000', padding: '4px 5px', width: '60px' }}>Lớp</th>
                              <th style={{ border: '1px solid #000', padding: '4px 5px', width: '140px' }}>GV Chủ Nhiệm</th>
                              <th style={{ border: '1px solid #000', padding: '4px 5px', width: '45px' }}>Sĩ số</th>
                              <th style={{ border: '1px solid #000', padding: '4px 5px', width: '45px' }}>Số đợt</th>
                              <th style={{ border: '1px solid #000', padding: '4px 5px', width: '65px' }}>Tổng bản</th>
                              <th style={{ border: '1px solid #000', padding: '4px 5px', width: '95px' }}>Tiền Tuần Này</th>
                              <th style={{ border: '1px solid #000', padding: '4px 5px', width: '85px' }}>Nợ Cũ</th>
                              <th style={{ border: '1px solid #000', padding: '4px 5px', width: '110px' }}>TỔNG BILL (đ)</th>
                              <th style={{ border: '1px solid #000', padding: '4px 5px', width: '90px' }}>Ký Nộp / Ghi Chú</th>
                            </tr>
                          </thead>
                          <tbody>
                            {classGroups.map((group, idx) => {
                              const homeroom = getHomeroomTeacher(group.className);
                              const siso = getStudentCountForClass(group.className);
                              const debtAmount = Number(classDebts?.[group.className]?.amount) || 0;
                              const totalClassDue = group.totalAmount + debtAmount;
                              return (
                                <tr key={group.className}>
                                  <td style={{ border: '1px solid #000', padding: '4px 5px', textAlign: 'center' }}>{idx + 1}</td>
                                  <td style={{ border: '1px solid #000', padding: '4px 5px', textAlign: 'center', fontWeight: 'bold' }}>{group.className}</td>
                                  <td style={{ border: '1px solid #000', padding: '4px 5px' }}>{homeroom}</td>
                                  <td style={{ border: '1px solid #000', padding: '4px 5px', textAlign: 'right' }}>{siso}</td>
                                  <td style={{ border: '1px solid #000', padding: '4px 5px', textAlign: 'center' }}>{group.items.length}</td>
                                  <td style={{ border: '1px solid #000', padding: '4px 5px', textAlign: 'right' }}>{group.totalCopies.toLocaleString('vi-VN')}</td>
                                  <td style={{ border: '1px solid #000', padding: '4px 5px', textAlign: 'right' }}>{formatVND(group.totalAmount)}</td>
                                  <td style={{ border: '1px solid #000', padding: '4px 5px', textAlign: 'right', color: debtAmount > 0 ? '#b91c1c' : '#555' }}>
                                    {debtAmount > 0 ? formatVND(debtAmount) : '-'}
                                  </td>
                                  <td style={{ border: '1px solid #000', padding: '4px 5px', textAlign: 'right', fontWeight: 'bold', fontSize: '10pt' }}>
                                    {formatVND(totalClassDue)}
                                  </td>
                                  <td style={{ border: '1px solid #000', padding: '4px 5px' }}></td>
                                </tr>
                              );
                            })}

                            {/* Dòng TỔNG CỘNG TOÀN TRƯỜNG */}
                            <tr style={{ backgroundColor: '#e5e7eb', fontWeight: 'bold', fontSize: '10pt' }}>
                              <td colSpan="5" style={{ border: '1px solid #000', padding: '6px', textAlign: 'right', textTransform: 'uppercase' }}>
                                TỔNG CỘNG ({grandSummary.classesCount} LỚP):
                              </td>
                              <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>
                                {grandSummary.totalCopies.toLocaleString('vi-VN')} bản
                              </td>
                              <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right', fontSize: '10.5pt' }}>
                                {formatVND(grandSummary.photoAmount)}
                              </td>
                              <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right', color: grandSummary.debtAmount > 0 ? '#b91c1c' : '#555' }}>
                                {grandSummary.debtAmount > 0 ? formatVND(grandSummary.debtAmount) : '0 đ'}
                              </td>
                              <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right', fontSize: '11pt', color: '#1e3a8a' }}>
                                {formatVND(grandSummary.totalDue)}
                              </td>
                              <td style={{ border: '1px solid #000', padding: '6px' }}></td>
                            </tr>
                          </tbody>
                        </table>

                        <div style={{ marginTop: '8px', fontSize: '9.5pt', fontStyle: 'italic', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            Tổng tiền quyết toán bằng chữ: <b>{numberToVietnameseWords(grandSummary.totalDue)}</b>
                          </div>
                          <div style={{ fontWeight: 'bold', color: '#047857' }}>
                            ✓ Đã đối chiếu khớp 100% với Bảng Nhập Liệu & Rà Soát
                          </div>
                        </div>
                      </div>
                    )}

                    {classGroups.map((group, gIdx) => {
                      const homeroom = getHomeroomTeacher(group.className);
                      const siso = getStudentCountForClass(group.className);
                      const debtAmount = Number(classDebts?.[group.className]?.amount) || 0;
                      const debtNote = classDebts?.[group.className]?.note || '';
                      const totalClassDue = group.totalAmount + debtAmount;
                      const words = numberToVietnameseWords(totalClassDue);

                      return (
                        <div 
                          key={group.className}
                          className={`print-page-wrapper print-class-block ${!compactMode && gIdx < classGroups.length - 1 ? 'force-page-break' : ''}`}
                          style={{ 
                            marginBottom: gIdx < classGroups.length - 1 ? (compactMode ? '16px' : '30px') : '0',
                            borderBottom: gIdx < classGroups.length - 1 && compactMode ? '1.5px dashed #888888' : 'none',
                            paddingBottom: gIdx < classGroups.length - 1 ? (compactMode ? '14px' : '25px') : '0'
                          }}
                        >
                          {/* Title */}
                          <div style={{ textAlign: 'center', marginBottom: '6px' }}>
                            <h2 style={{ fontSize: '13pt', fontWeight: 'bold', textTransform: 'uppercase', margin: '0 0 2px 0' }}>
                              BẢNG KÊ QUYẾT TOÁN TIỀN PHOTO TÀI LIỆU ({currentWeek})
                            </h2>
                            <div style={{ fontSize: '10.5pt' }}>
                              <b>Lớp: {group.className}</b> &nbsp;&nbsp;|&nbsp;&nbsp; 
                              GVCN: <b>{homeroom}</b> &nbsp;&nbsp;|&nbsp;&nbsp; 
                              Sĩ số lớp: <b>{siso} học sinh</b>
                            </div>
                          </div>

                          {/* Items Table */}
                          <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
                            <thead>
                              <tr style={{ backgroundColor: '#f0f0f0' }}>
                                <th style={{ border: '1px solid #000', padding: '4px 6px', width: '35px' }}>STT</th>
                                <th style={{ border: '1px solid #000', padding: '4px 6px', width: '140px' }}>Giáo viên Bộ môn</th>
                                <th style={{ border: '1px solid #000', padding: '4px 6px' }}>Nội dung tài liệu / Đề thi</th>
                                <th style={{ border: '1px solid #000', padding: '4px 6px', width: '50px' }}>Sĩ số</th>
                                <th style={{ border: '1px solid #000', padding: '4px 6px', width: '50px' }}>Số lẻ</th>
                                <th style={{ border: '1px solid #000', padding: '4px 6px', width: '65px' }}>Tổng bản</th>
                                <th style={{ border: '1px solid #000', padding: '4px 6px', width: '75px' }}>Đơn giá</th>
                                <th style={{ border: '1px solid #000', padding: '4px 6px', width: '105px' }}>Thành tiền</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.items.length === 0 ? (
                                <tr>
                                  <td colSpan="8" style={{ border: '1px solid #000', padding: '8px', textAlign: 'center', fontStyle: 'italic', color: '#555' }}>
                                    (Không có tài liệu photo phát sinh đợt này)
                                  </td>
                                </tr>
                              ) : (
                                group.items.map((item, idx) => {
                                  const itemCopies = (Number(item.studentCount) || 0) + (Number(item.extraCount) || 0);
                                  return (
                                    <tr key={idx} style={{ pageBreakInside: 'avoid' }}>
                                      <td style={{ border: '1px solid #000', padding: '4px 5px', textAlign: 'center' }}>{idx + 1}</td>
                                      <td style={{ border: '1px solid #000', padding: '4px 5px' }}>{item.teacherName}</td>
                                      <td style={{ border: '1px solid #000', padding: '4px 5px' }}>{item.subject}</td>
                                      <td style={{ border: '1px solid #000', padding: '4px 5px', textAlign: 'right' }}>{item.studentCount}</td>
                                      <td style={{ border: '1px solid #000', padding: '4px 5px', textAlign: 'right' }}>{item.extraCount}</td>
                                      <td style={{ border: '1px solid #000', padding: '4px 5px', textAlign: 'right', fontWeight: 'bold' }}>{itemCopies}</td>
                                      <td style={{ border: '1px solid #000', padding: '4px 5px', textAlign: 'right' }}>{Number(item.unitPrice).toLocaleString('vi-VN')} đ</td>
                                      <td style={{ border: '1px solid #000', padding: '4px 5px', textAlign: 'right', fontWeight: 'bold' }}>{formatVND(item.amount)}</td>
                                    </tr>
                                  );
                                })
                              )}

                              {/* Dòng cộng tiền photo tuần này */}
                              <tr style={{ fontWeight: 'bold', backgroundColor: '#f9f9f9' }}>
                                <td colSpan="5" style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right', textTransform: 'uppercase' }}>
                                  TIỀN PHOTO TUẦN NÀY:
                                </td>
                                <td style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right' }}>
                                  {group.totalCopies.toLocaleString('vi-VN')}
                                </td>
                                <td style={{ border: '1px solid #000', padding: '5px 6px' }}></td>
                                <td style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right', fontSize: '11pt' }}>
                                  {formatVND(group.totalAmount)}
                                </td>
                              </tr>

                              {/* TỰ ĐỘNG CỘNG DỒN NỢ CŨ / TIỀN THIẾU VÀO BILL TỔNG KHI IN */}
                              {debtAmount > 0 && (
                                <>
                                  <tr style={{ fontWeight: '600', backgroundColor: '#fff7ed', color: '#c2410c' }}>
                                    <td colSpan="7" style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right' }}>
                                      (+) TIỀN NỢ TUẦN TRƯỚC (CHƯA TRẢ / THIẾU) {debtNote ? `(${debtNote})` : ''}:
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right', fontSize: '11pt', fontWeight: 'bold' }}>
                                      + {formatVND(debtAmount)}
                                    </td>
                                  </tr>
                                  <tr style={{ fontWeight: 'bold', backgroundColor: '#eff6ff', color: '#1e3a8a' }}>
                                    <td colSpan="7" style={{ border: '1px solid #000', padding: '6px 6px', textAlign: 'right', textTransform: 'uppercase', fontSize: '11pt' }}>
                                      TỔNG CỘNG LỚP {group.className} CẦN THANH TOÁN (BILL IN):
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '6px 6px', textAlign: 'right', fontSize: '12pt', color: '#b91c1c' }}>
                                      {formatVND(totalClassDue)}
                                    </td>
                                  </tr>
                                </>
                              )}
                            </tbody>
                          </table>

                          {/* Words */}
                          <div style={{ marginTop: '5px', fontSize: '9.5pt', fontStyle: 'italic' }}>
                            Số tiền viết bằng chữ: <b>{words}</b>
                          </div>

                          {/* Signatures Block (Mặc định ẩn để tiết kiệm giấy in tối đa) */}
                          {showSignatures && (
                            <div className="print-signature-section" style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', fontSize: '11pt' }}>
                              <div style={{ width: '45%', textAlign: 'center' }}>
                                <b>ĐẠI DIỆN GVCN / LỚP {group.className}</b><br />
                                <i>(Ký và ghi rõ họ tên)</i>
                                <div style={{ height: '65px' }}></div>
                                <b>{homeroom}</b>
                              </div>
                              <div style={{ width: '45%', textAlign: 'center' }}>
                                <i>Ngày ..... tháng ..... năm 2026</i><br />
                                <b>NGƯỜI LẬP BIỂU / BỘ PHẬN PHOTO</b><br />
                                <i>(Ký và ghi rõ họ tên)</i>
                                <div style={{ height: '65px' }}></div>
                                <b>Nhân viên phụ trách</b>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  // TEMPLATE 2: BẢNG TỔNG HỢP TOÀN TRƯỜNG
                  <div className="print-page-wrapper">
                    <div style={{ textAlign: 'center', marginBottom: '14px' }}>
                      <h2 style={{ fontSize: '16pt', fontWeight: 'bold', textTransform: 'uppercase' }}>
                        BẢNG TỔNG HỢP QUYẾT TOÁN KINH PHÍ PHOTOCOPY ({currentWeek})
                      </h2>
                      <div style={{ fontSize: '12pt', fontStyle: 'italic' }}>
                        Niên khóa: {settings.schoolYear} • {settings.semester}
                      </div>
                    </div>

                    <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5pt' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f0f0f0' }}>
                          <th style={{ border: '1px solid #000', padding: '6px', width: '35px' }}>STT</th>
                          <th style={{ border: '1px solid #000', padding: '6px', width: '140px' }}>Giáo Viên</th>
                          <th style={{ border: '1px solid #000', padding: '6px', width: '60px' }}>Lớp</th>
                          <th style={{ border: '1px solid #000', padding: '6px' }}>Môn Học / Nội Dung</th>
                          <th style={{ border: '1px solid #000', padding: '6px', width: '55px' }}>Sĩ số</th>
                          <th style={{ border: '1px solid #000', padding: '6px', width: '55px' }}>Số lẻ</th>
                          <th style={{ border: '1px solid #000', padding: '6px', width: '65px' }}>Tổng bản</th>
                          <th style={{ border: '1px solid #000', padding: '6px', width: '75px' }}>Đơn giá</th>
                          <th style={{ border: '1px solid #000', padding: '6px', width: '105px' }}>Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentWeekItems.map((item, idx) => {
                          const totalCopies = (Number(item.studentCount) || 0) + (Number(item.extraCount) || 0);
                          return (
                            <tr key={idx} style={{ pageBreakInside: 'avoid' }}>
                              <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center' }}>{idx + 1}</td>
                              <td style={{ border: '1px solid #000', padding: '5px' }}>{item.teacherName}</td>
                              <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', fontWeight: 'bold' }}>{item.className}</td>
                              <td style={{ border: '1px solid #000', padding: '5px' }}>{item.subject}</td>
                              <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'right' }}>{item.studentCount}</td>
                              <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'right' }}>{item.extraCount}</td>
                              <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'right', fontWeight: 'bold' }}>{totalCopies}</td>
                              <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'right' }}>{Number(item.unitPrice).toLocaleString('vi-VN')} đ</td>
                              <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'right', fontWeight: 'bold' }}>{formatVND(item.amount)}</td>
                            </tr>
                          );
                        })}

                        {/* Grand Total Row */}
                        <tr style={{ fontWeight: 'bold', backgroundColor: '#e9e9e9' }}>
                          <td colSpan="6" style={{ border: '1px solid #000', padding: '6px', textAlign: 'right', textTransform: 'uppercase' }}>
                            TỔNG TIỀN PHOTO TOÀN TRƯỜNG:
                          </td>
                          <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>
                            {grandTotal.copies.toLocaleString('vi-VN')} bản
                          </td>
                          <td style={{ border: '1px solid #000', padding: '6px' }}></td>
                          <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right', fontSize: '11.5pt' }}>
                            {formatVND(grandTotal.amount)}
                          </td>
                        </tr>

                        {/* TỔNG TIỀN NỢ CŨ CỦA CÁC LỚP NẾU CÓ */}
                        {totalClassDebts > 0 && (
                          <>
                            <tr style={{ fontWeight: '600', backgroundColor: '#fff7ed', color: '#c2410c' }}>
                              <td colSpan="8" style={{ border: '1px solid #000', padding: '6px', textAlign: 'right', textTransform: 'uppercase' }}>
                                (+) TỔNG TIỀN THIẾU / NỢ CŨ CỦA CÁC LỚP:
                              </td>
                              <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right', fontSize: '11pt', fontWeight: 'bold' }}>
                                + {formatVND(totalClassDebts)}
                              </td>
                            </tr>
                            <tr style={{ fontWeight: 'bold', backgroundColor: '#eff6ff', color: '#1e3a8a' }}>
                              <td colSpan="8" style={{ border: '1px solid #000', padding: '6px', textAlign: 'right', textTransform: 'uppercase', fontSize: '11.5pt' }}>
                                TỔNG KINH PHÍ CẦN THU TOÀN TRƯỜNG:
                              </td>
                              <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right', fontSize: '12pt', color: '#b91c1c' }}>
                                {formatVND(grandTotal.amount + totalClassDebts)}
                              </td>
                            </tr>
                          </>
                        )}
                      </tbody>
                    </table>

                    {/* Words */}
                    <div style={{ marginTop: '10px', fontSize: '11.5pt', fontStyle: 'italic' }}>
                      Tổng kinh phí bằng chữ: <b>{numberToVietnameseWords(grandTotal.amount + totalClassDebts)}</b>
                    </div>

                    {/* Triple Signatures (Mặc định ẩn để tiết kiệm giấy in) */}
                    {showSignatures && (
                      <div className="print-signature-section" style={{ marginTop: '25px', display: 'flex', justifyContent: 'space-between', fontSize: '11pt' }}>
                        <div style={{ width: '30%', textAlign: 'center' }}>
                          <b>NGƯỜI LẬP BẢNG</b><br />
                          <i>(Ký và ghi rõ họ tên)</i>
                          <div style={{ height: '65px' }}></div>
                          <b>Nhân viên phụ trách</b>
                        </div>
                        <div style={{ width: '30%', textAlign: 'center' }}>
                          <b>KẾ TOÁN / THỦ QUỸ</b><br />
                          <i>(Ký và ghi rõ họ tên)</i>
                          <div style={{ height: '65px' }}></div>
                        </div>
                        <div style={{ width: '35%', textAlign: 'center' }}>
                          <i>Ngày ..... tháng ..... năm 2026</i><br />
                          <b>HIỆU TRƯỞNG DUYỆT</b><br />
                          <i>(Ký, đóng dấu)</i>
                          <div style={{ height: '65px' }}></div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Hidden Print-Only DOM for the browser window.print() */}
      <div className="print-only-container">
        {printTemplate === 'class_invoice' ? (
          <div>
            {/* BẢNG TỔNG HỢP CHI TIẾT TẤT CẢ CÁC LỚP TOÀN TRƯỜNG KHI IN */}
            {includeSummarySheet && printClassFilter === 'all' && (
              <div 
                className="print-page-wrapper print-class-block force-page-break"
                style={{ 
                  marginBottom: '26px',
                  paddingBottom: '22px',
                  borderBottom: '2.5px solid #000000'
                }}
              >
                <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                  <h2 style={{ fontSize: '13.5pt', fontWeight: 'bold', textTransform: 'uppercase', margin: '0 0 3px 0' }}>
                    BẢNG KÊ TỔNG HỢP QUYẾT TOÁN TIỀN PHOTO TỪNG LỚP ({currentWeek.toUpperCase()})
                  </h2>
                  <div style={{ fontSize: '10pt', fontStyle: 'italic', color: '#374151' }}>
                    (Bảng kiểm soát đối chiếu doanh thu các lớp • Khớp 100% với Bảng Nhập Liệu & Hệ Thống Rà Soát)
                  </div>
                </div>

                <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f3f4f6' }}>
                      <th style={{ border: '1px solid #000', padding: '4px 5px', width: '32px' }}>STT</th>
                      <th style={{ border: '1px solid #000', padding: '4px 5px', width: '60px' }}>Lớp</th>
                      <th style={{ border: '1px solid #000', padding: '4px 5px', width: '140px' }}>GV Chủ Nhiệm</th>
                      <th style={{ border: '1px solid #000', padding: '4px 5px', width: '45px' }}>Sĩ số</th>
                      <th style={{ border: '1px solid #000', padding: '4px 5px', width: '45px' }}>Số đợt</th>
                      <th style={{ border: '1px solid #000', padding: '4px 5px', width: '65px' }}>Tổng bản</th>
                      <th style={{ border: '1px solid #000', padding: '4px 5px', width: '95px' }}>Tiền Tuần Này</th>
                      <th style={{ border: '1px solid #000', padding: '4px 5px', width: '85px' }}>Nợ Cũ</th>
                      <th style={{ border: '1px solid #000', padding: '4px 5px', width: '110px' }}>TỔNG BILL (đ)</th>
                      <th style={{ border: '1px solid #000', padding: '4px 5px', width: '90px' }}>Ký Nộp / Ghi Chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classGroups.map((group, idx) => {
                      const homeroom = getHomeroomTeacher(group.className);
                      const siso = getStudentCountForClass(group.className);
                      const debtAmount = Number(classDebts?.[group.className]?.amount) || 0;
                      const totalClassDue = group.totalAmount + debtAmount;
                      return (
                        <tr key={group.className}>
                          <td style={{ border: '1px solid #000', padding: '4px 5px', textAlign: 'center' }}>{idx + 1}</td>
                          <td style={{ border: '1px solid #000', padding: '4px 5px', textAlign: 'center', fontWeight: 'bold' }}>{group.className}</td>
                          <td style={{ border: '1px solid #000', padding: '4px 5px' }}>{homeroom}</td>
                          <td style={{ border: '1px solid #000', padding: '4px 5px', textAlign: 'right' }}>{siso}</td>
                          <td style={{ border: '1px solid #000', padding: '4px 5px', textAlign: 'center' }}>{group.items.length}</td>
                          <td style={{ border: '1px solid #000', padding: '4px 5px', textAlign: 'right' }}>{group.totalCopies.toLocaleString('vi-VN')}</td>
                          <td style={{ border: '1px solid #000', padding: '4px 5px', textAlign: 'right' }}>{formatVND(group.totalAmount)}</td>
                          <td style={{ border: '1px solid #000', padding: '4px 5px', textAlign: 'right', color: debtAmount > 0 ? '#b91c1c' : '#555' }}>
                            {debtAmount > 0 ? formatVND(debtAmount) : '-'}
                          </td>
                          <td style={{ border: '1px solid #000', padding: '4px 5px', textAlign: 'right', fontWeight: 'bold', fontSize: '10pt' }}>
                            {formatVND(totalClassDue)}
                          </td>
                          <td style={{ border: '1px solid #000', padding: '4px 5px' }}></td>
                        </tr>
                      );
                    })}

                    {/* Dòng TỔNG CỘNG TOÀN TRƯỜNG */}
                    <tr style={{ backgroundColor: '#e5e7eb', fontWeight: 'bold', fontSize: '10pt' }}>
                      <td colSpan="5" style={{ border: '1px solid #000', padding: '6px', textAlign: 'right', textTransform: 'uppercase' }}>
                        TỔNG CỘNG ({grandSummary.classesCount} LỚP):
                      </td>
                      <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>
                        {grandSummary.totalCopies.toLocaleString('vi-VN')} bản
                      </td>
                      <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right', fontSize: '10.5pt' }}>
                        {formatVND(grandSummary.photoAmount)}
                      </td>
                      <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right', color: grandSummary.debtAmount > 0 ? '#b91c1c' : '#555' }}>
                        {grandSummary.debtAmount > 0 ? formatVND(grandSummary.debtAmount) : '0 đ'}
                      </td>
                      <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right', fontSize: '11pt', color: '#1e3a8a' }}>
                        {formatVND(grandSummary.totalDue)}
                      </td>
                      <td style={{ border: '1px solid #000', padding: '6px' }}></td>
                    </tr>
                  </tbody>
                </table>

                <div style={{ marginTop: '8px', fontSize: '9.5pt', fontStyle: 'italic', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    Tổng tiền quyết toán bằng chữ: <b>{numberToVietnameseWords(grandSummary.totalDue)}</b>
                  </div>
                  <div style={{ fontWeight: 'bold', color: '#047857' }}>
                    ✓ Đã đối chiếu khớp 100% với Bảng Nhập Liệu & Rà Soát
                  </div>
                </div>
              </div>
            )}

            {classGroups.map((group, gIdx) => {
              const homeroom = getHomeroomTeacher(group.className);
              const siso = getStudentCountForClass(group.className);
              const debtAmount = Number(classDebts?.[group.className]?.amount) || 0;
              const debtNote = classDebts?.[group.className]?.note || '';
              const totalClassDue = group.totalAmount + debtAmount;
              const words = numberToVietnameseWords(totalClassDue);

              return (
                <div 
                  key={group.className} 
                  className={`print-page-wrapper print-class-block ${!compactMode && gIdx < classGroups.length - 1 ? 'force-page-break' : ''}`}
                  style={{ 
                    marginBottom: gIdx < classGroups.length - 1 ? (compactMode ? '14px' : '0') : '0', 
                    paddingBottom: gIdx < classGroups.length - 1 ? (compactMode ? '12px' : '0') : '0',
                    borderBottom: gIdx < classGroups.length - 1 && compactMode ? '1.5px dashed #666666' : 'none'
                  }}
                >
                  {/* Title */}
                  <div style={{ textAlign: 'center', marginBottom: '6px' }}>
                    <h2 style={{ fontSize: '13pt', fontWeight: 'bold', textTransform: 'uppercase', margin: '0 0 2px 0' }}>
                      BẢNG KÊ QUYẾT TOÁN TIỀN PHOTO TÀI LIỆU
                    </h2>
                    <div style={{ fontSize: '10.5pt' }}>
                      <b>Lớp: {group.className}</b> &nbsp;|&nbsp; 
                      GVCN: <b>{homeroom}</b> &nbsp;|&nbsp; 
                      Sĩ số: <b>{siso} học sinh</b>
                    </div>
                  </div>

                  <table className="print-table">
                    <thead>
                      <tr>
                        <th style={{ width: '35px' }}>STT</th>
                        <th style={{ width: '140px' }}>Giáo viên Bộ môn</th>
                        <th>Nội dung tài liệu</th>
                        <th style={{ width: '50px' }}>Sĩ số</th>
                        <th style={{ width: '50px' }}>Số lẻ</th>
                        <th style={{ width: '65px' }}>Tổng bản</th>
                        <th style={{ width: '75px' }}>Đơn giá</th>
                        <th style={{ width: '105px' }}>Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.length === 0 ? (
                        <tr>
                          <td colSpan="8" style={{ textAlign: 'center', fontStyle: 'italic', color: '#555' }}>
                            (Không có tài liệu photo phát sinh đợt này)
                          </td>
                        </tr>
                      ) : (
                        group.items.map((item, idx) => {
                          const totalItemCopies = (Number(item.studentCount) || 0) + (Number(item.extraCount) || 0);
                          return (
                            <tr key={idx}>
                              <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                              <td>{item.teacherName}</td>
                              <td>{item.subject}</td>
                              <td style={{ textAlign: 'right' }}>{item.studentCount}</td>
                              <td style={{ textAlign: 'right' }}>{item.extraCount}</td>
                              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{totalItemCopies}</td>
                              <td style={{ textAlign: 'right' }}>{Number(item.unitPrice).toLocaleString('vi-VN')} đ</td>
                              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatVND(item.amount)}</td>
                            </tr>
                          );
                        })
                      )}

                      {/* Subtotal tiền photo tuần này */}
                      <tr style={{ fontWeight: 'bold' }}>
                        <td colSpan="5" style={{ textAlign: 'right', textTransform: 'uppercase' }}>
                          TIỀN PHOTO TUẦN NÀY:
                        </td>
                        <td style={{ textAlign: 'right' }}>{group.totalCopies.toLocaleString('vi-VN')}</td>
                        <td></td>
                        <td style={{ textAlign: 'right', fontSize: '11pt' }}>{formatVND(group.totalAmount)}</td>
                      </tr>

                      {/* TỰ ĐỘNG CỘNG DỒN NỢ CŨ VÀO BILL KHI IN */}
                      {debtAmount > 0 && (
                        <>
                          <tr style={{ fontWeight: '600' }}>
                            <td colSpan="7" style={{ textAlign: 'right' }}>
                              (+) TIỀN NỢ TUẦN TRƯỚC (CHƯA TRẢ / THIẾU) {debtNote ? `(${debtNote})` : ''}:
                            </td>
                            <td style={{ textAlign: 'right', fontSize: '11pt', fontWeight: 'bold' }}>
                              + {formatVND(debtAmount)}
                            </td>
                          </tr>
                          <tr style={{ fontWeight: 'bold' }}>
                            <td colSpan="7" style={{ textAlign: 'right', textTransform: 'uppercase', fontSize: '11pt' }}>
                              TỔNG CỘNG LỚP {group.className} CẦN THANH TOÁN (BILL IN):
                            </td>
                            <td style={{ textAlign: 'right', fontSize: '12pt' }}>
                              {formatVND(totalClassDue)}
                            </td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>

                  <div style={{ marginTop: '5px', fontSize: '9.5pt', fontStyle: 'italic' }}>
                    Số tiền viết bằng chữ: <b>{words}</b>
                  </div>

                  {showSignatures && (
                    <div className="print-signature-section">
                      <div style={{ width: '45%', textAlign: 'center' }}>
                        <b>ĐẠI DIỆN GVCN / LỚP {group.className}</b><br />
                        <i>(Ký và ghi rõ họ tên)</i>
                        <div style={{ height: '50px' }}></div>
                        <b>{homeroom}</b>
                      </div>
                      <div style={{ width: '45%', textAlign: 'center' }}>
                        <i>Ngày ..... tháng ..... năm 2026</i><br />
                        <b>NGƯỜI LẬP BIỂU</b><br />
                        <i>(Ký và ghi rõ họ tên)</i>
                        <div style={{ height: '50px' }}></div>
                        <b>Nhân viên phụ trách</b>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="print-page-wrapper" style={{ padding: '10mm 0' }}>
            <div style={{ textAlign: 'center', marginBottom: '14px' }}>
              <h2 style={{ fontSize: '16pt', fontWeight: 'bold' }}>
                BẢNG TỔNG HỢP QUYẾT TOÁN KINH PHÍ PHOTOCOPY TOÀN TRƯỜNG
              </h2>
              <div style={{ fontSize: '12pt', fontStyle: 'italic' }}>
                Niên khóa: {settings.schoolYear} • {settings.semester}
              </div>
            </div>

            <table className="print-table">
              <thead>
                <tr>
                  <th style={{ width: '35px' }}>STT</th>
                  <th style={{ width: '140px' }}>Giáo Viên</th>
                  <th style={{ width: '60px' }}>Lớp</th>
                  <th>Môn Học / Nội Dung</th>
                  <th style={{ width: '55px' }}>Sĩ số</th>
                  <th style={{ width: '55px' }}>Số lẻ</th>
                  <th style={{ width: '65px' }}>Tổng bản</th>
                  <th style={{ width: '75px' }}>Đơn giá</th>
                  <th style={{ width: '105px' }}>Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {currentWeekItems.map((item, idx) => {
                  const totalCopies = (Number(item.studentCount) || 0) + (Number(item.extraCount) || 0);
                  return (
                    <tr key={idx}>
                      <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                      <td>{item.teacherName}</td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{item.className}</td>
                      <td>{item.subject}</td>
                      <td style={{ textAlign: 'right' }}>{item.studentCount}</td>
                      <td style={{ textAlign: 'right' }}>{item.extraCount}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{totalCopies}</td>
                      <td style={{ textAlign: 'right' }}>{Number(item.unitPrice).toLocaleString('vi-VN')} đ</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatVND(item.amount)}</td>
                    </tr>
                  );
                })}

                <tr style={{ fontWeight: 'bold' }}>
                  <td colSpan="6" style={{ textAlign: 'right', textTransform: 'uppercase' }}>TỔNG TIỀN PHOTO TOÀN TRƯỜNG:</td>
                  <td style={{ textAlign: 'right' }}>{grandTotal.copies.toLocaleString('vi-VN')} bản</td>
                  <td></td>
                  <td style={{ textAlign: 'right', fontSize: '11.5pt' }}>{formatVND(grandTotal.amount)}</td>
                </tr>

                {totalClassDebts > 0 && (
                  <>
                    <tr style={{ fontWeight: '600' }}>
                      <td colSpan="8" style={{ textAlign: 'right', textTransform: 'uppercase' }}>
                        (+) TỔNG TIỀN THIẾU / NỢ CŨ CỦA CÁC LỚP:
                      </td>
                      <td style={{ textAlign: 'right', fontSize: '11pt', fontWeight: 'bold' }}>
                        + {formatVND(totalClassDebts)}
                      </td>
                    </tr>
                    <tr style={{ fontWeight: 'bold' }}>
                      <td colSpan="8" style={{ textAlign: 'right', textTransform: 'uppercase', fontSize: '11.5pt' }}>
                        TỔNG KINH PHÍ CẦN THU TOÀN TRƯỜNG:
                      </td>
                      <td style={{ textAlign: 'right', fontSize: '12pt' }}>
                        {formatVND(grandTotal.amount + totalClassDebts)}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>

            <div style={{ marginTop: '10px', fontSize: '11.5pt', fontStyle: 'italic' }}>
              Tổng kinh phí bằng chữ: <b>{numberToVietnameseWords(grandTotal.amount + totalClassDebts)}</b>
            </div>

            {showSignatures && (
              <div className="print-signature-section">
                <div style={{ width: '30%', textAlign: 'center' }}>
                  <b>NGƯỜI LẬP BẢNG</b><br />
                  <i>(Ký và ghi rõ họ tên)</i>
                  <div style={{ height: '65px' }}></div>
                  <b>Nhân viên phụ trách</b>
                </div>
                <div style={{ width: '30%', textAlign: 'center' }}>
                  <b>KẾ TOÁN / THỦ QUỸ</b><br />
                  <i>(Ký và ghi rõ họ tên)</i>
                  <div style={{ height: '65px' }}></div>
                </div>
                <div style={{ width: '35%', textAlign: 'center' }}>
                  <i>Ngày ..... tháng ..... năm 2026</i><br />
                  <b>HIỆU TRƯỞNG DUYỆT</b><br />
                  <i>(Ký, đóng dấu)</i>
                  <div style={{ height: '65px' }}></div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};
