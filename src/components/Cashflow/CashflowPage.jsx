import React, { useState, useMemo } from 'react';
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
  Save
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
    syncStatus 
  } = useApp();

  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'THU' | 'CHI'
  const [filterMonth, setFilterMonth] = useState('ALL');
  const [filterYear, setFilterYear] = useState('2026');

  // Form state
  const [newRecord, setNewRecord] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'THU',
    category: '',
    amount: '',
    payer: '',
    note: ''
  });

  // Filtered list
  const filteredList = useMemo(() => {
    return cashflow.filter(item => {
      const matchType = filterType === 'ALL' || item.type === filterType;
      const itemDate = new Date(item.date);
      const matchYear = filterYear === 'ALL' || itemDate.getFullYear().toString() === filterYear;
      const matchMonth = filterMonth === 'ALL' || (itemDate.getMonth() + 1).toString() === filterMonth;
      return matchType && matchYear && matchMonth;
    });
  }, [cashflow, filterType, filterMonth, filterYear]);

  // Statistics calculation
  const stats = useMemo(() => {
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

  const formatVND = (v) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v || 0);

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
      note: ''
    });
  };

  const handleExportExcel = () => {
    const data = filteredList.map((item, idx) => ({
      'STT': idx + 1,
      'Mã Phiếu': item.id,
      'Ngày Ghi Sổ': item.date,
      'Loại': item.type === 'THU' ? 'Thu' : 'Chi',
      'Hạng Mục': item.category,
      'Số Tiền (VNĐ)': item.amount,
      'Người Giao Dịch': item.payer,
      'Ghi Chú': item.note
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SoQuyThuChi');
    XLSX.writeFile(wb, `So_Quy_Thu_Chi_Photo_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="neu-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Title */}
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
            style={{ width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}
          >
            <Receipt size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text-bold)' }}>
              SỔ QUỸ THU / CHI & LỢI NHUẬN PHÒNG PHOTO
            </h2>
            <p style={{ fontSize: '13.5px', color: 'var(--text-sub)' }}>
              Theo dõi dòng tiền thu từ các lớp, chi phí mua giấy ram A4, nạp mực và bảo trì máy
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
              fontSize: '12.5px', 
              fontWeight: 'bold', 
              color: isCashflowSynced ? '#047857' : '#b45309' 
            }}
          >
            {isCashflowSynced ? <CheckCircle size={15} color="#047857" /> : <AlertCircle size={15} color="#b45309" />}
            <span>{isCashflowSynced ? 'CSDL: Đã lưu Sheet' : 'Sổ Quỹ chưa lưu Sheet'}</span>
          </div>

          {/* NÚT LƯU SỔ QUỸ LÊN GOOGLE SHEETS */}
          <button 
            type="button"
            onClick={() => syncCashflowToGoogleSheets()}
            className="neu-btn"
            style={{ 
              fontSize: '13.5px', 
              padding: '8px 16px', 
              fontWeight: 'bold',
              background: 'linear-gradient(135deg, #6d28d9, #5b21b6)',
              color: '#ffffff',
              border: 'none',
              boxShadow: '0 2px 8px rgba(109, 40, 217, 0.35)',
              cursor: 'pointer'
            }}
            title="Lưu toàn bộ nhật ký thu chi vào Google Sheets (Tab SoQuy_ThuChi)"
          >
            <Save size={16} />
            <span>Lưu Sổ Quỹ Lên Google Sheet</span>
          </button>

          {/* NÚT TẢI TỪ GOOGLE SHEETS */}
          <button 
            type="button"
            onClick={fetchCashflowFromGoogleSheets}
            className="neu-btn"
            style={{ fontSize: '13px', padding: '8px 12px', background: '#ffffff', color: '#6d28d9', border: '1.5px solid #c4b5fd' }}
            title="Tải lại nhật ký thu chi từ Google Sheets (Tab SoQuy_ThuChi)"
          >
            <span>📥 Tải Từ Drive</span>
          </button>

          <button onClick={handleExportExcel} className="neu-btn" style={{ fontSize: '13.5px', padding: '8px 16px' }}>
            <Download size={16} color="var(--color-primary)" />
            <span>Xuất Sổ Quỹ Excel</span>
          </button>
        </div>
      </div>

      {/* 3 Overview Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px' }}>
        {/* Total Income */}
        <div 
          className="neu-card-sm"
          style={{ 
            padding: '18px', 
            background: 'linear-gradient(135deg, #edf7f0, #f5fbf7)',
            borderLeft: '5px solid var(--color-success)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13.5px', fontWeight: 'bold', color: 'var(--color-success)' }}>TỔNG TIỀN THU VÀO</span>
            <TrendingUp size={20} color="var(--color-success)" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0d6338', marginTop: '6px' }}>
            {formatVND(stats.totalThu)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Thu từ photo tài liệu các lớp & GV
          </div>
        </div>

        {/* Total Expense */}
        <div 
          className="neu-card-sm"
          style={{ 
            padding: '18px', 
            background: 'linear-gradient(135deg, #fdf1f1, #fef7f7)',
            borderLeft: '5px solid var(--color-danger)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13.5px', fontWeight: 'bold', color: 'var(--color-danger)' }}>TỔNG CHI PHÍ VẬT TƯ</span>
            <TrendingDown size={20} color="var(--color-danger)" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#961e1e', marginTop: '6px' }}>
            {formatVND(stats.totalChi)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Chi mua giấy A4, nạp mực, sửa máy
          </div>
        </div>

        {/* Net Profit */}
        <div 
          className="neu-card-sm"
          style={{ 
            padding: '18px', 
            background: 'linear-gradient(135deg, #e7effa, #f1f6fd)',
            borderLeft: '5px solid var(--color-primary)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13.5px', fontWeight: 'bold', color: 'var(--color-primary)' }}>LỢI NHUẬN / QUỸ CÒN LẠI</span>
            <Wallet size={20} color="var(--color-primary)" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--color-primary-dark)', marginTop: '6px' }}>
            {formatVND(stats.netProfit)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            = Tổng Thu trừ đi Tổng Chi
          </div>
        </div>
      </div>

      {/* Filter and New Record Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13.5px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Filter size={15} /> Lọc:
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
            value={filterMonth} 
            onChange={e => setFilterMonth(e.target.value)}
            style={{ width: '130px', padding: '6px 10px', fontSize: '13px' }}
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

        <div style={{ fontSize: '13.5px', color: 'var(--text-sub)' }}>
          Hiển thị <b>{filteredList.length}</b> phiếu ghi sổ
        </div>
      </div>

      {/* New Record Form */}
      <form 
        onSubmit={handleSubmit}
        className="neu-card-sm"
        style={{ padding: '16px', display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap', background: '#f7fafd' }}
      >
        <div style={{ width: '130px' }}>
          <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 'bold', marginBottom: '3px' }}>Ngày:</label>
          <input 
            type="date"
            className="neu-input"
            value={newRecord.date}
            onChange={e => setNewRecord({ ...newRecord, date: e.target.value })}
            required
            style={{ padding: '6px 8px', fontSize: '13px' }}
          />
        </div>

        <div style={{ width: '110px' }}>
          <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 'bold', marginBottom: '3px' }}>Loại:</label>
          <select 
            className="neu-select"
            value={newRecord.type}
            onChange={e => setNewRecord({ ...newRecord, type: e.target.value })}
            style={{ padding: '6px 8px', fontSize: '13px' }}
          >
            <option value="THU">THU (+)</option>
            <option value="CHI">CHI (-)</option>
          </select>
        </div>

        <div style={{ flex: '2', minWidth: '180px' }}>
          <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 'bold', marginBottom: '3px' }}>Hạng Mục Giao Dịch:</label>
          <input 
            type="text"
            className="neu-input"
            placeholder="VD: Thu tiền photo 10A2 / Mua 5 ram giấy A4"
            value={newRecord.category}
            onChange={e => setNewRecord({ ...newRecord, category: e.target.value })}
            required
            style={{ padding: '6px 10px', fontSize: '13px' }}
          />
        </div>

        <div style={{ width: '140px' }}>
          <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 'bold', marginBottom: '3px' }}>Số Tiền (VNĐ):</label>
          <input 
            type="number"
            min="1000"
            step="1000"
            className="neu-input"
            placeholder="VD: 500000"
            value={newRecord.amount}
            onChange={e => setNewRecord({ ...newRecord, amount: e.target.value })}
            required
            style={{ padding: '6px 10px', fontSize: '13px' }}
          />
        </div>

        <div style={{ flex: '1', minWidth: '140px' }}>
          <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 'bold', marginBottom: '3px' }}>Người Nộp / Nhận:</label>
          <input 
            type="text"
            className="neu-input"
            placeholder="VD: GVCN Thầy Nam"
            value={newRecord.payer}
            onChange={e => setNewRecord({ ...newRecord, payer: e.target.value })}
            style={{ padding: '6px 10px', fontSize: '13px' }}
          />
        </div>

        <button type="submit" className="neu-btn neu-btn-primary" style={{ padding: '8px 16px', fontSize: '13.5px' }}>
          <Plus size={16} />
          <span>Ghi Sổ</span>
        </button>
      </form>

      {/* Cashflow Table */}
      <div className="excel-table-container" style={{ maxHeight: '420px' }}>
        <table className="excel-table">
          <thead>
            <tr>
              <th style={{ width: '45px' }}>STT</th>
              <th style={{ width: '100px' }}>Mã Phiếu</th>
              <th style={{ width: '110px' }}>Ngày Ghi Sổ</th>
              <th style={{ width: '90px' }}>Loại</th>
              <th>Nội Dung Hạng Mục</th>
              <th style={{ width: '140px' }}>Số Tiền</th>
              <th style={{ width: '180px' }}>Người Giao Dịch</th>
              <th style={{ width: '60px' }}>Xóa</th>
            </tr>
          </thead>
          <tbody>
            {filteredList.map((item, idx) => (
              <tr key={item.id}>
                <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                <td style={{ textAlign: 'center', fontWeight: '600', fontSize: '13px' }}>{item.id}</td>
                <td style={{ textAlign: 'center' }}>{item.date}</td>
                <td style={{ textAlign: 'center' }}>
                  <span 
                    className="neu-chip"
                    style={{
                      fontSize: '12px',
                      padding: '3px 8px',
                      background: item.type === 'THU' ? 'rgba(25, 135, 84, 0.15)' : 'rgba(220, 53, 69, 0.15)',
                      color: item.type === 'THU' ? 'var(--color-success)' : 'var(--color-danger)',
                      borderColor: item.type === 'THU' ? 'var(--color-success)' : 'var(--color-danger)'
                    }}
                  >
                    {item.type === 'THU' ? '+ THU' : '- CHI'}
                  </span>
                </td>
                <td style={{ fontWeight: '600' }}>{item.category}</td>
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
                <td>{item.payer}</td>
                <td style={{ textAlign: 'center' }}>
                  <button 
                    onClick={() => removeCashflowRecord(item.id)}
                    style={{ border: 'none', background: 'transparent', color: 'var(--color-danger)', cursor: 'pointer' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
