import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  FileSpreadsheet, 
  Trash2
} from 'lucide-react';

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
    currentWeek
  } = useApp();

  const displayedItems = billingItems;

  // Grand Total Calculations
  const totals = useMemo(() => {
    let totalCopies = 0;
    let totalAmount = 0;
    let totalPaid = 0;
    let totalUnpaid = 0;
    const uniqueClasses = new Set();

    billingItems.forEach(item => {
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
  }, [billingItems]);

  // Format currency VNĐ
  const formatVND = (value) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value || 0);
  };

  return (
    <div className="neu-card" style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Compact Table Header Bar */}
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          flexWrap: 'wrap', 
          gap: '10px',
          borderBottom: '1.5px solid #d8e2ef',
          paddingBottom: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div 
            className="neu-card-sm" 
            style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}
          >
            <FileSpreadsheet size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: 'bold', color: 'var(--text-bold)', margin: 0 }}>
              BẢNG TÍNH TIỀN PHOTO ({currentWeek})
            </h2>
            <p style={{ fontSize: '12.5px', color: 'var(--text-sub)', margin: '2px 0 0 0' }}>
              Hiện có {billingItems.length} dòng dữ liệu của {currentWeek} • Nhấp vào ô để sửa trực tiếp • Tự động tính Thành tiền
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {totalClassDebts > 0 ? (
            <button 
              onClick={() => setIsGroupedView(true)}
              className="neu-btn" 
              style={{ 
                padding: '6px 14px', 
                fontSize: '13px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                border: '1.5px solid #fca5a5',
                background: '#fef2f2',
                color: '#991b1b',
                borderRadius: '8px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
              title="Bấm để xem và sửa nợ của các lớp"
            >
              <span>🔴 Có {Object.keys(classDebts || {}).filter(c => (classDebts[c]?.amount || 0) > 0).length} lớp đang nợ/thiếu (+{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(totalClassDebts)})</span>
            </button>
          ) : (
            <button 
              onClick={() => setIsGroupedView(true)}
              className="neu-btn"
              style={{ fontSize: '13px', padding: '6px 14px', color: 'var(--color-primary-dark)', fontWeight: '600' }}
              title="Bấm để chọn lớp thiếu hoặc không trả để cộng vào bill in"
            >
              <span>⚡ Ghi Nợ / Tiền Thiếu Cho Lớp</span>
            </button>
          )}
        </div>
      </div>

      {/* The Excel Table */}
      <div className="excel-table-container" style={{ flex: '1', minHeight: '320px', maxHeight: '520px' }}>
        {displayedItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            <FileSpreadsheet size={48} style={{ opacity: 0.4, marginBottom: '12px' }} />
            <p style={{ fontSize: '16px', fontWeight: 'bold' }}>Bảng tính hiện đang trống</p>
            <p style={{ fontSize: '13.5px' }}>
              Hãy chọn Giáo viên ở cột bên trái để nạp các lớp hoặc bấm "Thêm Dòng" để nhập thủ công.
            </p>
          </div>
        ) : (
          <table className="excel-table">
            <thead>
              <tr>
                <th style={{ width: '45px' }}>STT</th>
                <th style={{ width: '160px' }}>Tên Giáo Viên</th>
                <th style={{ width: '90px' }}>Lớp</th>
                <th>Môn Học / Nội Dung Tài Liệu</th>
                <th style={{ width: '85px' }}>Sĩ Số</th>
                <th style={{ width: '95px' }}>Số Lượng Lẻ</th>
                <th style={{ width: '95px' }}>Đơn Giá (đ)</th>
                <th style={{ width: '130px' }}>Thành Tiền (đ)</th>
                <th style={{ width: '50px' }}>Xóa</th>
              </tr>
            </thead>
            <tbody>
              {displayedItems.map((item, index) => {
                const totalCopies = (Number(item.studentCount) || 0) + (Number(item.extraCount) || 0);

                return (
                  <tr key={item.id}>
                    {/* STT */}
                    <td style={{ textAlign: 'center', fontWeight: '700', color: 'var(--text-sub)' }}>
                      {index + 1}
                    </td>

                    {/* Tên GV */}
                    <td>
                      <input 
                        type="text"
                        className="excel-cell-input"
                        value={item.teacherName}
                        onChange={(e) => updateBillingItem(item.id, 'teacherName', e.target.value)}
                        placeholder="Tên GV / Học sinh / Người in..."
                        style={{ fontWeight: '600' }}
                      />
                    </td>

                    {/* Lớp */}
                    <td style={{ textAlign: 'center' }}>
                      <input 
                        type="text"
                        className="excel-cell-input"
                        value={item.className}
                        onChange={(e) => updateBillingItem(item.id, 'className', e.target.value)}
                        placeholder="Lớp..."
                        style={{ textAlign: 'center', fontWeight: '700', color: 'var(--color-primary)' }}
                      />
                    </td>

                    {/* Môn Học / Nội Dung */}
                    <td>
                      <input 
                        type="text"
                        className="excel-cell-input"
                        value={item.subject}
                        onChange={(e) => updateBillingItem(item.id, 'subject', e.target.value)}
                        placeholder="Nội dung photo / tài liệu..."
                      />
                    </td>

                    {/* Sĩ Số */}
                    <td style={{ textAlign: 'right' }}>
                      <input 
                        type="number"
                        min="0"
                        className="excel-cell-input"
                        value={item.studentCount}
                        onChange={(e) => updateBillingItem(item.id, 'studentCount', e.target.value)}
                        placeholder="0"
                        style={{ textAlign: 'right', fontWeight: '600' }}
                      />
                    </td>

                    {/* Số Lượng Lẻ */}
                    <td style={{ textAlign: 'right' }}>
                      <input 
                        type="number"
                        min="0"
                        className="excel-cell-input"
                        value={item.extraCount}
                        onChange={(e) => updateBillingItem(item.id, 'extraCount', e.target.value)}
                        placeholder="0"
                        style={{ textAlign: 'right', fontWeight: '600', color: '#b45309' }}
                      />
                    </td>

                    {/* Đơn Giá */}
                    <td style={{ textAlign: 'right' }}>
                      <input 
                        type="number"
                        min="0"
                        step="380"
                        list="unit-price-presets"
                        className="excel-cell-input"
                        value={item.unitPrice}
                        onChange={(e) => updateBillingItem(item.id, 'unitPrice', e.target.value)}
                        style={{ textAlign: 'right', fontWeight: 'bold' }}
                        title="Đơn giá: 380đ/trang (bấm mũi tên lên/xuống để nhân đôi 760đ, 1.140đ...)"
                      />
                      <datalist id="unit-price-presets">
                        <option value="380" label="380 đ (1 mặt)" />
                        <option value="760" label="760 đ (2 mặt / nhân đôi)" />
                        <option value="1140" label="1.140 đ (3 trang)" />
                        <option value="1520" label="1.520 đ (4 trang)" />
                        <option value="1900" label="1.900 đ (5 trang)" />
                        <option value="2280" label="2.280 đ (6 trang)" />
                      </datalist>
                    </td>

                    {/* Thành Tiền (Tự Động) */}
                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--color-primary)', fontSize: '15px' }}>
                      {formatVND(item.amount)}
                    </td>

                    {/* Xóa dòng */}
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => removeBillingItem(item.id)}
                        title="Xóa dòng này"
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-danger)' }}
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

      {/* Grand Total Summary Card */}
      <div className="grand-total-card">
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
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

        {/* Big Total */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text-sub)', textTransform: 'uppercase' }}>
            TỔNG TIỀN PHOTO (TỰ ĐỘNG)
          </div>
          <div style={{ fontSize: '26px', fontWeight: 'bold', color: 'var(--color-primary-dark)', letterSpacing: '0.5px' }}>
            {formatVND(totals.totalAmount)}
          </div>
        </div>
      </div>
    </div>
  );
};
