import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Layers, 
  Printer, 
  GraduationCap, 
  CheckCircle, 
  Clock, 
  UserCheck, 
  ArrowLeft,
  FileSpreadsheet
} from 'lucide-react';

export const GroupingView = () => {
  const { 
    billingItems, 
    classes, 
    setIsGroupedView, 
    setIsPrintModalOpen, 
    setPrintClassFilter,
    getHomeroomTeacher,
    getStudentCountForClass 
  } = useApp();

  // Group items by className
  const groupedData = useMemo(() => {
    const groups = {};
    
    billingItems.forEach(item => {
      const cls = item.className || 'Chưa xếp lớp';
      if (!groups[cls]) {
        groups[cls] = {
          className: cls,
          items: [],
          totalCopies: 0,
          totalAmount: 0,
          isAllPaid: true
        };
      }
      
      const copies = (Number(item.studentCount) || 0) + (Number(item.extraCount) || 0);
      const amount = copies * (Number(item.unitPrice) || 0);
      
      groups[cls].items.push(item);
      groups[cls].totalCopies += copies;
      groups[cls].totalAmount += amount;
      if (!item.isPaid) {
        groups[cls].isAllPaid = false;
      }
    });

    return Object.values(groups).sort((a, b) => a.className.localeCompare(b.className));
  }, [billingItems]);

  const formatVND = (value) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value || 0);
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
    <div className="neu-card" style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
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
            style={{ width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}
          >
            <Layers size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-bold)' }}>
              CHẾ ĐỘ TỔNG THEO TỪNG LỚP
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-sub)' }}>
              Tự động tính tổng tiền (Subtotal) cho từng lớp học để đối soát & thanh toán
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
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
          >
            <Printer size={16} />
            <span>In Phiếu Tất Cả Các Lớp</span>
          </button>
        </div>
      </div>

      {/* List of Class Groups */}
      <div style={{ flex: '1', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', paddingRight: '4px' }}>
        {groupedData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            Chưa có dữ liệu photo để gom nhóm.
          </div>
        ) : (
          groupedData.map((group) => {
            const homeroomTeacher = getHomeroomTeacher(group.className);
            const studentCount = getStudentCountForClass(group.className);

            return (
              <div 
                key={group.className}
                className="neu-card-sm"
                style={{
                  background: '#f8fafc',
                  border: '1px solid #d6e2f0',
                  borderRadius: '14px',
                  overflow: 'hidden'
                }}
              >
                {/* Class Title Header */}
                <div 
                  style={{
                    background: 'linear-gradient(135deg, #e3ecf7, #edf3fa)',
                    padding: '12px 18px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '2px solid #cbd9eb',
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
                    <span 
                      className="neu-chip"
                      style={{
                        background: group.isAllPaid ? 'rgba(25, 135, 84, 0.15)' : 'rgba(180, 83, 9, 0.15)',
                        color: group.isAllPaid ? 'var(--color-success)' : 'var(--color-warning)',
                        borderColor: group.isAllPaid ? 'var(--color-success)' : '#e0a544',
                        fontSize: '12.5px'
                      }}
                    >
                      {group.isAllPaid ? 'Lớp Đã Hoàn Tất Tiền' : 'Lớp Còn Tiền Chưa Nộp'}
                    </span>

                    <button
                      onClick={() => handlePrintSingleClass(group.className)}
                      className="neu-btn"
                      style={{ fontSize: '12.5px', padding: '6px 12px' }}
                      title={`In phiếu thanh toán riêng cho lớp ${group.className}`}
                    >
                      <Printer size={14} color="var(--color-primary)" />
                      <span>In Phiếu Lớp {group.className}</span>
                    </button>
                  </div>
                </div>

                {/* Sub-table for this class */}
                <div style={{ padding: '8px 14px' }}>
                  <table className="excel-table" style={{ fontSize: '14px' }}>
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
                          <tr key={item.id}>
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
                      {/* Subtotal Row for this Class */}
                      <tr className="group-subtotal-row">
                        <td colSpan="5" style={{ textAlign: 'right', textTransform: 'uppercase' }}>
                          CỘNG TỔNG TIỀN PHOTO CỦA LỚP {group.className}:
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--color-primary-dark)' }}>
                          {group.totalCopies.toLocaleString('vi-VN')} bản
                        </td>
                        <td></td>
                        <td style={{ textAlign: 'right', color: 'var(--color-primary-dark)', fontSize: '16px' }}>
                          {formatVND(group.totalAmount)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
