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
  FileText,
  ChevronDown,
  ChevronUp,
  RotateCcw
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
    currentWeek,
    setCurrentWeek,
    availableWeeks,
    addWeek,
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
  const [filterMode, setFilterMode] = useState('DEBT_ONLY'); // Mặc định chỉ hiển thị danh sách lớp có nợ/thiếu theo yêu cầu
  const [expandedClass, setExpandedClass] = useState(null); // className to expand details

  // Định dạng tiền tệ VNĐ
  const formatVND = (value) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value || 0);
  };

  // Gom nhóm dữ liệu theo từng lớp (Bao gồm lớp có đơn photo HOẶC đang có nợ cũ trong tuần này)
  const groupedData = useMemo(() => {
    const map = {};

    // 1. Thêm tất cả các dòng photo hiện có trong tuần này (currentWeek)
    const currentWeekItems = billingItems.filter(item => (item.week || currentWeek) === currentWeek);

    currentWeekItems.forEach(item => {
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

    // 2. Thêm các lớp đang có tiền nợ/thiếu từ tuần trước dù tuần này chưa photo
    Object.keys(classDebts || {}).forEach(cls => {
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
  }, [billingItems, classDebts, currentWeek]);

  // Danh sách các lớp ĐÃ ĐƯỢC CHỌN và nhập tiền nợ/thiếu (Chỉ có dữ liệu khi người dùng chọn và lưu)
  const debtClassesList = useMemo(() => {
    const keys = Object.keys(classDebts || {}).filter(cls => (Number(classDebts[cls]?.amount) || 0) > 0);
    const currentWeekItems = billingItems.filter(item => (item.week || currentWeek) === currentWeek);
    
    return keys.map(cls => {
      const debt = classDebts[cls];
      const debtAmount = Number(debt?.amount) || 0;
      
      const classItems = currentWeekItems.filter(item => (item.className || '').toLowerCase() === cls.toLowerCase());
      let photoCopies = 0;
      let photoAmount = 0;
      classItems.forEach(item => {
        const copies = (Number(item.studentCount) || 0) + (Number(item.extraCount) || 0);
        photoCopies += copies;
        photoAmount += (copies * (Number(item.unitPrice) || 0));
      });

      return {
        className: cls,
        items: classItems,
        totalCopies: photoCopies,
        photoAmount: photoAmount,
        debtAmount: debtAmount,
        debtNote: debt?.note || '',
        totalBill: photoAmount + debtAmount,
        updatedAt: debt?.updatedAt || ''
      };
    }).sort((a, b) => a.className.localeCompare(b.className));
  }, [classDebts, billingItems, currentWeek]);

  // Dữ liệu hiển thị trong bảng: Nếu ở chế độ DEBT_ONLY thì CHỈ lấy các lớp có nợ
  const displayedGroups = useMemo(() => {
    const source = filterMode === 'DEBT_ONLY' ? debtClassesList : groupedData;
    
    if (!searchClass.trim()) return source;
    const q = searchClass.trim().toLowerCase();
    return source.filter(g => {
      const hr = (getHomeroomTeacher(g.className) || '').toLowerCase();
      return g.className.toLowerCase().includes(q) || hr.includes(q);
    });
  }, [filterMode, debtClassesList, groupedData, searchClass, getHomeroomTeacher]);

  // Số lượng lớp đang có nợ
  const debtClassCount = debtClassesList.length;

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

  // Xử lý thêm tuần mới
  const handleAddNewWeek = () => {
    const nextNum = availableWeeks.length + 1;
    const custom = window.prompt(`Nhập tên tuần mới cần thêm vào danh sách (Gợi ý: Tuần ${nextNum}):`, `Tuần ${nextNum}`);
    if (custom && custom.trim()) {
      addWeek(custom.trim());
    }
  };

  // Xử lý lưu nợ từ form
  const handleApplyDebt = (e) => {
    if (e) e.preventDefault();
    if (!selectedClassForDebt) {
      alert('Vui lòng chọn Lớp thiếu hoặc không trả từ danh sách.');
      return;
    }
    const amountNum = Number(debtInput);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Vui lòng nhập số tiền nợ/thiếu hợp lệ (lớn hơn 0).');
      return;
    }

    updateClassDebt(selectedClassForDebt, amountNum, debtNote || 'Thiếu tiền tuần trước');
    // Reset form
    setSelectedClassForDebt('');
    setDebtInput('');
    setDebtNote('');
  };

  // Chọn lớp từ bảng để nạp lên form sửa
  const handleSelectClassToEdit = (cls) => {
    setSelectedClassForDebt(cls);
    const existing = classDebts[cls];
    if (existing && existing.amount > 0) {
      setDebtInput(existing.amount);
      setDebtNote(existing.note || '');
    } else {
      setDebtInput('');
      setDebtNote('');
    }
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
      {/* 1. Header Bar */}
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
              BẢNG RÀ SOÁT CÔNG NỢ & TỔNG BILL CÁC LỚP
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-sub)', margin: '2px 0 0 0' }}>
              Rà soát các lớp thiếu/không trả tuần trước, hệ thống tự động cộng dồn vào Bill ({currentWeek}) để in ấn
            </p>
          </div>
        </div>

        {/* NÚT CHỌN TUẦN & THÊM TUẦN MỚI */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#eff6ff', padding: '6px 12px', borderRadius: '10px', border: '1.5px solid #93c5fd' }}>
          <span style={{ fontSize: '13.5px', fontWeight: 'bold', color: '#134694' }}>📅 Tuần làm việc:</span>
          <select 
            value={currentWeek} 
            onChange={(e) => setCurrentWeek(e.target.value)}
            style={{ 
              padding: '6px 12px', 
              borderRadius: '6px', 
              border: '1.5px solid #2563eb', 
              fontSize: '13.5px', 
              fontWeight: 'bold', 
              color: '#1e40af', 
              background: '#ffffff',
              cursor: 'pointer' 
            }}
          >
            {availableWeeks.map(w => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAddNewWeek}
            className="neu-btn neu-btn-primary"
            style={{ fontSize: '12.5px', padding: '6px 11px', fontWeight: 'bold' }}
            title="Thêm tuần mới vào danh sách tuần"
          >
            ➕ Thêm tuần mới
          </button>
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
            style={{ fontSize: '14px', padding: '9px 18px', fontWeight: 'bold' }}
            title="Mở xem trước và in phiếu quyết toán đã cộng dồn cho tất cả các lớp"
          >
            <Printer size={17} />
            <span>Xuất Bill Tất Cả Các Lớp</span>
          </button>
        </div>
      </div>

      {/* 2. KHU VỰC CHỌN LỚP THIẾU / KHÔNG TRẢ (TUẦN TRƯỚC) ĐỂ NẠP VÀO DANH SÁCH */}
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
              padding: '4px 10px', 
              borderRadius: '6px', 
              display: 'flex', 
              alignItems: 'center',
              fontWeight: 'bold',
              fontSize: '13px'
            }}>
              <Zap size={15} style={{ marginRight: '5px' }} />
              RÀ SOÁT CÔNG NỢ TUẦN TRƯỚC
            </span>
            <span style={{ fontWeight: 'bold', fontSize: '15px', color: '#134694' }}>
              Chọn lớp còn thiếu hoặc không trả trong tuần trước $\rightarrow$ Nhập số tiền để cộng dồn vào Bill tuần này:
            </span>
          </div>

          {debtClassCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#b91c1c', background: '#fef2f2', padding: '4px 10px', borderRadius: '6px', border: '1px solid #fecaca' }}>
                Đang có {debtClassCount} lớp có nợ tuần trước (Tổng nợ: {formatVND(totalClassDebts)})
              </div>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ các khoản nợ tuần trước để bắt đầu lại không?')) {
                    clearAllClassDebts();
                  }
                }}
                className="neu-btn"
                style={{ fontSize: '12px', padding: '4px 10px', color: '#dc2626', background: '#fef2f2', border: '1px solid #fca5a5', cursor: 'pointer' }}
                title="Xóa tất cả các khoản nợ đã ghi nhận"
              >
                <RotateCcw size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                <span>Xóa Hết Nợ</span>
              </button>
            </div>
          )}
        </div>

        {/* Form nhập liệu nhanh */}
        <form onSubmit={handleApplyDebt} style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          {/* 1. Chọn Lớp */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '13.5px', fontWeight: 'bold', color: 'var(--text-bold)' }}>1. Chọn Lớp:</label>
            <select 
              value={selectedClassForDebt} 
              onChange={(e) => handleSelectClassToEdit(e.target.value)}
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
              <option value="">-- Chọn Lớp thiếu/không trả --</option>
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
            <label style={{ fontSize: '13.5px', fontWeight: 'bold', color: 'var(--text-bold)' }}>2. Tiền thiếu / nợ:</label>
            <input 
              type="number"
              placeholder="Nhập số tiền nợ..."
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

          {/* 3. Ghi chú */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '1', minWidth: '180px' }}>
            <input 
              type="text"
              placeholder="Ghi chú (VD: Thiếu tuần 2, Hẹn thứ 2 đóng)..."
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

          {/* 4. Nút Lưu */}
          <button 
            type="submit"
            className="neu-btn neu-btn-primary"
            style={{ padding: '8px 20px', fontSize: '13.5px', whiteSpace: 'nowrap', fontWeight: 'bold' }}
          >
            ➕ Thêm / Lưu Vào Danh Sách
          </button>

          {/* Nút Xóa nợ nếu lớp đang có nợ */}
          {selectedClassForDebt && (classDebts[selectedClassForDebt]?.amount || 0) > 0 && (
            <button 
              type="button"
              onClick={() => {
                removeClassDebt(selectedClassForDebt);
                setSelectedClassForDebt('');
                setDebtInput('');
                setDebtNote('');
              }}
              className="neu-btn"
              style={{ padding: '8px 12px', fontSize: '13px', background: '#f1f5f9', color: '#475569' }}
              title="Xóa nợ khi lớp đã trả"
            >
              ✕ Xóa Nợ Lớp {selectedClassForDebt}
            </button>
          )}
        </form>
      </div>

      {/* 3. BẢNG HIỂN THỊ KIỂM SOÁT VÀ QUẢN LÝ TỔNG HỢP CÁC LỚP */}
      <div 
        className="neu-card"
        style={{
          padding: '16px 20px',
          background: '#ffffff',
          borderRadius: '14px',
          border: '1.5px solid #cbd9eb',
          flex: '1',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        {/* Thanh công cụ lọc & tìm kiếm */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-bold)' }}>
              DANH SÁCH KIỂM SOÁT BILL & CÔNG NỢ:
            </span>

            {/* Bộ lọc tab */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setFilterMode('DEBT_ONLY')}
                className={`neu-chip ${filterMode === 'DEBT_ONLY' ? 'active' : ''}`}
                style={{
                  cursor: 'pointer',
                  fontWeight: filterMode === 'DEBT_ONLY' ? 'bold' : 'normal',
                  background: filterMode === 'DEBT_ONLY' ? '#dc2626' : '#fef2f2',
                  color: filterMode === 'DEBT_ONLY' ? '#ffffff' : '#b91c1c',
                  border: '1px solid #fecaca',
                  padding: '5px 12px'
                }}
              >
                🔴 Danh Sách Lớp Nợ / Thiếu Cần Cộng Dồn ({debtClassCount})
              </button>

              <button
                type="button"
                onClick={() => setFilterMode('ALL')}
                className={`neu-chip ${filterMode === 'ALL' ? 'active' : ''}`}
                style={{
                  cursor: 'pointer',
                  fontWeight: filterMode === 'ALL' ? 'bold' : 'normal',
                  background: filterMode === 'ALL' ? '#1b5ebe' : '#f1f5f9',
                  color: filterMode === 'ALL' ? '#ffffff' : '#475569',
                  border: '1px solid #cbd5e1',
                  padding: '5px 12px'
                }}
              >
                Xem tất cả các lớp ({groupedData.length})
              </button>
            </div>
          </div>

          {/* Ô tìm kiếm & Tổng kết */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ position: 'relative', width: '220px' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text"
                placeholder="Tìm lớp hoặc GVCN..."
                value={searchClass}
                onChange={(e) => setSearchClass(e.target.value)}
                style={{
                  padding: '6px 10px 6px 32px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  width: '100%',
                  fontSize: '13px'
                }}
              />
            </div>

            <div style={{ fontSize: '13.5px', color: '#1e293b' }}>
              Tiền tuần này: <b>{formatVND(overallTotals.photo)}</b> | Nợ tuần trước: <b style={{ color: '#b91c1c' }}>+{formatVND(overallTotals.debt)}</b> | TỔNG CẦN THU: <b style={{ color: '#1b5ebe', fontSize: '15px' }}>{formatVND(overallTotals.grandTotal)}</b>
            </div>
          </div>
        </div>

        {/* BẢNG TỔNG HỢP DUY NHẤT (GỌN GÀNG, DỄ KIỂM SOÁT) */}
        <div style={{ overflowX: 'auto', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
          <table className="excel-table" style={{ width: '100%', fontSize: '13.5px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#e2e8f0', color: '#1e293b' }}>
                <th style={{ width: '40px', textAlign: 'center' }}>STT</th>
                <th style={{ width: '110px' }}>Lớp</th>
                <th style={{ width: '200px' }}>GVCN & Sĩ Số</th>
                <th style={{ width: '150px', textAlign: 'right', background: '#fee2e2', color: '#991b1b' }}>
                  Tiền Nợ Tuần Trước (A)
                </th>
                <th style={{ width: '160px', textAlign: 'right', background: '#e0f2fe', color: '#0369a1' }}>
                  Tiền Photo Tuần Này (B)
                </th>
                <th style={{ width: '180px', textAlign: 'right', background: '#dcfce7', color: '#15803d' }}>
                  TỔNG BILL CẦN THU (A + B)
                </th>
                <th>Trạng Thái Bill</th>
                <th style={{ width: '180px', textAlign: 'center' }}>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {displayedGroups.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '36px 20px', background: '#fafbfc' }}>
                    <div style={{ color: '#1e293b', fontSize: '15px', fontWeight: 'bold', marginBottom: '6px' }}>
                      {filterMode === 'DEBT_ONLY' 
                        ? `📋 Bảng rà soát công nợ (${currentWeek}) hiện chưa có lớp nào` 
                        : 'Không tìm thấy lớp nào'}
                    </div>
                    <div style={{ color: '#64748b', fontSize: '13px' }}>
                      {filterMode === 'DEBT_ONLY' 
                        ? 'Chỉ có dữ liệu khi bạn chọn lớp, nhập số tiền thiếu / chưa trả ở trên và bấm [➕ Thêm / Lưu Vào Danh Sách].'
                        : 'Hãy thử tìm kiếm với từ khóa khác.'}
                    </div>
                  </td>
                </tr>
              ) : (
                displayedGroups.map((group, idx) => {
                  const homeroom = getHomeroomTeacher(group.className);
                  const siso = getStudentCountForClass(group.className);
                  const debt = classDebts?.[group.className];
                  const debtAmount = Number(debt?.amount) || 0;
                  const totalBill = group.photoAmount + debtAmount;
                  const isExpanded = expandedClass === group.className;

                  return (
                    <React.Fragment key={group.className}>
                      <tr 
                        style={{ 
                          backgroundColor: debtAmount > 0 ? '#fff8f8' : (idx % 2 === 0 ? '#ffffff' : '#f8fafc'),
                          borderBottom: '1px solid #e2e8f0'
                        }}
                      >
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>
                        
                        {/* Lớp */}
                        <td>
                          <span 
                            style={{ 
                              fontWeight: 'bold', 
                              fontSize: '14.5px', 
                              color: debtAmount > 0 ? '#991b1b' : 'var(--color-primary-dark)',
                              background: '#ffffff',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              border: debtAmount > 0 ? '1px solid #fca5a5' : '1px solid #bfdbfe'
                            }}
                          >
                            Lớp {group.className}
                          </span>
                        </td>

                        {/* GVCN & Sĩ số */}
                        <td>
                          <b>{homeroom}</b> <span style={{ color: '#64748b' }}>({siso} hs)</span>
                        </td>

                        {/* Tiền nợ tuần trước (A) */}
                        <td style={{ textAlign: 'right', fontWeight: 'bold', color: debtAmount > 0 ? '#b91c1c' : '#64748b', background: debtAmount > 0 ? '#fff1f2' : 'transparent' }}>
                          {debtAmount > 0 ? (
                            <div>
                              <div>+ {formatVND(debtAmount)}</div>
                              {debt?.note && <div style={{ fontSize: '11.5px', color: '#dc2626', fontWeight: 'normal', fontStyle: 'italic' }}>({debt.note})</div>}
                            </div>
                          ) : (
                            '0 đ'
                          )}
                        </td>

                        {/* Tiền photo tuần này (B) */}
                        <td style={{ textAlign: 'right', fontWeight: '600', color: '#0369a1' }}>
                          {formatVND(group.photoAmount)}
                          <div style={{ fontSize: '11.5px', color: '#64748b' }}>({group.totalCopies.toLocaleString('vi-VN')} bản)</div>
                        </td>

                        {/* TỔNG BILL CẦN THU (A + B) */}
                        <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '15px', color: debtAmount > 0 ? '#b91c1c' : '#15803d', background: debtAmount > 0 ? '#fef2f2' : '#f0fdf4' }}>
                          {formatVND(totalBill)}
                        </td>

                        {/* Trạng thái */}
                        <td>
                          {debtAmount > 0 ? (
                            <span 
                              style={{ 
                                display: 'inline-block',
                                background: '#fee2e2', 
                                color: '#991b1b', 
                                padding: '3px 8px', 
                                borderRadius: '6px', 
                                fontSize: '12px',
                                fontWeight: 'bold',
                                border: '1px solid #fca5a5'
                              }}
                            >
                              🔴 Có nợ tuần trước (+{formatVND(debtAmount)})
                            </span>
                          ) : (
                            <span 
                              style={{ 
                                display: 'inline-block',
                                background: '#f0fdf4', 
                                color: '#166534', 
                                padding: '3px 8px', 
                                borderRadius: '6px', 
                                fontSize: '12px',
                                border: '1px solid #bbf7d0'
                              }}
                            >
                              🟢 Đúng bill tuần này
                            </span>
                          )}
                        </td>

                        {/* Thao tác */}
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            {/* In phiếu lớp */}
                            <button
                              type="button"
                              onClick={() => handlePrintSingleClass(group.className)}
                              className="neu-btn"
                              style={{ padding: '4px 8px', fontSize: '12px' }}
                              title={`In phiếu quyết toán cho Lớp ${group.className}`}
                            >
                              <Printer size={13} color="var(--color-primary)" />
                              <span>In Bill</span>
                            </button>

                            {/* Sửa / Nhập nợ */}
                            <button
                              type="button"
                              onClick={() => handleSelectClassToEdit(group.className)}
                              className="neu-btn"
                              style={{ padding: '4px 8px', fontSize: '12px', color: '#0369a1' }}
                              title="Sửa hoặc thêm số tiền nợ tuần trước"
                            >
                              <Edit2 size={13} />
                              <span>Sửa Nợ</span>
                            </button>

                            {/* Xóa nợ */}
                            {debtAmount > 0 && (
                              <button
                                type="button"
                                onClick={() => removeClassDebt(group.className)}
                                className="neu-btn"
                                style={{ padding: '4px 8px', fontSize: '12px', color: '#dc2626' }}
                                title="Xóa nợ khi lớp đã trả"
                              >
                                <X size={13} />
                              </button>
                            )}

                            {/* Xem chi tiết môn photo */}
                            {group.items.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setExpandedClass(isExpanded ? null : group.className)}
                                className="neu-btn"
                                style={{ padding: '4px 6px', fontSize: '11.5px', color: '#475569' }}
                                title="Xem danh sách bài photo chi tiết của lớp này"
                              >
                                {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Hàng mở rộng hiển thị các môn photo chi tiết nếu người dùng bấm xem */}
                      {isExpanded && group.items.length > 0 && (
                        <tr style={{ background: '#f1f5f9' }}>
                          <td colSpan="8" style={{ padding: '10px 16px' }}>
                            <div style={{ background: '#ffffff', borderRadius: '6px', padding: '8px 12px', border: '1px solid #cbd5e1' }}>
                              <div style={{ fontSize: '12.5px', fontWeight: 'bold', color: '#1e293b', marginBottom: '6px' }}>
                                📄 Chi tiết các bài photo tuần này của Lớp {group.className}:
                              </div>
                              <table style={{ width: '100%', fontSize: '12.5px', borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                    <th style={{ padding: '4px 6px', textAlign: 'center', width: '30px' }}>#</th>
                                    <th style={{ padding: '4px 6px', textAlign: 'left', width: '150px' }}>Giáo Viên</th>
                                    <th style={{ padding: '4px 6px', textAlign: 'left' }}>Bài photo / Tài liệu</th>
                                    <th style={{ padding: '4px 6px', textAlign: 'right', width: '60px' }}>Sĩ số</th>
                                    <th style={{ padding: '4px 6px', textAlign: 'right', width: '60px' }}>Số lẻ</th>
                                    <th style={{ padding: '4px 6px', textAlign: 'right', width: '70px' }}>Tổng bản</th>
                                    <th style={{ padding: '4px 6px', textAlign: 'right', width: '80px' }}>Đơn giá</th>
                                    <th style={{ padding: '4px 6px', textAlign: 'right', width: '100px' }}>Thành tiền</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {group.items.map((it, iIdx) => {
                                    const copies = (Number(it.studentCount) || 0) + (Number(it.extraCount) || 0);
                                    return (
                                      <tr key={it.id || iIdx} style={{ borderBottom: '1px dashed #e2e8f0' }}>
                                        <td style={{ textAlign: 'center', padding: '3px 6px' }}>{iIdx + 1}</td>
                                        <td style={{ padding: '3px 6px', fontWeight: '600' }}>{it.teacherName}</td>
                                        <td style={{ padding: '3px 6px' }}>{it.subject}</td>
                                        <td style={{ textAlign: 'right', padding: '3px 6px' }}>{it.studentCount}</td>
                                        <td style={{ textAlign: 'right', padding: '3px 6px', color: '#b45309' }}>{it.extraCount}</td>
                                        <td style={{ textAlign: 'right', padding: '3px 6px', fontWeight: 'bold' }}>{copies}</td>
                                        <td style={{ textAlign: 'right', padding: '3px 6px' }}>{Number(it.unitPrice).toLocaleString('vi-VN')} đ</td>
                                        <td style={{ textAlign: 'right', padding: '3px 6px', fontWeight: 'bold', color: '#0369a1' }}>{formatVND(it.amount)}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
