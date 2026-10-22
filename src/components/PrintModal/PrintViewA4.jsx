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
    getStudentCountForClass
  } = useApp();

  const [printTemplate, setPrintTemplate] = useState('class_invoice'); // 'class_invoice' | 'school_summary'
  const [showSignatures, setShowSignatures] = useState(false); // Mặc định tắt để tiết kiệm giấy in theo yêu cầu
  const [compactMode, setCompactMode] = useState(true); // Mặc định gom nhiều lớp trên cùng 1 trang A4 để tiết kiệm giấy tối đa

  // Unique classes in current billing data
  const availableClasses = useMemo(() => {
    const list = Array.from(new Set(billingItems.map(i => i.className).filter(Boolean)));
    return list.sort();
  }, [billingItems]);

  // Group items by class
  const classGroups = useMemo(() => {
    const map = {};
    billingItems.forEach(item => {
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

    if (printClassFilter !== 'all') {
      return Object.values(map).filter(g => g.className === printClassFilter);
    }
    return Object.values(map).sort((a, b) => a.className.localeCompare(b.className));
  }, [billingItems, printClassFilter]);

  // Grand total for school summary
  const grandTotal = useMemo(() => {
    let copies = 0;
    let amount = 0;
    billingItems.forEach(item => {
      const c = (Number(item.studentCount) || 0) + (Number(item.extraCount) || 0);
      copies += c;
      amount += c * (Number(item.unitPrice) || 0);
    });
    return { copies, amount };
  }, [billingItems]);

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
                XEM TRƯỚC VÀ IN ẤN KHỔ A4 (CHUẨN XÁC KHÔNG NHẢY TRANG)
              </h3>
              <p style={{ fontSize: '12.5px', opacity: 0.9 }}>
                Định dạng A4 Portrait căn lề chuẩn văn bản hành chính sư phạm
              </p>
            </div>
          </div>

          <button 
            onClick={() => setIsPrintModalOpen(false)}
            style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer' }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Options Toolbar */}
        <div 
          style={{
            padding: '12px 24px',
            background: '#dfe7f2',
            borderBottom: '1px solid #cad7e8',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          {/* Template Choice */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '13.5px', fontWeight: 'bold', color: 'var(--text-main)' }}>Mẫu In:</span>
            <select 
              className="neu-select"
              value={printTemplate}
              onChange={(e) => setPrintTemplate(e.target.value)}
              style={{ width: '230px', padding: '6px 10px', fontSize: '13.5px' }}
            >
              <option value="class_invoice">1. Phiếu Thanh Toán Theo Lớp (GVCN)</option>
              <option value="school_summary">2. Bảng Tổng Hợp Quyết Toán Toàn Trường</option>
            </select>
          </div>

          {/* Class Filter if class_invoice */}
          {printTemplate === 'class_invoice' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 'bold' }}>Chọn Lớp In:</span>
              <select 
                className="neu-select"
                value={printClassFilter}
                onChange={(e) => setPrintClassFilter(e.target.value)}
                style={{ width: '160px', padding: '6px 10px', fontSize: '13.5px' }}
              >
                <option value="all">Tất Cả Các Lớp</option>
                {availableClasses.map(c => (
                  <option key={c} value={c}>Lớp {c}</option>
                ))}
              </select>
            </div>
          )}

          {/* Tùy chọn Gom lớp & Chữ ký để tiết kiệm giấy in tối đa */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                title="Gom nhiều lớp trên cùng trang A4 để tiết kiệm giấy in. Chỉ ngắt sang trang mới khi lớp không đủ chỗ chứa."
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

            {/* Action Print Button */}
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
                {classGroups.map((group, gIdx) => {
                  const homeroom = getHomeroomTeacher(group.className);
                  const siso = getStudentCountForClass(group.className);
                  const words = numberToVietnameseWords(group.totalAmount);

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
                      {/* Title (Đã tinh gọn để tiết kiệm giấy in tối đa) */}
                      <div style={{ textAlign: 'center', marginBottom: '6px' }}>
                        <h2 style={{ fontSize: '13pt', fontWeight: 'bold', textTransform: 'uppercase', margin: '0 0 2px 0' }}>
                          BẢNG KÊ QUYẾT TOÁN TIỀN PHOTO TÀI LIỆU
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
                          {group.items.map((item, idx) => {
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
                          })}
                          {/* Subtotal */}
                          <tr style={{ fontWeight: 'bold', backgroundColor: '#f9f9f9' }}>
                            <td colSpan="5" style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right', textTransform: 'uppercase' }}>
                              TỔNG CỘNG TIỀN PHOTO LỚP {group.className}:
                            </td>
                            <td style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right' }}>
                              {group.totalCopies.toLocaleString('vi-VN')}
                            </td>
                            <td style={{ border: '1px solid #000', padding: '5px 6px' }}></td>
                            <td style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right', fontSize: '11pt' }}>
                              {formatVND(group.totalAmount)}
                            </td>
                          </tr>
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
                {/* Title (Đã tinh gọn để tiết kiệm giấy in) */}
                <div style={{ textAlign: 'center', marginBottom: '14px' }}>
                  <h2 style={{ fontSize: '16pt', fontWeight: 'bold', textTransform: 'uppercase' }}>
                    BẢNG TỔNG HỢP QUYẾT TOÁN KINH PHÍ PHOTOCOPY
                  </h2>
                  <div style={{ fontSize: '12pt', fontStyle: 'italic' }}>
                    Niên khóa: {settings.schoolYear} • {settings.semester}
                  </div>
                </div>

                {/* Main Table */}
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
                    {billingItems.map((item, idx) => {
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
                        TỔNG CỘNG TOÀN TRƯỜNG:
                      </td>
                      <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>
                        {grandTotal.copies.toLocaleString('vi-VN')} bản
                      </td>
                      <td style={{ border: '1px solid #000', padding: '6px' }}></td>
                      <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right', fontSize: '11.5pt' }}>
                        {formatVND(grandTotal.amount)}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Words */}
                <div style={{ marginTop: '10px', fontSize: '11.5pt', fontStyle: 'italic' }}>
                  Tổng kinh phí bằng chữ: <b>{numberToVietnameseWords(grandTotal.amount)}</b>
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

  {/* Hidden Print-Only DOM for the browser window.print() */}
  <div className="print-only-container">
        {printTemplate === 'class_invoice' ? (
          <div>
            {classGroups.map((group, gIdx) => {
              const homeroom = getHomeroomTeacher(group.className);
              const siso = getStudentCountForClass(group.className);
              const words = numberToVietnameseWords(group.totalAmount);
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
                      {group.items.map((item, idx) => {
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
                      })}
                      <tr style={{ fontWeight: 'bold' }}>
                        <td colSpan="5" style={{ textAlign: 'right', textTransform: 'uppercase' }}>
                          CỘNG TỔNG TIỀN PHOTO LỚP {group.className}:
                        </td>
                        <td style={{ textAlign: 'right' }}>{group.totalCopies.toLocaleString('vi-VN')}</td>
                        <td></td>
                        <td style={{ textAlign: 'right', fontSize: '11pt' }}>{formatVND(group.totalAmount)}</td>
                      </tr>
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
                {billingItems.map((item, idx) => {
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
                  <td colSpan="6" style={{ textAlign: 'right', textTransform: 'uppercase' }}>TỔNG CỘNG TOÀN TRƯỜNG:</td>
                  <td style={{ textAlign: 'right' }}>{grandTotal.copies.toLocaleString('vi-VN')} bản</td>
                  <td></td>
                  <td style={{ textAlign: 'right', fontSize: '11.5pt' }}>{formatVND(grandTotal.amount)}</td>
                </tr>
              </tbody>
            </table>

            <div style={{ marginTop: '10px', fontSize: '11.5pt', fontStyle: 'italic' }}>
              Tổng kinh phí bằng chữ: <b>{numberToVietnameseWords(grandTotal.amount)}</b>
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
