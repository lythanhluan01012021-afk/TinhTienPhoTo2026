import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Layers, 
  Printer, 
  UserCheck, 
  ArrowLeft,
  Zap,
  Search,
  CheckCircle,
  AlertCircle,
  X,
  Edit2,
  DollarSign,
  FileText
} from 'lucide-react';

export const GroupingView = () => {
  const { 
    billingItems,
    classes,
    classDebts,
    updateClassDebt,
    removeClassDebt,
    clearAllClassDebts,
    totalClassDebts,
    setIsGroupedView, 
    setIsPrintModalOpen, 
    setPrintClassFilter,
    getHomeroomTeacher,
    getStudentCountForClass 
  } = useApp();

  // State cho thanh chọn nhanh lớp thiếu / nợ
  const [selectedClassForDebt, setSelectedClassForDebt] = useState('');
  const [debtInput, setDebtInput] = useState('');
  const [debtNote, setDebtNote] = useState('');
  const [searchClass, setSearchClass] = useState('');

  // Định dạng tiền tệ VNĐ
  const formatVND = (value) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value || 0);
  };

  // Tính trước tổng tiền photo của từng lớp trong bảng tính hiện tại
  const classPhotoTotals = useMemo(() => {
    const map = {};
    billingItems.forEach(item => {
      const cls = item.className || 'Khác';
      const copies = (Number(item.studentCount) || 0) + (Number(item.extraCount) || 0);
      const amount = copies * (Number(item.unitPrice) || 0);
      map[cls] = (map[cls] || 0) + amount;
    });
    return map;
  }, [billingItems]);

  // Gom nhóm dữ liệu theo từng lớp (Bao gồm lớp có đơn photo HOẶC đang có nợ cũ)
  const groupedData = useMemo(() => {
    const map = {};

    // 1. Thêm tất cả các dòng photo hiện có
    billingItems.forEach(item => {
      const cls = item.className || 'Khác';
      if (!map[cls]) {
        map[cls] = {
          className: cls,
          items: [],
          totalCopies: 0,
          photoAmount: 0
        };
      }
      const copies = (Number(item.studentCount) || 0) + (Number(item.extraCount) || 0);
      const amount = copies * (Number(item.unitPrice) || 0);
      map[cls].items.push(item);
      map[cls].totalCopies += copies;
      map[cls].photoAmount += amount;
    });

    // 2. Thêm các lớp đang có tiền nợ/thiếu dù đợt này không photo
    Object.keys(classDebts).forEach(cls => {
      const d = classDebts[cls];
      if ((d?.amount || 0) > 0 && !map[cls]) {
        map[cls] = {
          className: cls,
          items: [],
          totalCopies: 0,
          photoAmount: 0
        };
      }
    });

    // Sắp xếp tên lớp theo thứ tự A-Z
    return Object.values(map).sort((a, b) => a.className.localeCompare(b.className));
  }, [billingItems, classDebts]);

  // Lọc theo tìm kiếm lớp / GVCN
  const filteredGroups = useMemo(() => {
    if (!searchClass.trim()) return groupedData;
    const q = searchClass.trim().toLowerCase();
    return groupedData.filter(g => {
      const hr = (getHomeroomTeacher(g.className) || '').toLowerCase();
      return g.className.toLowerCase().includes(q) || hr.includes(q);
    });
  }, [groupedData, searchClass, getHomeroomTeacher]);

  // Tổng cộng toàn trường
  const overallTotals = useMemo(() => {
    let photo = 0;
    let copies = 0;
    groupedData.forEach(g => {
      photo += g.photoAmount;
      copies += g.totalCopies;
    });
    return {
      photo,
      copies,
      debt: totalClassDebts,
      grandTotal: photo + totalClassDebts
    };
  }, [groupedData, totalClassDebts]);

  // Xử lý lưu nợ từ thanh công cụ nhanh
  const handleApplyDebt = () => {
    if (!selectedClassForDebt) {
      alert('Vui lòng chọn Lớp cần ghi nợ / tiền thiếu.');
      return;
    }
    const amountNum = Number(debtInput);
    if (isNaN(amountNum) || amountNum < 0) {
      alert('Vui lòng nhập số tiền nợ hợp lệ (lớn hơn hoặc bằng 0).');
      return;
    }

    updateClassDebt(selectedClassForDebt, amountNum, debtNote);
    alert(`Đã lưu tiền nợ/thiếu ${formatVND(amountNum)} cho Lớp ${selectedClassForDebt}. Số tiền này sẽ tự động cộng dồn vào Bill in!`);
  };

  // Chọn lớp từ danh sách hoặc từ thẻ lớp để nạp vào form
  const handleSelectClassForDebt = (cls) => {
    setSelectedClassForDebt(cls);
    const existing = classDebts[cls];
    if (existing && existing.amount > 0) {
      setDebtInput(existing.amount);
      setDebtNote(existing.note || '');
    } else {
      setDebtInput('');
      setDebtNote('');
    }
    // Scroll nhẹ lên đầu trang để người dùng thấy form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrintSingleClass = (className) => {
    setPrintClassFilter(className);
    setIsPrintModalOpen(true);
  };

  const handlePrintAll = () => {
    setPrintClassFilter('all');
    setIsPrintModalOpen(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      {/* 1. Top Header Bar */}
      <div 
        className="neu-card"
        style={{
          padding: '14px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          background: 'linear-gradient(135deg, #ffffff, #f0f5fc)',
          border: '1.5px solid #b8cce4'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div 
            style={{ 
              width: '42px', 
              height: '42px', 
              borderRadius: '10px', 
              background: 'linear-gradient(135deg, #1b5ebe, #134694)', 
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <Layers size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-bold)', margin: 0 }}>
              CHẾ ĐỘ TỔNG THEO TỪNG LỚP & QUẢN LÝ TIỀN THIẾU
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-sub)', margin: '2px 0 0 0' }}>
              Tự động gom đơn photo theo lớp và cộng dồn tiền thiếu / không trả vào bill in
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button 
            onClick={() => setIsGroupedView(false)}
            className="neu-btn"
            style={{ fontSize: '13.5px', padding: '8px 14px' }}
          >
            <ArrowLeft size={16} />
            <span>Quay lại Bảng Chi Tiết</span>
          </button>

          <button 
            onClick={handlePrintAll}
            className="neu-btn neu-btn-primary"
            style={{ fontSize: '13.5px', padding: '8px 16px' }}
            title="In phiếu quyết toán cho tất cả các lớp có trong danh sách"
          >
            <Printer size={16} />
            <span>In Phiếu Tất Cả Các Lớp</span>
          </button>
        </div>
      </div>

      {/* 2. THANH CÔNG CỤ: CHỌN LỚP THIẾU HOẶC KHÔNG TRẢ -> NHẬP SỐ TIỀN -> TỰ CỘNG VÀO BILL IN */}
      <div 
        className="neu-card"
        style={{
          padding: '16px 20px',
          background: '#ffffff',
          borderRadius: '14px',
          border: '2px solid #93c5fd',
          boxShadow: '0 4px 14px rgba(27, 94, 190, 0.08)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ 
              background: '#eff6ff', 
              color: '#1b5ebe', 
              padding: '4px 8px', 
              borderRadius: '6px', 
              display: 'flex', 
              alignItems: 'center',
              fontWeight: 'bold',
              fontSize: '13px'
            }}>
              <Zap size={15} style={{ marginRight: '4px' }} />
              GHI NỢ / TIỀN THIẾU
            </span>
            <span style={{ fontWeight: 'bold', fontSize: '15px', color: '#134694' }}>
              Chọn lớp thiếu hoặc không trả, nhập số tiền để tự động cộng dồn vào Bill in
            </span>
          </div>

          {totalClassDebts > 0 && (
            <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#b91c1c' }}>
              Tổng tiền nợ/thiếu các lớp: {formatVND(totalClassDebts)}
            </div>
          )}
        </div>

        {/* Form nhập liệu nhanh */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          {/* 1. Chọn Lớp */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '13.5px', fontWeight: 'bold', color: 'var(--text-bold)' }}>1. Chọn Lớp:</label>
            <select 
              value={selectedClassForDebt} 
              onChange={(e) => handleSelectClassForDebt(e.target.value)}
              style={{ 
                padding: '8px 12px', 
                borderRadius: '8px', 
                border: '1.5px solid #93c5fd', 
                fontSize: '14px', 
                fontWeight: 'bold',
                color: 'var(--color-primary-dark)',
                background: '#f8fafc',
                cursor: 'pointer'
              }}
            >
              <option value="">-- Bấm để chọn Lớp --</option>
              {classes.map(c => {
                const clsName = c.className || c.name;
                const d = classDebts[clsName];
                const hasDebt = (d?.amount || 0) > 0;
                return (
                  <option key={clsName} value={clsName}>
                    Lớp {clsName} {hasDebt ? `[Đang nợ: ${formatVND(d.amount)}]` : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* 2. Nhập số tiền thiếu / nợ */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '13.5px', fontWeight: 'bold', color: 'var(--text-bold)' }}>2. Số tiền thiếu / nợ:</label>
            <input 
              type="number"
              placeholder="Nhập số tiền (đ)..."
              value={debtInput}
              onChange={(e) => setDebtInput(e.target.value)}
              style={{ 
                padding: '8px 12px', 
                borderRadius: '8px', 
                border: '1.5px solid #93c5fd', 
                width: '160px', 
                fontSize: '14.5px', 
                fontWeight: 'bold', 
                color: '#b91c1c',
                background: '#fff'
              }}
            />
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#64748b' }}>đ</span>
          </div>

          {/* Phím bấm nhanh: "Không trả (Nợ toàn bộ bill)" nếu lớp có tiền photo */}
          {selectedClassForDebt && classPhotoTotals[selectedClassForDebt] > 0 && (
            <button
              type="button"
              onClick={() => {
                setDebtInput(classPhotoTotals[selectedClassForDebt]);
                setDebtNote('Chưa thanh toán đợt này');
              }}
              className="neu-btn"
              style={{ 
                fontSize: '12.5px', 
                padding: '7px 12px', 
                background: '#fee2e2', 
                color: '#b91c1c', 
                border: '1px solid #f87171',
                fontWeight: '600'
              }}
              title="Bấm để tự điền đúng bằng 100% tiền photo của lớp này"
            >
              ⚡ Không trả (Nợ hết: {formatVND(classPhotoTotals[selectedClassForDebt])})
            </button>
          )}

          {/* 3. Ghi chú */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '1', minWidth: '180px' }}>
            <input 
              type="text"
              placeholder="Ghi chú (VD: Thiếu tiền tuần trước, hẹn thứ 2 trả)..."
              value={debtNote}
              onChange={(e) => setDebtNote(e.target.value)}
              style={{ 
                padding: '8px 12px', 
                borderRadius: '8px', 
                border: '1px solid #cbd5e1', 
                width: '100%', 
                fontSize: '13px' 
              }}
            />
          </div>

          {/* 4. Nút Lưu Áp Dụng */}
          <button 
            type="button"
            onClick={handleApplyDebt}
            className="neu-btn neu-btn-primary"
            style={{ padding: '8px 18px', fontSize: '13.5px', whiteSpace: 'nowrap' }}
          >
            <span>➕ Lưu Vào Bill In</span>
          </button>

          {/* 5. Nút Xóa Nợ nếu lớp đang có nợ */}
          {selectedClassForDebt && (classDebts[selectedClassForDebt]?.amount || 0) > 0 && (
            <button 
              type="button"
              onClick={() => {
                removeClassDebt(selectedClassForDebt);
                setDebtInput('');
                setDebtNote('');
              }}
              className="neu-btn"
              style={{ padding: '8px 12px', fontSize: '13px', background: '#f1f5f9', color: '#475569' }}
              title="Xóa nợ khi lớp đã hoàn tất tiền"
            >
              ✕ Xóa Nợ Lớp {selectedClassForDebt}
            </button>
          )}
        </div>

        {/* Danh sách các chip hiển thị những lớp đang có nợ để người dùng quản lý nhanh */}
        {Object.keys(classDebts).filter(cls => (classDebts[cls]?.amount || 0) > 0).length > 0 && (
          <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px dashed #bfdbfe', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#b91c1c' }}>
              Danh sách {Object.keys(classDebts).filter(cls => (classDebts[cls]?.amount || 0) > 0).length} lớp đang nợ/thiếu:
            </span>
            {Object.entries(classDebts).filter(([_, d]) => (d?.amount || 0) > 0).map(([cls, d]) => (
              <span 
                key={cls}
                style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  background: '#fef2f2', 
                  border: '1px solid #fecaca', 
                  borderRadius: '6px', 
                  padding: '4px 10px', 
                  fontSize: '13px',
                  color: '#991b1b',
                  fontWeight: '600'
                }}
              >
                <span 
                  onClick={() => handleSelectClassForDebt(cls)} 
                  style={{ cursor: 'pointer', textDecoration: 'underline' }}
                  title="Bấm để sửa số tiền nợ"
                >
                  <b>Lớp {cls}:</b> +{formatVND(d.amount)} {d.note ? `(${d.note})` : ''}
                </span>
                <button 
                  type="button"
                  onClick={() => removeClassDebt(cls)} 
                  title="Xóa nợ khi lớp đã nộp tiền"
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    cursor: 'pointer', 
                    color: '#ef4444', 
                    fontWeight: 'bold', 
                    padding: '0 2px',
                    fontSize: '14px'
                  }}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 3. Thanh tìm kiếm lớp & Thống kê tổng tiền */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text"
            placeholder="Tìm theo Lớp hoặc GVCN..."
            value={searchClass}
            onChange={(e) => setSearchClass(e.target.value)}
            style={{
              padding: '8px 12px 8px 36px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              width: '100%',
              fontSize: '13.5px',
              outline: 'none'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '16px', fontSize: '13.5px', alignItems: 'center' }}>
          <span>Tổng số lớp: <b>{filteredGroups.length} lớp</b></span>
          <span>Tổng bản in: <b>{overallTotals.copies.toLocaleString('vi-VN')} bản</b></span>
          <span>Tiền photo: <b>{formatVND(overallTotals.photo)}</b></span>
          {overallTotals.debt > 0 && (
            <span style={{ color: '#b91c1c' }}>Nợ cũ: <b>+{formatVND(overallTotals.debt)}</b></span>
          )}
          <span style={{ color: 'var(--color-primary-dark)', fontSize: '15px' }}>
            TỔNG CẦN THU: <b>{formatVND(overallTotals.grandTotal)}</b>
          </span>
        </div>
      </div>

      {/* 4. Danh sách các Lớp */}
      <div style={{ flex: '1', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px', paddingRight: '4px' }}>
        {filteredGroups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', background: '#fff', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
            Không tìm thấy lớp nào phù hợp.
          </div>
        ) : (
          filteredGroups.map((group) => {
            const homeroomTeacher = getHomeroomTeacher(group.className);
            const studentCount = getStudentCountForClass(group.className);
            const classDebt = classDebts[group.className] || null;
            const debtAmount = Number(classDebt?.amount) || 0;
            const totalDue = group.photoAmount + debtAmount;

            return (
              <div 
                key={group.className}
                className="neu-card-sm"
                style={{
                  background: '#f8fafc',
                  border: debtAmount > 0 ? '1.5px solid #fca5a5' : '1px solid #d6e2f0',
                  borderRadius: '14px',
                  overflow: 'hidden'
                }}
              >
                {/* Header từng lớp */}
                <div 
                  style={{
                    background: debtAmount > 0 ? 'linear-gradient(135deg, #fee2e2, #fef2f2)' : 'linear-gradient(135deg, #e3ecf7, #edf3fa)',
                    padding: '12px 18px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: debtAmount > 0 ? '1.5px solid #fca5a5' : '1.5px solid #cbd9eb',
                    flexWrap: 'wrap',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span 
                      style={{ 
                        fontSize: '18px', 
                        fontWeight: 'bold', 
                        color: debtAmount > 0 ? '#991b1b' : 'var(--color-primary-dark)',
                        background: '#ffffff',
                        padding: '4px 12px',
                        borderRadius: '8px',
                        boxShadow: 'var(--shadow-sm)'
                      }}
                    >
                      LỚP {group.className}
                    </span>
                    <div style={{ fontSize: '13.5px', color: 'var(--text-sub)' }}>
                      <UserCheck size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                      GVCN: <b style={{ color: 'var(--text-bold)' }}>{homeroomTeacher}</b> • Sĩ số: <b>{studentCount} hs</b>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {debtAmount > 0 ? (
                      <span 
                        className="neu-chip"
                        style={{
                          background: 'rgba(239, 68, 68, 0.12)',
                          color: '#b91c1c',
                          borderColor: '#f87171',
                          fontSize: '12.5px',
                          fontWeight: 'bold'
                        }}
                      >
                        Có Nợ Cũ: +{formatVND(debtAmount)}
                      </span>
                    ) : (
                      <span 
                        className="neu-chip"
                        style={{
                          background: 'rgba(25, 135, 84, 0.12)',
                          color: 'var(--color-success)',
                          borderColor: 'var(--color-success)',
                          fontSize: '12.5px'
                        }}
                      >
                        Không Có Nợ
                      </span>
                    )}

                    <button
                      onClick={() => handlePrintSingleClass(group.className)}
                      className="neu-btn"
                      style={{ fontSize: '12.5px', padding: '6px 12px', fontWeight: '600' }}
                      title={`In phiếu thanh toán riêng cho lớp ${group.className}`}
                    >
                      <Printer size={14} color="var(--color-primary)" />
                      <span>In Phiếu Lớp {group.className}</span>
                    </button>
                  </div>
                </div>

                {/* Bảng chi tiết các môn photo của lớp */}
                <div style={{ padding: '8px 14px' }}>
                  {group.items.length === 0 ? (
                    <div style={{ padding: '12px', textAlign: 'center', color: '#64748b', fontStyle: 'italic', fontSize: '13.5px' }}>
                      (Lớp này không có đơn photo phát sinh đợt này, hiện chỉ ghi nhận tiền nợ cũ)
                    </div>
                  ) : (
                    <table className="excel-table" style={{ fontSize: '14px', width: '100%' }}>
                      <thead>
                        <tr>
                          <th style={{ width: '40px' }}>STT</th>
                          <th style={{ width: '180px' }}>Giáo Viên Bộ Môn</th>
                          <th>Nội Dung Tài Liệu / Bài Tập</th>
                          <th style={{ width: '90px' }}>Sĩ Số</th>
                          <th style={{ width: '90px' }}>Số Lượng Lẻ</th>
                          <th style={{ width: '100px' }}>Tổng Bản In</th>
                          <th style={{ width: '100px' }}>Đơn Giá</th>
                          <th style={{ width: '130px' }}>Thành Tiền</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map((item, idx) => {
                          const totalItemCopies = (Number(item.studentCount) || 0) + (Number(item.extraCount) || 0);
                          return (
                            <tr key={item.id || idx}>
                              <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>
                              <td style={{ fontWeight: '600' }}>{item.teacherName}</td>
                              <td>{item.subject}</td>
                              <td style={{ textAlign: 'right' }}>{item.studentCount}</td>
                              <td style={{ textAlign: 'right', color: '#b45309' }}>{item.extraCount}</td>
                              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{totalItemCopies}</td>
                              <td style={{ textAlign: 'right' }}>{Number(item.unitPrice).toLocaleString('vi-VN')} đ</td>
                              <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                                {formatVND(item.amount)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}

                  {/* Chân Bảng: Tổng Tiền Photo + Nợ Cũ/Thiếu + TỔNG CỘNG THANH TOÁN */}
                  <div 
                    style={{ 
                      marginTop: '10px',
                      padding: '12px 16px',
                      background: '#ffffff',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                      <span style={{ fontWeight: '600', color: 'var(--text-bold)' }}>
                        CỘNG TIỀN PHOTO ĐỢT NÀY:
                      </span>
                      <span style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>
                        {formatVND(group.photoAmount)} ({group.totalCopies.toLocaleString('vi-VN')} bản)
                      </span>
                    </div>

                    {/* Dòng điều chỉnh nợ cũ trực tiếp tại thẻ lớp */}
                    <div 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        fontSize: '14px',
                        padding: '6px 0',
                        borderTop: '1px dashed #e2e8f0'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: '600', color: debtAmount > 0 ? '#b91c1c' : '#475569' }}>
                          (+) Tiền nợ cũ / Chưa đóng:
                        </span>
                        <input 
                          type="number" 
                          value={debtAmount > 0 ? debtAmount : ''}
                          placeholder="0"
                          onChange={(e) => updateClassDebt(group.className, e.target.value, classDebt?.note || '')}
                          style={{
                            width: '120px',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            border: debtAmount > 0 ? '1.5px solid #f87171' : '1px solid #cbd5e1',
                            fontWeight: 'bold',
                            color: '#b91c1c',
                            fontSize: '14px'
                          }}
                        />
                        <span style={{ fontSize: '13px', color: '#64748b' }}>đ</span>

                        {/* Nút bấm nhanh điền nợ hết bill */}
                        {group.photoAmount > 0 && debtAmount !== group.photoAmount && (
                          <button
                            type="button"
                            onClick={() => updateClassDebt(group.className, group.photoAmount, 'Chưa nộp tiền đợt này')}
                            style={{
                              fontSize: '11.5px',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              background: '#fee2e2',
                              border: '1px solid #fca5a5',
                              color: '#b91c1c',
                              cursor: 'pointer'
                            }}
                            title="Bấm để ghi nợ 100% tiền photo đợt này"
                          >
                            ⚡ Không trả (Nợ hết)
                          </button>
                        )}

                        {debtAmount > 0 && (
                          <button
                            type="button"
                            onClick={() => removeClassDebt(group.className)}
                            style={{
                              fontSize: '11.5px',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              background: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              color: '#64748b',
                              cursor: 'pointer'
                            }}
                            title="Xóa tiền nợ"
                          >
                            0đ (Đã trả xong)
                          </button>
                        )}
                      </div>

                      <div style={{ fontSize: '14px', fontWeight: 'bold', color: debtAmount > 0 ? '#b91c1c' : '#64748b' }}>
                        {debtAmount > 0 ? `+ ${formatVND(debtAmount)}` : '0 đ'}
                      </div>
                    </div>

                    {/* Dòng TỔNG CỘNG THANH TOÁN CUỐI CÙNG */}
                    <div 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        paddingTop: '6px',
                        borderTop: '2px solid #cbd5e1'
                      }}
                    >
                      <span style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-bold)', textTransform: 'uppercase' }}>
                        TỔNG CỘNG LỚP {group.className} CẦN THANH TOÁN (BILL IN):
                      </span>
                      <span style={{ fontSize: '17px', fontWeight: 'bold', color: debtAmount > 0 ? '#b91c1c' : 'var(--color-primary-dark)' }}>
                        {formatVND(totalDue)}
                      </span>
                    </div>
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
