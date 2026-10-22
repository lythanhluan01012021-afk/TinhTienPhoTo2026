import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  FileSpreadsheet, 
  Trash2, 
  Plus, 
  Layers, 
  Printer, 
  CloudUpload, 
  CloudDownload,
  RotateCcw,
  CheckCircle,
  Clock,
  Search,
  DollarSign,
  Download,
  Filter
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { fuzzyVietnameseMatch } from '../../utils/vietnameseUtils';

export const ExcelGrid = () => {
  const { 
    billingItems, 
    updateBillingItem, 
    removeBillingItem, 
    addBillingItem, 
    clearBillingGrid,
    isGroupedView,
    setIsGroupedView,
    setIsPrintModalOpen,
    syncToGoogleSheets,
    fetchFromGoogleSheets,
    ORDER_STATUSES,
    classes,
    teachers,
    settings
  } = useApp();

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Status counts for tabs
  const statusCounts = useMemo(() => {
    const counts = { ALL: billingItems.length, CHO_TAI_LIEU: 0, DANG_IN: 0, HOAN_THANH: 0, DA_THANH_TOAN: 0 };
    billingItems.forEach(i => {
      const st = i.status || 'CHO_TAI_LIEU';
      if (counts[st] !== undefined) counts[st]++;
    });
    return counts;
  }, [billingItems]);

  // Filtered items
  const displayedItems = useMemo(() => {
    return billingItems.filter(item => {
      if (statusFilter !== 'ALL' && (item.status || 'CHO_TAI_LIEU') !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTeacher = fuzzyVietnameseMatch(item.teacherName || '', q);
        const matchClass = (item.className || '').toLowerCase().includes(q);
        const matchSubject = fuzzyVietnameseMatch(item.subject || '', q);
        if (!matchTeacher && !matchClass && !matchSubject) return false;
      }
      return true;
    });
  }, [billingItems, statusFilter, searchQuery]);

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

  // Add blank row
  const handleAddBlankRow = () => {
    addBillingItem({
      teacherName: teachers[0]?.name || 'Giáo viên',
      className: classes[0]?.className || '10A1',
      subject: 'Đề kiểm tra học kỳ',
      studentCount: classes[0]?.studentCount || 40,
      extraCount: 0,
      unitPrice: settings.defaultUnitPrice,
      note: ''
    });
  };

  // Export current table to Excel
  const handleExportExcel = () => {
    if (billingItems.length === 0) {
      alert('Bảng tính hiện chưa có dữ liệu để xuất file Excel.');
      return;
    }

    const dataToExport = billingItems.map((item, idx) => ({
      'STT': idx + 1,
      'Tên Giáo Viên': item.teacherName,
      'Lớp': item.className,
      'Môn Học / Nội Dung': item.subject,
      'Sĩ Số': item.studentCount,
      'Số Lượng Lẻ': item.extraCount,
      'Tổng Bản In': Number(item.studentCount) + Number(item.extraCount),
      'Đơn Giá (VNĐ)': item.unitPrice,
      'Thành Tiền (VNĐ)': item.amount,
      'Ghi Chú': item.note || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'BangTinhTienPhoto');
    XLSX.writeFile(workbook, `Bang_Tinh_Tien_Photo_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="neu-card" style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Action Toolbar on Top of Excel Table */}
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
            <FileSpreadsheet size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-bold)' }}>
              BẢNG TÍNH TIỀN PHOTO (EXCEL-LIKE)
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-sub)' }}>
              Hiện có {billingItems.length} dòng dữ liệu • Tự động tính Thành tiền
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Toggle Grouping View */}
          <button 
            onClick={() => setIsGroupedView(!isGroupedView)}
            className={`neu-btn ${isGroupedView ? 'active' : ''}`}
            title="Xem tổng tiền theo từng Lớp học"
            style={{ fontSize: '13.5px', padding: '8px 14px' }}
          >
            <Layers size={16} color="var(--color-primary)" />
            <span>{isGroupedView ? 'Hiện Bảng Chi Tiết' : 'Tổng Theo Lớp'}</span>
          </button>

          {/* Add Row */}
          <button 
            onClick={handleAddBlankRow}
            className="neu-btn"
            style={{ fontSize: '13.5px', padding: '8px 14px' }}
          >
            <Plus size={16} color="var(--color-primary)" />
            <span>Thêm Dòng</span>
          </button>

          {/* Export Excel */}
          <button 
            onClick={handleExportExcel}
            className="neu-btn"
            title="Tải bảng tính thành file Excel (.xlsx)"
            style={{ fontSize: '13.5px', padding: '8px 14px' }}
          >
            <Download size={16} color="var(--color-primary)" />
            <span>Xuất Excel</span>
          </button>

          {/* Print A4 */}
          <button 
            onClick={() => setIsPrintModalOpen(true)}
            className="neu-btn neu-btn-primary"
            style={{ fontSize: '13.5px', padding: '8px 16px' }}
          >
            <Printer size={16} />
            <span>In Ấn A4</span>
          </button>

          {/* Fetch from Google Drive */}
          <button 
            onClick={fetchFromGoogleSheets}
            className="neu-btn"
            title="Tải toàn bộ dữ liệu đơn photo từ Google Sheets trên Drive về máy"
            style={{ fontSize: '13.5px', padding: '8px 14px', color: '#1b5ebe', fontWeight: '600' }}
          >
            <CloudDownload size={16} />
            <span>Tải Từ Drive</span>
          </button>

          {/* Sync to Google Sheets (Upsert - Chống trùng lặp) */}
          <button 
            onClick={syncToGoogleSheets}
            className="neu-btn neu-btn-success"
            title="Lưu & Cập nhật lên Google Sheets (Tự động chống trùng lặp dữ liệu)"
            style={{ fontSize: '13.5px', padding: '8px 14px' }}
          >
            <CloudUpload size={16} />
            <span>Lưu CSDL</span>
          </button>

          {/* Clear Grid */}
          <button 
            onClick={clearBillingGrid}
            className="neu-btn"
            title="Xóa toàn bộ bảng tính hiện tại để bắt đầu phiên mới"
            style={{ padding: '8px 12px', color: 'var(--color-danger)' }}
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Filter Tabs & Quick Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <button 
            onClick={() => setStatusFilter('ALL')}
            className={`badge-filter-btn ${statusFilter === 'ALL' ? 'active' : ''}`}
            style={{
              padding: '5px 12px',
              borderRadius: '20px',
              border: statusFilter === 'ALL' ? '1.5px solid #1b5ebe' : '1px solid #d1d5db',
              backgroundColor: statusFilter === 'ALL' ? '#1b5ebe' : '#ffffff',
              color: statusFilter === 'ALL' ? '#ffffff' : '#4b5563',
              fontSize: '12.5px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Tất cả ({statusCounts.ALL})
          </button>

          <button 
            onClick={() => setStatusFilter('CHO_TAI_LIEU')}
            style={{
              padding: '5px 12px',
              borderRadius: '20px',
              border: statusFilter === 'CHO_TAI_LIEU' ? '1.5px solid #b45309' : '1px solid #fcd34d',
              backgroundColor: statusFilter === 'CHO_TAI_LIEU' ? '#fef3c7' : '#fffbeb',
              color: '#b45309',
              fontSize: '12.5px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            🟡 Chờ gửi tài liệu ({statusCounts.CHO_TAI_LIEU})
          </button>

          <button 
            onClick={() => setStatusFilter('DANG_IN')}
            style={{
              padding: '5px 12px',
              borderRadius: '20px',
              border: statusFilter === 'DANG_IN' ? '1.5px solid #1d4ed8' : '1px solid #bfdbfe',
              backgroundColor: statusFilter === 'DANG_IN' ? '#dbeafe' : '#eff6ff',
              color: '#1d4ed8',
              fontSize: '12.5px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            🔵 Đang photo ({statusCounts.DANG_IN})
          </button>

          <button 
            onClick={() => setStatusFilter('HOAN_THANH')}
            style={{
              padding: '5px 12px',
              borderRadius: '20px',
              border: statusFilter === 'HOAN_THANH' ? '1.5px solid #047857' : '1px solid #a7f3d0',
              backgroundColor: statusFilter === 'HOAN_THANH' ? '#d1fae5' : '#ecfdf5',
              color: '#047857',
              fontSize: '12.5px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            🟢 Đã xong ({statusCounts.HOAN_THANH})
          </button>

          <button 
            onClick={() => setStatusFilter('DA_THANH_TOAN')}
            style={{
              padding: '5px 12px',
              borderRadius: '20px',
              border: statusFilter === 'DA_THANH_TOAN' ? '1.5px solid #6d28d9' : '1px solid #ddd6fe',
              backgroundColor: statusFilter === 'DA_THANH_TOAN' ? '#ede9fe' : '#f5f3ff',
              color: '#6d28d9',
              fontSize: '12.5px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            🟣 Đã thanh toán ({statusCounts.DA_THANH_TOAN})
          </button>
        </div>

        {/* Quick Search on table */}
        <div style={{ position: 'relative', width: '220px' }}>
          <input 
            type="text"
            placeholder="Tìm theo GV, lớp, môn..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 10px 6px 30px',
              borderRadius: '8px',
              border: '1px solid #c8d6e6',
              fontSize: '12.5px',
              outline: 'none'
            }}
          />
          <Search size={14} color="#9ca3af" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
        </div>
      </div>

      {/* The Excel Table */}
      <div className="excel-table-container" style={{ flex: '1', minHeight: '320px', maxHeight: '520px' }}>
        {displayedItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            <FileSpreadsheet size={48} style={{ opacity: 0.4, marginBottom: '12px' }} />
            <p style={{ fontSize: '16px', fontWeight: 'bold' }}>Không tìm thấy dòng dữ liệu nào phù hợp bộ lọc</p>
            <p style={{ fontSize: '13.5px' }}>
              Hãy chọn Giáo viên ở cột bên trái, bấm "Tải Từ Drive" hoặc bấm "Thêm Dòng" để nhập thủ công.
            </p>
          </div>
        ) : (
          <table className="excel-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>STT</th>
                <th style={{ width: '150px' }}>Tên Giáo Viên</th>
                <th style={{ width: '85px' }}>Lớp</th>
                <th>Môn Học / Nội Dung Tài Liệu</th>
                <th style={{ width: '80px' }}>Sĩ Số</th>
                <th style={{ width: '85px' }}>Số Lượng Lẻ</th>
                <th style={{ width: '90px' }}>Đơn Giá (đ)</th>
                <th style={{ width: '120px' }}>Thành Tiền (đ)</th>
                <th style={{ width: '165px' }}>Trạng Thái Đơn</th>
                <th style={{ width: '45px' }}>Xóa</th>
              </tr>
            </thead>
            <tbody>
              {displayedItems.map((item, index) => {
                const totalCopies = (Number(item.studentCount) || 0) + (Number(item.extraCount) || 0);
                const currentStatus = item.status || 'CHO_TAI_LIEU';
                const statusMeta = ORDER_STATUSES[currentStatus] || ORDER_STATUSES.CHO_TAI_LIEU;

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
                        placeholder="Nhập tên GV..."
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
                        placeholder="Tên đề cương / kiểm tra..."
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

                    {/* Trạng Thái Đơn */}
                    <td style={{ textAlign: 'center' }}>
                      <select 
                        value={currentStatus}
                        onChange={(e) => updateBillingItem(item.id, 'status', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '5px 8px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '700',
                          border: `1.5px solid ${statusMeta.border}`,
                          backgroundColor: statusMeta.bg,
                          color: statusMeta.color,
                          cursor: 'pointer',
                          outline: 'none'
                        }}
                      >
                        <option value="CHO_TAI_LIEU">🟡 Chờ gửi tài liệu</option>
                        <option value="DANG_IN">🔵 Đang photo</option>
                        <option value="HOAN_THANH">🟢 Đã photo xong</option>
                        <option value="DA_THANH_TOAN">🟣 Đã thanh toán</option>
                      </select>
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
