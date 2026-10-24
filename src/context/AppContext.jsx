import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  DEFAULT_DEPARTMENTS,
  DEFAULT_TEACHERS,
  DEFAULT_CLASSES,
  DEFAULT_ASSIGNMENTS,
  DEFAULT_SETTINGS,
  DEFAULT_CASHFLOW,
  DEFAULT_BILLING_ITEMS_TUAN_7,
  DEFAULT_DEBTS_TUAN_7
} from '../data/defaultData';

export const ORDER_STATUSES = {
  CHO_TAI_LIEU: { key: 'CHO_TAI_LIEU', label: 'Chờ gửi tài liệu', color: '#b45309', bg: '#fef3c7', border: '#fcd34d' },
  DANG_IN: { key: 'DANG_IN', label: 'Đang photo', color: '#1d4ed8', bg: '#dbeafe', border: '#93c5fd' },
  HOAN_THANH: { key: 'HOAN_THANH', label: 'Đã photo xong', color: '#047857', bg: '#d1fae5', border: '#6ee7b7' },
  DA_THANH_TOAN: { key: 'DA_THANH_TOAN', label: 'Đã thanh toán', color: '#6d28d9', bg: '#ede9fe', border: '#c4b5fd' },
};

const AppContext = createContext();

// Helper to migrate legacy department names to new separated structure
const migrateTeacherDept = (dept, teacherName = '') => {
  const cleanName = (teacherName || '').toLowerCase().trim();

  // 1. Cô Lê Thị Kim Thoa thuộc Tổ Ngoại Ngữ
  if (cleanName.includes('thoa')) {
    return 'Tổ Ngoại Ngữ';
  }

  // 2. Nguyễn Quốc Đăng và Lê Thị Kim Tuyến thuộc Tổ Sinh - CNNN
  if (cleanName.includes('đăng') || cleanName.includes('tuyến')) {
    return 'Tổ Sinh - CNNN';
  }

  // 3. Giáo viên Tin học
  const tinTeachers = ['hồ minh kiện', 'lý thành luân', 'nguyễn thị ngân', 'văn công sang'];
  if (tinTeachers.some(t => cleanName.includes(t))) {
    return 'Tổ Tin Học';
  }

  if (!dept || dept === 'Chưa phân tổ') {
    return 'Chưa phân tổ';
  }
  if (dept === 'Tổ Toán - Tin học') {
    return 'Tổ Toán';
  }
  if (dept === 'Tổ Vật Lý - Công Nghệ' || dept === 'Tổ Vật Lý' || dept === 'Tổ Vật Lí') {
    return 'Tổ Lý - CNCN';
  }
  if (dept === 'Tổ Sinh Học' || dept === 'Tổ Sinh') {
    return 'Tổ Sinh - CNNN';
  }
  return dept;
};

export const AppProvider = ({ children }) => {
  // Tự động nạp dữ liệu chính thức của trường khi mở web lần đầu hoặc khi dữ liệu đang trống
  if (typeof window !== 'undefined' && localStorage.getItem('photo_seed_official_v3') !== 'true') {
    localStorage.removeItem('photo_teachers');
    localStorage.removeItem('photo_classes');
    localStorage.removeItem('photo_assignments');
    localStorage.setItem('photo_seed_official_v3', 'true');
  }

  // Tự động xóa sạch mock data (các đơn photo mẫu và tiền nợ thử nghiệm) để bắt đầu dữ liệu thực tế
  if (typeof window !== 'undefined' && localStorage.getItem('photo_clean_mock_v4') !== 'true') {
    localStorage.removeItem('photo_billing_items');
    localStorage.removeItem('photo_class_debts');
    localStorage.removeItem('photo_class_payments');
    localStorage.setItem('photo_clean_mock_v4', 'true');
  }

  // Tự động nạp chuẩn xác dữ liệu Tuần 7 thực tế của người dùng (164 dòng = 9.987.400 đ)
  if (typeof window !== 'undefined' && localStorage.getItem('photo_sync_tuan7_v7') !== 'true') {
    localStorage.setItem('photo_billing_items', JSON.stringify(DEFAULT_BILLING_ITEMS_TUAN_7));
    localStorage.setItem('photo_weekly_debts_v2', JSON.stringify({ 'Tuần 7': DEFAULT_DEBTS_TUAN_7 }));
    localStorage.setItem('photo_current_week', 'Tuần 7');
    localStorage.removeItem('photo_classes');
    localStorage.setItem('photo_sync_tuan7_v7', 'true');
  }

  // Load data from localStorage or fallback to official school data
  const [teachers, setTeachers] = useState(() => {
    const saved = localStorage.getItem('photo_teachers');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(t => ({
            ...t,
            dept: migrateTeacherDept(t.dept, t.name)
          }));
        }
      } catch (e) {
        console.error(e);
      }
    }
    return DEFAULT_TEACHERS;
  });

  const [classes, setClasses] = useState(() => {
    const saved = localStorage.getItem('photo_classes');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.error(e);
      }
    }
    return DEFAULT_CLASSES;
  });

  const [assignments, setAssignments] = useState(() => {
    const saved = localStorage.getItem('photo_assignments');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.error(e);
      }
    }
    return DEFAULT_ASSIGNMENTS;
  });

  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('photo_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const defaultUnitPrice = (!parsed.defaultUnitPrice || parsed.defaultUnitPrice === 300) ? 380 : parsed.defaultUnitPrice;
        const gasWebAppUrl = (!parsed.gasWebAppUrl || parsed.gasWebAppUrl === '') ? DEFAULT_SETTINGS.gasWebAppUrl : parsed.gasWebAppUrl;
        return { ...DEFAULT_SETTINGS, ...parsed, defaultUnitPrice, gasWebAppUrl, schoolName: '' };
      } catch (e) {
        console.error(e);
      }
    }
    return DEFAULT_SETTINGS;
  });

  const [cashflow, setCashflow] = useState(() => {
    const saved = localStorage.getItem('photo_cashflow');
    return saved ? JSON.parse(saved) : DEFAULT_CASHFLOW;
  });

  // Active Billing items on Page 1 Excel-like grid - Mặc định nạp 164 dòng chuẩn Tuần 7 (9.987.400 đ)
  const [billingItems, setBillingItems] = useState(() => {
    const saved = localStorage.getItem('photo_billing_items');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter(item => item.week !== 'Tuần 10');
        }
      } catch (e) {
        console.error('Error parsing saved billing items', e);
      }
    }
    return DEFAULT_BILLING_ITEMS_TUAN_7;
  });

  // UI state
  const [currentTab, setCurrentTab] = useState('billing'); // 'billing' | 'admin' | 'cashflow'
  const [selectedDept, setSelectedDept] = useState('Tất cả các tổ');
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [isGroupedView, setIsGroupedView] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printClassFilter, setPrintClassFilter] = useState('all');
  const [syncStatus, setSyncStatus] = useState({ status: 'idle', message: '' });
  const [isDebtsSynced, setIsDebtsSynced] = useState(true);
  const [isCashflowSynced, setIsCashflowSynced] = useState(true);
  const [focusedItemId, setFocusedItemId] = useState(null); // ID dòng cần focus con trỏ chuột khi vừa nạp giáo viên / lớp
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false); // Ẩn / Hiện sidebar Chọn Giáo Viên & Lớp
  const [isSidebarAutoHide, setIsSidebarAutoHide] = useState(() => {
    const saved = localStorage.getItem('photo_sidebar_auto_hide');
    return saved !== null ? saved === 'true' : true; // Mặc định bật Auto ẩn sau khi chọn GV & Lớp
  });
  
  // Trạng thái lưu trữ trực tiếp vào File Excel Local (d:\APP-PHOTO26\CSDL_PHOTO_LOCAL.xlsx)
  const [localExcelStatus, setLocalExcelStatus] = useState({
    status: 'idle',
    lastSaved: null,
    filePath: 'd:\\APP-PHOTO26\\CSDL_PHOTO_LOCAL.xlsx',
    message: ''
  });
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));

  // Weekly Billing & Debt Tracking State
  const [availableWeeks, setAvailableWeeks] = useState(() => {
    const saved = localStorage.getItem('photo_available_weeks_v3');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (!parsed.includes('Tuần 7')) parsed.push('Tuần 7');
          return parsed;
        }
      } catch (e) {}
    }
    return ['Tuần 1', 'Tuần 2', 'Tuần 3', 'Tuần 4', 'Tuần 5', 'Tuần 6', 'Tuần 7'];
  });

  const [currentWeek, setCurrentWeek] = useState(() => {
    return localStorage.getItem('photo_current_week') || 'Tuần 7';
  });

  // Object storing class payments: { [week]: { [className]: { paidAmount, note, paidDate } } }
  const [classPayments, setClassPayments] = useState(() => {
    const saved = localStorage.getItem('photo_class_payments');
    if (saved) {
      try {
        return JSON.parse(saved) || {};
      } catch (e) {}
    }
    return {};
  });

  // Quản lý tiền nợ / thiếu theo từng tuần: { [week]: { [className]: { amount, note, updatedAt } } }
  const [weeklyDebts, setWeeklyDebts] = useState(() => {
    const saved = localStorage.getItem('photo_weekly_debts_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) return parsed;
      } catch (e) {}
    }
    return { 'Tuần 7': DEFAULT_DEBTS_TUAN_7 };
  });

  // Run on mount to ensure departments for Dang, Tuyen and all teachers match exact school structure
  useEffect(() => {
    setTeachers(prev => {
      let changed = false;
      const updated = prev.map(t => {
        const correctDept = migrateTeacherDept(t.dept, t.name);
        if (correctDept !== t.dept) {
          changed = true;
          return { ...t, dept: correctDept };
        }
        return t;
      });
      return changed ? updated : prev;
    });
  }, []);

  // Persistence to localStorage
  useEffect(() => {
    localStorage.setItem('photo_teachers', JSON.stringify(teachers));
  }, [teachers]);

  useEffect(() => {
    localStorage.setItem('photo_classes', JSON.stringify(classes));
  }, [classes]);

  useEffect(() => {
    localStorage.setItem('photo_assignments', JSON.stringify(assignments));
  }, [assignments]);

  useEffect(() => {
    localStorage.setItem('photo_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('photo_cashflow', JSON.stringify(cashflow));
  }, [cashflow]);

  useEffect(() => {
    localStorage.setItem('photo_billing_items', JSON.stringify(billingItems));
  }, [billingItems]);

  useEffect(() => {
    localStorage.setItem('photo_available_weeks_v3', JSON.stringify(availableWeeks));
  }, [availableWeeks]);

  useEffect(() => {
    localStorage.setItem('photo_current_week', currentWeek);
  }, [currentWeek]);

  useEffect(() => {
    localStorage.setItem('photo_class_payments', JSON.stringify(classPayments));
  }, [classPayments]);

  useEffect(() => {
    localStorage.setItem('photo_weekly_debts_v2', JSON.stringify(weeklyDebts));
  }, [weeklyDebts]);
  // Persist sidebar auto-hide preference

  useEffect(() => {
    localStorage.setItem('photo_sidebar_auto_hide', String(isSidebarAutoHide));
  }, [isSidebarAutoHide]);


  // Persist sidebar auto-hide preference

  // Thêm tuần mới vào danh sách tuần (Tuần 1..6 -> Thêm Tuần 7, Tuần 8...)
  const addWeek = (customWeekName) => {
    let newWeek = customWeekName ? customWeekName.trim() : '';
    if (!newWeek) {
      let maxNum = 0;
      availableWeeks.forEach(w => {
        const m = w.match(/(\d+)/);
        if (m) {
          const n = parseInt(m[1], 10);
          if (n > maxNum) maxNum = n;
        }
      });
      newWeek = `Tuần ${maxNum + 1}`;
    }

    if (!availableWeeks.includes(newWeek)) {
      setAvailableWeeks(prev => {
        const next = [...prev, newWeek];
        localStorage.setItem('photo_available_weeks_v3', JSON.stringify(next));
        return next;
      });
    }
    setCurrentWeek(newWeek);
    localStorage.setItem('photo_current_week', newWeek);
    return newWeek;
  };

  // classDebts tương ứng với tuần hiện tại
  const classDebts = useMemo(() => {
    return weeklyDebts[currentWeek] || {};
  }, [weeklyDebts, currentWeek]);

  // Cập nhật số tiền thiếu / nợ của 1 lớp trong tuần hiện tại
  const updateClassDebt = (className, amount, note = '') => {
    if (!className) return;
    const numAmount = Math.max(0, Number(amount) || 0);
    setIsDebtsSynced(false);
    setWeeklyDebts(prev => {
      const curWeek = { ...(prev[currentWeek] || {}) };
      if (numAmount === 0 && !note) {
        delete curWeek[className];
      } else {
        curWeek[className] = {
          amount: numAmount,
          note: note !== undefined ? note : (curWeek[className]?.note || ''),
          updatedAt: new Date().toLocaleDateString('vi-VN')
        };
      }
      return {
        ...prev,
        [currentWeek]: curWeek
      };
    });
  };

  // Xóa nợ của 1 lớp trong tuần hiện tại
  const removeClassDebt = (className) => {
    if (!className) return;
    setIsDebtsSynced(false);
    setWeeklyDebts(prev => {
      const curWeek = { ...(prev[currentWeek] || {}) };
      delete curWeek[className];
      return {
        ...prev,
        [currentWeek]: curWeek
      };
    });

    const targetUrl = settings.gasWebAppUrl || DEFAULT_SETTINGS.gasWebAppUrl;
    if (targetUrl && targetUrl.startsWith('http')) {
      fetch(targetUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'deleteClassDebt',
          key: `${currentWeek}_${className}`
        })
      }).catch(err => console.error('Lỗi khi xóa công nợ trên Google Sheets:', err));
    }
  };

  // Xóa toàn bộ nợ của tuần hiện tại
  const clearAllClassDebts = () => {
    setIsDebtsSynced(false);
    setWeeklyDebts(prev => ({
      ...prev,
      [currentWeek]: {}
    }));
  };

  // Lấy số tiền nợ của 1 lớp trong tuần hiện tại
  const getClassDebt = (className) => {
    if (!className) return 0;
    return Number(classDebts[className]?.amount) || 0;
  };

  // Lấy ghi chú nợ của 1 lớp trong tuần hiện tại
  const getClassDebtNote = (className) => {
    if (!className) return '';
    return classDebts[className]?.note || '';
  };

  // Tổng nợ tất cả các lớp trong tuần hiện tại
  const totalClassDebts = useMemo(() => {
    return Object.values(classDebts).reduce((sum, d) => sum + (Number(d?.amount) || 0), 0);
  }, [classDebts]);

  // Helper: Get student count for a class
  const getStudentCountForClass = (className) => {
    if (!className) return 0;
    const found = classes.find(c => c.className.toLowerCase() === className.toLowerCase());
    return found ? found.studentCount : 0;
  };

  // Helper: Get Homeroom Teacher for a class
  const getHomeroomTeacher = (className) => {
    if (!className) return 'Chưa phân công';
    const found = classes.find(c => c.className.toLowerCase() === className.toLowerCase());
    return found ? found.homeroomTeacher : 'Chưa phân công';
  };

  // Helper: Add a single item to billing grid
  const addBillingItem = (item) => {
    const studentCount = item.studentCount !== undefined && item.studentCount !== null && item.studentCount !== ''
      ? Math.max(0, Number(item.studentCount) || 0)
      : (item.studentCount === '' ? '' : Math.max(0, Number(getStudentCountForClass(item.className)) || 0));
    const extraCount = item.extraCount !== undefined && item.extraCount !== null && item.extraCount !== ''
      ? Math.max(0, Number(item.extraCount) || 0)
      : (item.extraCount === '' ? '' : 0);
    const unitPrice = item.unitPrice !== undefined && item.unitPrice !== null && item.unitPrice !== ''
      ? Math.max(0, Number(item.unitPrice) || 0)
      : (settings.defaultUnitPrice || 380);
    const amount = ((Number(studentCount) || 0) + (Number(extraCount) || 0)) * (Number(unitPrice) || 0);

    const newId = item.id || `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

    const newItem = {
      id: newId,
      week: item.week || currentWeek || 'Tuần 1',
      teacherName: item.teacherName || '',
      className: item.className || '',
      subject: item.subject !== undefined ? item.subject : '',
      studentCount: item.studentCount !== undefined ? item.studentCount : studentCount,
      extraCount: item.extraCount !== undefined ? item.extraCount : extraCount,
      unitPrice: unitPrice,
      amount: amount,
      status: item.status || 'CHO_TAI_LIEU',
      isPaid: item.status === 'DA_THANH_TOAN' || item.isPaid || false,
      note: item.note || '',
      isSynced: false
    };

    setBillingItems(prev => [...prev, newItem]);
    setFocusedItemId(newId);
    return newId;
  };

  // Helper: Thêm 1 dòng trống mới vào bảng tính để nhập thủ công phát sinh (GV dạy thay, học sinh tự in...)
  const handleAddBlankRow = () => {
    const newId = `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const newItem = {
      id: newId,
      week: currentWeek || 'Tuần 1',
      teacherName: '',
      className: '',
      subject: '',
      studentCount: '',
      extraCount: '',
      unitPrice: settings.defaultUnitPrice || 380,
      amount: 0,
      status: 'CHO_TAI_LIEU',
      isPaid: false,
      note: '',
      isSynced: false
    };

    setBillingItems(prev => [...prev, newItem]);
    setFocusedItemId(newId);
    if (currentTab !== 'billing') {
      setCurrentTab('billing');
    }
    return newId;
  };

  // Helper: Sao chép dòng đã nhập trước đó (hoặc 1 dòng cụ thể) cho dòng tiếp theo
  const duplicateBillingItem = (sourceItemOrId = null) => {
    let sourceItem = null;

    if (typeof sourceItemOrId === 'string') {
      sourceItem = billingItems.find(i => i.id === sourceItemOrId);
    } else if (sourceItemOrId && typeof sourceItemOrId === 'object') {
      sourceItem = sourceItemOrId;
    } else {
      // Mặc định lấy dòng cuối cùng thuộc tuần hiện tại (currentWeek)
      const currentWeekItems = billingItems.filter(item => (item.week || currentWeek) === currentWeek);
      if (currentWeekItems.length > 0) {
        sourceItem = currentWeekItems[currentWeekItems.length - 1];
      }
    }

    if (!sourceItem) {
      // Nếu chưa có dòng nào để sao chép thì thêm 1 dòng trống
      handleAddBlankRow();
      return;
    }

    const studentCount = sourceItem.studentCount !== '' ? Number(sourceItem.studentCount) : '';
    const extraCount = sourceItem.extraCount !== '' ? Number(sourceItem.extraCount) : 0;
    const unitPrice = Number(sourceItem.unitPrice) || settings.defaultUnitPrice || 380;
    const totalCopies = (Number(studentCount) || 0) + (Number(extraCount) || 0);

    const newId = `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const duplicatedItem = {
      ...sourceItem,
      id: newId,
      week: currentWeek || sourceItem.week || 'Tuần 1',
      unitPrice: unitPrice,
      amount: totalCopies * unitPrice,
      isSynced: false
    };

    setBillingItems(prev => [...prev, duplicatedItem]);
    setFocusedItemId(newId);
    if (currentTab !== 'billing') {
      setCurrentTab('billing');
    }
    return newId;
  };

  // Helper: Xuất toàn bộ CSDL 4 Sheet ra file Excel (.xlsx) chuẩn tải về máy
  const handleExportExcel = (customFileName = null) => {
    const wb = XLSX.utils.book_new();

    // 1. Sheet: BangTinhTien (Chi tiết đơn photo)
    const billingData = billingItems.map((item, idx) => {
      const copies = (Number(item.studentCount) || 0) + (Number(item.extraCount) || 0);
      const amount = Number(item.amount) || (copies * (Number(item.unitPrice) || 380));
      return {
        'STT': idx + 1,
        'Mã Đơn': item.id || '',
        'Tuần': item.week || currentWeek,
        'Tên Giáo Viên': item.teacherName || '',
        'Lớp': item.className || '',
        'Tài liệu': item.subject || '',
        'Sĩ Số': Number(item.studentCount) || 0,
        'SL Lẻ': Number(item.extraCount) || 0,
        'Tổng Bản In': copies,
        'Đơn Giá (đ)': Number(item.unitPrice) || 380,
        'Thành Tiền (đ)': amount,
        'Đã Thanh Toán': item.isPaid ? 'ĐÃ THU' : 'CHƯA THU',
        'Ghi Chú': item.note || '',
        'Cập Nhật Lúc': new Date().toLocaleString('vi-VN')
      };
    });
    const wsBilling = XLSX.utils.json_to_sheet(billingData.length > 0 ? billingData : [{ 'Thông báo': 'Chưa có đơn photo nào' }]);
    XLSX.utils.book_append_sheet(wb, wsBilling, 'BangTinhTien');

    // 2. Sheet: NoCacLop (Danh sách lớp nợ)
    const debts = weeklyDebts[currentWeek] || classDebts || {};
    const debtEntries = Object.keys(debts).filter(c => (debts[c]?.amount || 0) > 0).map((className, idx) => ({
      'STT': idx + 1,
      'Tuần': currentWeek,
      'Lớp': className,
      'Số Tiền Nợ / Thiếu (đ)': Number(debts[className].amount) || 0,
      'Lý Do / Ghi Chú Nợ': debts[className].note || '',
      'Cập Nhật Lúc': new Date().toLocaleString('vi-VN')
    }));
    const wsDebts = XLSX.utils.json_to_sheet(debtEntries.length > 0 ? debtEntries : [{ 'Thông báo': 'Không có lớp nào nợ/thiếu' }]);
    XLSX.utils.book_append_sheet(wb, wsDebts, 'NoCacLop');

    // 3. Sheet: SoQuyThuChi
    const wsCashflow = XLSX.utils.json_to_sheet(cashflow.length > 0 ? cashflow : [{ 'Thông báo': 'Chưa có giao dịch thu chi nào' }]);
    XLSX.utils.book_append_sheet(wb, wsCashflow, 'SoQuyThuChi');

    // 4. Sheet: TongHopDoanhThu
    const weekMap = {};
    billingItems.forEach(item => {
      const w = item.week || currentWeek;
      if (!weekMap[w]) weekMap[w] = { classes: new Set(), copies: 0, photoAmount: 0 };
      const copies = (Number(item.studentCount) || 0) + (Number(item.extraCount) || 0);
      weekMap[w].copies += copies;
      weekMap[w].photoAmount += Number(item.amount) || (copies * (Number(item.unitPrice) || 380));
      if (item.className) weekMap[w].classes.add(item.className);
    });
    const summaryData = Object.keys(weekMap).map((w, idx) => ({
      'STT': idx + 1,
      'Tuần Làm Việc': w,
      'Tổng Số Lớp Photo': weekMap[w].classes.size,
      'Tổng Số Bản In': weekMap[w].copies,
      'Tổng Tiền Photo (đ)': weekMap[w].photoAmount,
      'Cập Nhật Lúc': new Date().toLocaleString('vi-VN')
    }));
    const wsSummary = XLSX.utils.json_to_sheet(summaryData.length > 0 ? summaryData : [{ 'Thông báo': 'Chưa có dữ liệu tổng hợp' }]);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'TongHopDoanhThu');

    const targetFileName = (typeof customFileName === 'string' && customFileName)
      ? customFileName
      : `CSDL_PHOTO_${currentWeek}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, targetFileName);
  };

  // Helper: Mở nhanh file Google Sheet CSDL trên Google Drive
  const handleOpenDatabase = () => {
    const url = settings.sheetUrl || settings.driveFolderUrl || 'https://docs.google.com/spreadsheets';
    window.open(url, '_blank');
  };

  // Cập nhật số tiền nộp & ghi chú nợ của 1 lớp trong tuần cụ thể
  const updateClassPayment = (week, className, paidAmount, note = '') => {
    if (!week || !className) return;
    setClassPayments(prev => {
      const weekData = prev[week] || {};
      const currentEntry = weekData[className] || {};
      const updatedWeekData = {
        ...weekData,
        [className]: {
          ...currentEntry,
          paidAmount: Math.max(0, Number(paidAmount) || 0),
          note: note !== undefined ? note : (currentEntry.note || ''),
          paidDate: new Date().toISOString().split('T')[0]
        }
      };
      return {
        ...prev,
        [week]: updatedWeekData
      };
    });
  };


  // Tính toán công nợ tích lũy qua các tuần của một lớp học (Chuyển nợ sang tuần sau)
  const getClassDebtSummary = (className, targetWeek = currentWeek) => {
    if (!className) {
      return { 
        className: '', 
        week: targetWeek, 
        billedThisWeek: 0, 
        previousDebt: 0, 
        totalDue: 0, 
        paidAmount: 0, 
        remainingDebt: 0, 
        status: 'PAID',
        note: '',
        paidDate: '',
        items: []
      };
    }

    const targetIdx = availableWeeks.indexOf(targetWeek);
    const relevantWeeks = targetIdx >= 0 ? availableWeeks.slice(0, targetIdx + 1) : [targetWeek];

    let runningDebt = 0; // Nợ lũy kế chuyển từ tuần này sang tuần sau

    for (let i = 0; i < relevantWeeks.length; i++) {
      const wk = relevantWeeks[i];

      // Tiền photo phát sinh trong tuần này của lớp
      const itemsInWeek = billingItems.filter(item => 
        (item.className || '').trim().toLowerCase() === className.trim().toLowerCase() && 
        (item.week || availableWeeks[0] || 'Tuần 1') === wk
      );
      const billedInWeek = itemsInWeek.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

      // Tổng phải thu của tuần = Tiền photo tuần này + Nợ cũ mang sang
      const totalDueInWeek = billedInWeek + runningDebt;

      // Số tiền lớp đã đóng trong tuần này
      const paymentInfo = classPayments[wk]?.[className] || {};
      const paidInWeek = Number(paymentInfo.paidAmount) || 0;

      // Còn nợ tuần này = Tổng phải thu - Đã đóng
      const remainingInWeek = totalDueInWeek - paidInWeek;

      // Nếu đang xét đúng tuần mục tiêu -> trả về kết quả
      if (wk === targetWeek) {
        let status = 'UNPAID';
        if (totalDueInWeek === 0) {
          status = 'PAID';
        } else if (remainingInWeek <= 0) {
          status = remainingInWeek < 0 ? 'OVERPAID' : 'PAID';
        } else if (paidInWeek > 0) {
          status = 'PARTIAL';
        } else {
          status = 'UNPAID';
        }

        return {
          className,
          week: targetWeek,
          billedThisWeek: billedInWeek,
          previousDebt: runningDebt, // Nợ cũ các tuần trước chuyển sang
          totalDue: totalDueInWeek,  // Tổng phải nộp tuần này
          paidAmount: paidInWeek,    // Tiền lớp đã đóng
          remainingDebt: remainingInWeek, // Còn thiếu chuyển tuần sau
          status, // 'PAID' (Đã nộp đủ) | 'PARTIAL' (Còn thiếu) | 'UNPAID' (Chưa nộp) | 'OVERPAID' (Nộp dư)
          note: paymentInfo.note || '',
          paidDate: paymentInfo.paidDate || '',
          items: itemsInWeek
        };
      }

      // Chưa tới tuần mục tiêu -> gán nợ chuyển sang cho tuần tiếp theo
      runningDebt = remainingInWeek;
    }

    return {
      className,
      week: targetWeek,
      billedThisWeek: 0,
      previousDebt: runningDebt,
      totalDue: runningDebt,
      paidAmount: 0,
      remainingDebt: runningDebt,
      status: runningDebt > 0 ? 'UNPAID' : 'PAID',
      note: '',
      paidDate: '',
      items: []
    };
  };

  // Thống kê công nợ toàn trường của một tuần
  const getWeekStatistics = (targetWeek = currentWeek) => {
    // Thu thập danh sách tất cả các lớp
    const allClassNames = Array.from(new Set([
      ...classes.map(c => c.className),
      ...billingItems.map(i => i.className).filter(Boolean)
    ])).filter(Boolean).sort();

    let totalBilled = 0;
    let totalPreviousDebt = 0;
    let totalDue = 0;
    let totalPaid = 0;
    let totalRemaining = 0;
    let paidCount = 0;
    let partialCount = 0;
    let unpaidCount = 0;

    const classSummaries = allClassNames.map(clsName => {
      const summary = getClassDebtSummary(clsName, targetWeek);
      totalBilled += summary.billedThisWeek;
      totalPreviousDebt += summary.previousDebt;
      totalDue += summary.totalDue;
      totalPaid += summary.paidAmount;
      totalRemaining += summary.remainingDebt;

      if (summary.status === 'PAID' || summary.status === 'OVERPAID') {
        paidCount++;
      } else if (summary.status === 'PARTIAL') {
        partialCount++;
      } else if (summary.totalDue > 0) {
        unpaidCount++;
      }

      return summary;
    });

    return {
      week: targetWeek,
      totalBilled,
      totalPreviousDebt,
      totalDue,
      totalPaid,
      totalRemaining,
      paidCount,
      partialCount,
      unpaidCount,
      classSummaries
    };
  };

  // Helper: Add all classes taught by a teacher
  const addBatchClassesForTeacher = (teacher, classAssignments) => {
    if (!classAssignments || classAssignments.length === 0) return;
    
    const newItems = classAssignments.map((asg, idx) => {
      const studentCount = getStudentCountForClass(asg.className);
      const extraCount = 0; // Mặc định số lượng lẻ là 0 theo yêu cầu
      const unitPrice = settings.defaultUnitPrice || 380;
      return {
        id: `item-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
        week: currentWeek || 'Tuần 1',
        teacherName: teacher.name,
        className: asg.className,
        subject: asg.subject || 'Đề cương / Kiểm tra',
        studentCount: studentCount,
        extraCount: extraCount,
        unitPrice: unitPrice,
        amount: (studentCount + extraCount) * unitPrice,
        status: 'CHO_TAI_LIEU', // Mặc định là Chờ gửi tài liệu
        isPaid: false,
        note: 'In theo phân công',
        isSynced: false
      };
    });

    setBillingItems(prev => [...prev, ...newItems]);
    if (newItems.length > 0) {
      setFocusedItemId(newItems[0].id);
    }
  };

  // Update a single field in billing item (auto recalculates Thành Tiền)
  const updateBillingItem = (id, field, value) => {
    setBillingItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item;

        const updated = { ...item, [field]: value, isSynced: false };
        
        // If className changes, auto update studentCount only if found in registered classes
        if (field === 'className') {
          const found = classes.find(c => c.className.toLowerCase() === (value || '').trim().toLowerCase());
          if (found) {
            updated.studentCount = found.studentCount;
          }
        }

        // If status changes to DA_THANH_TOAN -> set isPaid true, else false
        if (field === 'status') {
          updated.isPaid = value === 'DA_THANH_TOAN';
        }

        // Auto recalculate amount: (Sĩ số + Số lượng lẻ) * Đơn giá
        const studentCount = Number(updated.studentCount) || 0;
        const extraCount = Number(updated.extraCount) || 0;
        const unitPrice = Number(updated.unitPrice) || 0;
        updated.amount = (studentCount + extraCount) * unitPrice;

        return updated;
      })
    );
  };

  // Remove single row - Đồng thời gửi lệnh xóa trực tiếp tới Google Sheets
  const removeBillingItem = (id) => {
    setBillingItems(prev => prev.filter(i => i.id !== id));

    const targetUrl = settings.gasWebAppUrl || DEFAULT_SETTINGS.gasWebAppUrl;
    if (targetUrl && targetUrl.startsWith('http') && id) {
      fetch(targetUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'deleteBillingItem',
          id: id
        })
      }).catch(err => console.error('Lỗi khi xóa dòng trên Google Sheets:', err));
    }
  };

  // Clear entire billing grid and debts (với cơ chế bảo vệ doanh thu)
  const clearBillingGrid = () => {
    if (billingItems.length > 0 && billingItems.some(i => !i.isSynced)) {
      if (!window.confirm('CẢNH BÁO BẢO VỆ DOANH THU: Bảng tính đang có dòng photo chưa được "Lưu CSDL"! Nếu làm mới lúc này, bạn sẽ bị mất thông tin tính tiền. Bạn có chắc chắn muốn xóa bảng tính và công nợ để bắt đầu tuần mới không?')) {
        return;
      }
    } else if (!window.confirm(`Bạn có chắc chắn muốn làm mới (xóa toàn bộ bảng tính và công nợ của ${currentWeek})?`)) {
      return;
    }
    setBillingItems(prev => prev.filter(i => (i.week || currentWeek) !== currentWeek));
    clearAllClassDebts();
  };

  const setClassDebts = (debtsOrUpdater) => {
    setWeeklyDebts(prev => {
      const current = prev[currentWeek] || {};
      const next = typeof debtsOrUpdater === 'function' ? debtsOrUpdater(current) : debtsOrUpdater;
      return {
        ...prev,
        [currentWeek]: next || {}
      };
    });
  };

  // Reset entire app data to empty
  const resetAllDataToEmpty = () => {
    if (window.confirm('CẢNH BÁO: Thao tác này sẽ xóa sạch toàn bộ dữ liệu Giáo viên, Lớp, Phân công và Bảng tính về trạng thái trống hoàn toàn. Bạn có chắc không?')) {
      setTeachers([]);
      setClasses([]);
      setAssignments([]);
      setBillingItems([]);
      setCashflow([]);
      localStorage.clear();
      localStorage.setItem('photo_mock_cleaned_v2', 'true');
      alert('Đã xóa sạch toàn bộ dữ liệu!');
    }
  };


  // Add Cashflow Transaction
  const addCashflowRecord = (record) => {
    const newRecord = {
      id: `CF-${Date.now().toString().slice(-6)}`,
      date: record.date || new Date().toISOString().split('T')[0],
      type: record.type, // 'THU' | 'CHI'
      category: record.category,
      amount: Number(record.amount) || 0,
      payer: record.payer || '',
      note: record.note || '',
      week: record.week || ''
    };
    setCashflow(prev => [newRecord, ...prev]);
    setIsCashflowSynced(false);
  };

  const removeCashflowRecord = (id) => {
    setCashflow(prev => prev.filter(r => r.id !== id));
    setIsCashflowSynced(false);

    const targetUrl = settings.gasWebAppUrl || DEFAULT_SETTINGS.gasWebAppUrl;
    if (targetUrl && targetUrl.startsWith('http') && id) {
      fetch(targetUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'deleteCashflowRecord',
          id: id
        })
      }).catch(err => console.error('Lỗi khi xóa phiếu thu chi trên Google Sheets:', err));
    }
  };

  // =========================================================================
  // HỆ THỐNG LƯU TRỮ SONG SONG: FILE EXCEL LOCAL VÀ GOOGLE SHEETS CLOUD
  // =========================================================================

  // Helper gọi API Local Excel (hỗ trợ cả khi mở localhost:3000 lẫn khi mở link Vercel kết nối về localhost:3000)
  const fetchLocalExcelEndpoint = async (endpointPath, options = {}) => {
    try {
      const res = await fetch(endpointPath, options);
      const contentType = res.headers.get('content-type');
      if (res.ok && contentType && contentType.includes('application/json')) {
        return res;
      }
    } catch (e) {}

    // Nếu đang mở trên Vercel Cloud, thử kết nối về server local (http://localhost:3000) trên máy tính
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      try {
        const localRes = await fetch(`http://localhost:3000${endpointPath}`, options);
        const localContentType = localRes.headers.get('content-type');
        if (localRes.ok && localContentType && localContentType.includes('application/json')) {
          return localRes;
        }
      } catch (e) {}
    }

    return null;
  };

  // 1. Lưu trực tiếp toàn bộ CSDL vào file Excel vật lý: d:\APP-PHOTO26\CSDL_PHOTO_LOCAL.xlsx
  const saveToLocalExcelFile = async (showNotification = false, fallbackDownloadOnCloud = false) => {
    try {
      setLocalExcelStatus(prev => ({ ...prev, status: 'saving', message: 'Đang ghi vào file Excel máy tính...' }));

      const payload = {
        billingItems,
        classDebts: weeklyDebts[currentWeek] || classDebts || {},
        classPayments,
        cashflow,
        currentWeek,
        timestamp: new Date().toISOString()
      };

      const res = await fetchLocalExcelEndpoint('/api/local-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res) {
        // Nếu đang dùng bản Cloud (Vercel) mà không bật server localhost:3000:
        // Khi người dùng chủ động bấm nút "Lưu CSDL", tự động tải file CSDL_PHOTO_LOCAL.xlsx về máy!
        if (fallbackDownloadOnCloud) {
          handleExportExcel('CSDL_PHOTO_LOCAL.xlsx');
          const timeStr = new Date().toLocaleTimeString('vi-VN');
          setLocalExcelStatus({
            status: 'saved',
            lastSaved: timeStr,
            filePath: 'CSDL_PHOTO_LOCAL.xlsx (Tải về máy)',
            message: `Đã tải CSDL_PHOTO_LOCAL.xlsx (${timeStr})`
          });
          return true;
        }
        setLocalExcelStatus(prev => ({ ...prev, status: 'idle' }));
        return false;
      }

      const data = await res.json();
      if (data.success) {
        const timeStr = new Date().toLocaleTimeString('vi-VN');

        if (data.isLocked) {
          setLocalExcelStatus({
            status: 'warning',
            lastSaved: timeStr,
            filePath: data.filePath || 'd:\\APP-PHOTO26\\CSDL_PHOTO_LOCAL_DONG_BO.xlsx',
            message: `⚠️ Excel đang mở: Đã lưu vào ${data.fileName}`
          });
          if (showNotification) {
            alert(`⚠️ CHÚ Ý: File Excel CSDL_PHOTO_LOCAL.xlsx đang được MỞ trong phần mềm Microsoft Excel trên máy tính!\n\nWindows đang khóa file không cho ghi đè trực tiếp.\n👉 Dữ liệu đã được lưu an toàn vào file: ${data.filePath}\n👉 Để cập nhật vào file chính CSDL_PHOTO_LOCAL.xlsx, bạn chỉ cần ĐÓNG/TẮT CỬA SỔ PHẦN MỀM EXCEL lại, sau đó bấm Lưu lại!`);
          }
          return true;
        }

        setLocalExcelStatus({
          status: 'saved',
          lastSaved: timeStr,
          filePath: data.filePath || 'd:\\APP-PHOTO26\\CSDL_PHOTO_LOCAL.xlsx',
          message: `Đã lưu CSDL_PHOTO_LOCAL.xlsx (${timeStr})`
        });
        if (showNotification) {
          alert(`✅ Đã lưu trực tiếp thành công vào file Excel trên máy:\n${data.filePath}`);
        }
        return true;
      } else {
        throw new Error(data.error || 'Lỗi khi ghi file Excel');
      }
    } catch (err) {
      console.warn('Lưu file Excel máy tính:', err);
      setLocalExcelStatus({
        status: 'error',
        lastSaved: null,
        filePath: 'd:\\APP-PHOTO26\\CSDL_PHOTO_LOCAL.xlsx',
        message: 'Lỗi ghi file Excel máy (kiểm tra xem file có đang mở trong Excel không)'
      });
      return false;
    }
  };

  // 2. Mở file Excel CSDL_PHOTO_LOCAL.xlsx trực tiếp trên phần mềm Microsoft Excel
  const openLocalExcelFile = async () => {
    try {
      // Trước khi mở, tự động lưu phiên bản mới nhất vào file
      await saveToLocalExcelFile(false, false);
      const res = await fetchLocalExcelEndpoint('/api/open-local-excel', { method: 'POST' });
      if (!res) {
        alert('Chức năng mở file Excel trực tiếp khả dụng khi chạy ứng dụng trên máy tính. Bạn có thể mở file tại thư mục:\nd:\\APP-PHOTO26\\CSDL_PHOTO_LOCAL.xlsx');
        return;
      }
      const data = await res.json();
      if (!data.success) {
        alert(data.message || 'Không thể mở file Excel tự động. Bạn có thể mở trực tiếp tại: d:\\APP-PHOTO26\\CSDL_PHOTO_LOCAL.xlsx');
      }
    } catch (err) {
      console.error(err);
      alert('Bạn có thể mở trực tiếp file tại thư mục dự án:\nd:\\APP-PHOTO26\\CSDL_PHOTO_LOCAL.xlsx');
    }
  };

  // 3. Đọc dữ liệu từ file Excel CSDL_PHOTO_LOCAL.xlsx vào ứng dụng
  const loadFromLocalExcelFile = async (forceOverwrite = false) => {
    try {
      const res = await fetchLocalExcelEndpoint('/api/local-excel');
      if (!res) return null;

      const result = await res.json();
      if (result.success && result.exists && result.data) {
        const { billingItems: loadedItems, classDebts: loadedDebts, cashflow: loadedCashflow } = result.data;
        let loadedCount = 0;

        if (Array.isArray(loadedItems) && loadedItems.length > 0) {
          if (forceOverwrite || billingItems.length === 0) {
            setBillingItems(loadedItems);
            loadedCount += loadedItems.length;
          }
        }
        if (loadedDebts && Object.keys(loadedDebts).length > 0) {
          if (forceOverwrite || Object.keys(classDebts).length === 0) {
            setWeeklyDebts(prev => ({
              ...prev,
              [currentWeek]: loadedDebts
            }));
          }
        }
        if (Array.isArray(loadedCashflow) && loadedCashflow.length > 0) {
          if (forceOverwrite || cashflow.length === 0) {
            setCashflow(loadedCashflow);
          }
        }

        const timeStr = result.lastModified ? new Date(result.lastModified).toLocaleTimeString('vi-VN') : '';
        setLocalExcelStatus({
          status: 'saved',
          lastSaved: timeStr,
          filePath: result.filePath || 'd:\\APP-PHOTO26\\CSDL_PHOTO_LOCAL.xlsx',
          message: `Đã nạp từ CSDL_PHOTO_LOCAL.xlsx`
        });

        return result.data;
      }
    } catch (err) {
      console.warn('Không đọc được file Excel local:', err);
    }
    return null;
  };

  // 4. LƯU TRỮ SONG SONG (DUAL-WRITE): Ghi đồng thời File Excel máy tính và Google Sheets
  const syncToGoogleSheets = async (isAutoSync = false) => {
    // LUỒNG 1: GHI TỨC THÌ VÀO FILE EXCEL MÁY TÍNH (Nếu bấm nút Lưu CSDL trên Cloud mà chưa chạy server local thì tự động tải file CSDL_PHOTO_LOCAL.xlsx về máy)
    const localSavePromise = saveToLocalExcelFile(false, !isAutoSync);

    const currentWeekItems = billingItems.filter(item => (item.week || currentWeek) === currentWeek);

    // LUỒNG 2: KIỂM TRA MẠNG VÀ GỬI LÊN GOOGLE SHEETS
    const isCurrentlyOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    if (!isCurrentlyOnline) {
      await localSavePromise;
      setSyncStatus({ 
        status: 'offline_saved', 
        message: `🟠 Ngoại tuyến: Đã lưu an toàn vào d:\\APP-PHOTO26\\CSDL_PHOTO_LOCAL.xlsx (Sẽ tự động đồng bộ Google Sheets khi có Internet)!` 
      });
      setTimeout(() => setSyncStatus({ status: 'idle', message: '' }), 5000);
      return;
    }

    // Nếu bảng photo trống nhưng có công nợ -> chuyển sang lưu công nợ
    if (currentWeekItems.length === 0) {
      if (Object.keys(classDebts).length > 0) {
        await localSavePromise;
        return await syncDebtsToGoogleSheets(currentWeek, isAutoSync);
      }
      await localSavePromise;
      if (!isAutoSync) {
        alert(`Đã lưu file Excel máy tính! Bảng tính của ${currentWeek} hiện đang trống, chưa có đơn để gửi Google Sheets.`);
      }
      return;
    }

    const targetUrl = settings.gasWebAppUrl || DEFAULT_SETTINGS.gasWebAppUrl;
    if (!targetUrl || !targetUrl.startsWith('http')) {
      await localSavePromise;
      if (!isAutoSync) {
        alert('Đã lưu trực tiếp vào File Excel máy tính! (Chưa cấu hình URL Google Apps Script để đẩy lên Drive)');
      }
      return;
    }

    setSyncStatus({ 
      status: 'syncing', 
      message: isAutoSync
        ? `Đang lưu song song (File Excel máy tính & Google Sheets)...`
        : `Đang lưu song song vào File Excel máy & Google Sheets (${currentWeek})...` 
    });
    
    try {
      const classDebtsList = Object.entries(classDebts).filter(([_, d]) => (d?.amount || 0) > 0).map(([cls, d]) => {
        const classPhotoAmount = currentWeekItems
          .filter(i => (i.className || '').toLowerCase() === cls.toLowerCase())
          .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
        const debtNum = Number(d?.amount) || 0;

        return {
          key: `${currentWeek}_${cls}`,
          week: currentWeek,
          className: cls,
          homeroomTeacher: getHomeroomTeacher(cls),
          previousDebt: debtNum,
          debtAmount: debtNum,
          photoAmount: classPhotoAmount,
          totalDue: debtNum + classPhotoAmount,
          note: d?.note || '',
          updatedAt: d?.updatedAt || new Date().toLocaleDateString('vi-VN')
        };
      });

      const payload = {
        action: 'saveBillingData',
        folderId: settings.driveFolderId || DEFAULT_SETTINGS.driveFolderId,
        currentWeek: currentWeek,
        syncWeekOnly: true,
        items: currentWeekItems.map(item => ({
          ...item,
          week: currentWeek,
          statusLabel: ORDER_STATUSES[item.status]?.label || (item.isPaid ? 'Đã thanh toán' : 'Chờ gửi tài liệu')
        })),
        classDebts: classDebtsList,
        timestamp: new Date().toISOString()
      };

      await fetch(targetUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });

      setBillingItems(prev => prev.map(item => 
        (item.week || currentWeek) === currentWeek ? { ...item, isSynced: true } : item
      ));
      setIsDebtsSynced(true);

      await localSavePromise;

      setSyncStatus({ 
        status: 'success', 
        message: isAutoSync
          ? `✅ Đã lưu song song thành công (File Excel máy tính & Google Sheets)!`
          : `✅ Đã lưu song song hoàn hảo: File Excel Local & Google Sheets khớp 100%!` 
      });
    } catch (err) {
      console.error(err);
      await localSavePromise;
      if (!isAutoSync) {
        setSyncStatus({
          status: 'warning',
          message: '⚠️ Đã lưu an toàn vào File Excel máy tính! (Lỗi gửi lên Google Sheets do mạng chập chờn)'
        });
      }
    }

    setTimeout(() => {
      setSyncStatus({ status: 'idle', message: '' });
    }, 4000);
  };

  // 2. Sync riêng Công Nợ các lớp theo tuần lên Google Sheets (Tab: CongNo_TheoTuan)
  const syncDebtsToGoogleSheets = async (targetWeek = currentWeek, isAutoSync = false) => {
    // Luồng 1: Luôn ghi đồng thời vào file Excel máy tính
    saveToLocalExcelFile(false);

    const targetDebts = weeklyDebts[targetWeek] || {};
    const targetWeekItems = billingItems.filter(item => (item.week || targetWeek) === targetWeek);

    const targetUrl = settings.gasWebAppUrl || DEFAULT_SETTINGS.gasWebAppUrl;
    if (!targetUrl || !targetUrl.startsWith('http')) {
      if (!isAutoSync) {
        alert('Đã lưu vào File Excel máy tính! (Chưa cấu hình URL Google Apps Script)');
      }
      return;
    }

    const debtsList = Object.entries(targetDebts).filter(([_, d]) => (d?.amount || 0) > 0).map(([cls, d]) => {
      const classPhotoAmount = targetWeekItems
        .filter(i => (i.className || '').toLowerCase() === cls.toLowerCase())
        .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
      const debtNum = Number(d?.amount) || 0;

      return {
        key: `${targetWeek}_${cls}`,
        week: targetWeek,
        className: cls,
        homeroomTeacher: getHomeroomTeacher(cls),
        previousDebt: debtNum,
        debtAmount: debtNum,
        photoAmount: classPhotoAmount,
        totalDue: debtNum + classPhotoAmount,
        note: d?.note || '',
        updatedAt: d?.updatedAt || new Date().toLocaleDateString('vi-VN')
      };
    });

    setSyncStatus({ 
      status: 'syncing', 
      message: isAutoSync
        ? `Đang tự động lưu CSDL Công Nợ (${targetWeek}) lên Google Sheets...`
        : `Đang lưu CSDL Công Nợ (${targetWeek}) với ${debtsList.length} lớp lên Google Sheets...` 
    });

    try {
      const payload = {
        action: 'saveClassDebts',
        currentWeek: targetWeek,
        classDebts: debtsList,
        timestamp: new Date().toISOString()
      };

      await fetch(targetUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });

      setIsDebtsSynced(true);
      setSyncStatus({ 
        status: 'success', 
        message: isAutoSync
          ? `Đã tự động lưu thành công CSDL Công Nợ (${targetWeek}) lên Google Sheets!`
          : `Đã lưu CSDL Công Nợ (${targetWeek}) thành công! (${debtsList.length} lớp còn thiếu/nợ trên Sheet CongNo_TheoTuan)` 
      });
    } catch (err) {
      console.error(err);
      if (!isAutoSync) {
        setSyncStatus({
          status: 'error',
          message: 'Lỗi kết nối khi gửi dữ liệu công nợ lên Google Sheets. Vui lòng kiểm tra lại mạng.'
        });
      }
    }

    setTimeout(() => {
      setSyncStatus({ status: 'idle', message: '' });
    }, 3500);
  };

  // 3. Sync Sổ Quỹ Thu Chi lên Google Sheets (Tab: SoQuy_ThuChi)
  const syncCashflowToGoogleSheets = async (customRecords = null, isAutoSync = false) => {
    // Luồng 1: Luôn ghi đồng thời vào file Excel máy tính
    saveToLocalExcelFile(false);

    const recordsToSync = customRecords || cashflow;
    const targetUrl = settings.gasWebAppUrl || DEFAULT_SETTINGS.gasWebAppUrl;
    if (!targetUrl || !targetUrl.startsWith('http')) {
      if (!isAutoSync) {
        alert('Đã lưu vào File Excel máy tính! (Chưa cấu hình URL Google Apps Script)');
      }
      return;
    }

    setSyncStatus({ 
      status: 'syncing', 
      message: isAutoSync
        ? `Đang tự động lưu ${recordsToSync.length} phiếu Sổ Quỹ lên Google Sheets...`
        : `Đang lưu ${recordsToSync.length} phiếu Sổ Quỹ lên Google Sheets...` 
    });

    try {
      const payload = {
        action: 'saveCashflow',
        records: recordsToSync,
        syncAll: true,
        timestamp: new Date().toISOString()
      };

      await fetch(targetUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });

      setIsCashflowSynced(true);
      setSyncStatus({ 
        status: 'success', 
        message: isAutoSync
          ? `Đã tự động lưu thành công Sổ Quỹ Thu Chi (${recordsToSync.length} phiếu) lên Google Sheets!`
          : `Đã lưu thành công Sổ Quỹ Thu Chi (${recordsToSync.length} phiếu) lên Sheet SoQuy_ThuChi!` 
      });
    } catch (err) {
      console.error(err);
      if (!isAutoSync) {
        setSyncStatus({
          status: 'error',
          message: 'Lỗi kết nối khi lưu Sổ Quỹ lên Google Sheets. Vui lòng kiểm tra lại mạng.'
        });
      }
    }

    setTimeout(() => {
      setSyncStatus({ status: 'idle', message: '' });
    }, 3500);
  };

  // 4. Tải riêng Sổ Quỹ Thu Chi từ Google Sheets
  const fetchCashflowFromGoogleSheets = async () => {
    const targetUrl = settings.gasWebAppUrl || DEFAULT_SETTINGS.gasWebAppUrl;
    if (!targetUrl || !targetUrl.startsWith('http')) {
      alert('Chưa có URL Google Apps Script. Vui lòng cấu hình trong Tab 2: Dashboard Admin & CSDL.');
      return;
    }

    setSyncStatus({ status: 'syncing', message: 'Đang tải Sổ Quỹ Thu Chi từ Google Sheets...' });

    try {
      const fetchUrl = targetUrl + (targetUrl.includes('?') ? '&' : '?') + 'action=fetchCashflow';
      const res = await fetch(fetchUrl);
      const data = await res.json();

      if (data && data.status === 'success' && Array.isArray(data.cashflow)) {
        setCashflow(data.cashflow);
        setIsCashflowSynced(true);
        setSyncStatus({ 
          status: 'success', 
          message: `Đã tải thành công ${data.cashflow.length} phiếu Sổ Quỹ từ Google Sheets!` 
        });
      } else {
        setSyncStatus({ status: 'error', message: 'Không thể đọc dữ liệu Sổ Quỹ từ Google Sheets.' });
      }
    } catch (err) {
      console.error(err);
      setSyncStatus({
        status: 'error',
        message: 'Lỗi kết nối khi tải Sổ Quỹ từ Google Sheets.'
      });
    }

    setTimeout(() => {
      setSyncStatus({ status: 'idle', message: '' });
    }, 4500);
  };

  // Tự động lưu Photo lên Google Sheets (Auto-Sync với Debounce 2 giây)
  const autoSaveTimerRef = useRef(null);
  useEffect(() => {
    const hasUnsavedInCurrentWeek = billingItems.some(
      item => (item.week || currentWeek) === currentWeek && item.isSynced === false
    );
    if (!hasUnsavedInCurrentWeek) return;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      syncToGoogleSheets(true);
    }, 2000);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [billingItems, currentWeek]);

  // Tự động lưu Công Nợ lên Google Sheets khi có chỉnh sửa (Debounce 2.5 giây)
  const autoSaveDebtsTimerRef = useRef(null);
  useEffect(() => {
    if (isDebtsSynced) return;
    if (autoSaveDebtsTimerRef.current) clearTimeout(autoSaveDebtsTimerRef.current);

    autoSaveDebtsTimerRef.current = setTimeout(() => {
      syncDebtsToGoogleSheets(currentWeek, true);
    }, 2500);

    return () => {
      if (autoSaveDebtsTimerRef.current) clearTimeout(autoSaveDebtsTimerRef.current);
    };
  }, [weeklyDebts, currentWeek, isDebtsSynced]);

  // Tự động lưu Sổ Quỹ Thu Chi lên Google Sheets khi có chỉnh sửa (Debounce 2.5 giây)
  const autoSaveCashflowTimerRef = useRef(null);
  useEffect(() => {
    if (isCashflowSynced) return;
    if (autoSaveCashflowTimerRef.current) clearTimeout(autoSaveCashflowTimerRef.current);

    autoSaveCashflowTimerRef.current = setTimeout(() => {
      syncCashflowToGoogleSheets(null, true);
    }, 2500);

    return () => {
      if (autoSaveCashflowTimerRef.current) clearTimeout(autoSaveCashflowTimerRef.current);
    };
  }, [cashflow, isCashflowSynced]);

  // Lắng nghe sự kiện Online / Offline mạng: Tự động đồng bộ lên Google Sheets khi có mạng lại
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Tự động đẩy bù lên Google Sheets khi mạng vừa khôi phục
      syncToGoogleSheets(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus({
        status: 'offline_saved',
        message: '🟠 Đang ngoại tuyến: Hệ thống đang lưu trực tiếp vào File Excel máy tính (d:\\APP-PHOTO26\\CSDL_PHOTO_LOCAL.xlsx)'
      });
      setTimeout(() => setSyncStatus({ status: 'idle', message: '' }), 5000);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [billingItems, weeklyDebts, cashflow, currentWeek]);

  // Khởi động: Tự động nạp CSDL từ file Excel máy tính nếu chưa có dữ liệu trên trình duyệt
  useEffect(() => {
    loadFromLocalExcelFile(false);
  }, []);

  // Tải toàn bộ dữ liệu (Photo + Công Nợ + Sổ Quỹ) từ Google Sheets trên Drive về Web App
  const fetchFromGoogleSheets = async () => {
    if (billingItems.length > 0 && billingItems.some(i => !i.isSynced)) {
      if (!window.confirm('CẢNH BÁO BẢO VỆ DOANH THU: Bảng tính đang có các dòng chưa bấm "Lưu CSDL". Nếu tải từ Drive về lúc này, dữ liệu chưa lưu sẽ bị xóa mất. Bạn có chắc chắn muốn ghi đè không?')) {
        return;
      }
    }

    const targetUrl = settings.gasWebAppUrl || DEFAULT_SETTINGS.gasWebAppUrl;
    if (!targetUrl || !targetUrl.startsWith('http')) {
      alert('Chưa có URL Google Apps Script. Vui lòng cấu hình trong Tab 2: Dashboard Admin & CSDL.');
      return;
    }

    setSyncStatus({ status: 'syncing', message: 'Đang tải toàn bộ dữ liệu từ Google Sheets trên Drive về...' });

    try {
      const fetchUrl = targetUrl + (targetUrl.includes('?') ? '&' : '?') + 'action=fetchBillingData';
      const res = await fetch(fetchUrl);
      const data = await res.json();

      if (data && data.status === 'success' && Array.isArray(data.items)) {
        if (data.spreadsheetUrl && (!settings.sheetUrl || settings.sheetUrl !== data.spreadsheetUrl)) {
          setSettings(prev => ({ ...prev, sheetUrl: data.spreadsheetUrl }));
        }

        const loadedWeeks = new Set(availableWeeks);
        const loadedItems = data.items
          .filter(item => item.week !== 'Tuần 10')
          .map(item => {
            const w = item.week || 'Tuần 1';
            loadedWeeks.add(w);
            return {
              ...item,
              week: w,
              status: item.status || (item.isPaid ? 'DA_THANH_TOAN' : 'CHO_TAI_LIEU'),
              isSynced: true
            };
          });

        setAvailableWeeks(Array.from(loadedWeeks));

        // Cập nhật công nợ các tuần nếu có dữ liệu debts trả về
        if (data.debts && typeof data.debts === 'object' && Object.keys(data.debts).length > 0) {
          setWeeklyDebts(prev => ({
            ...prev,
            ...data.debts
          }));
          setIsDebtsSynced(true);
        }

        // Cập nhật sổ quỹ thu chi nếu có dữ liệu cashflow trả về
        if (data.cashflow && Array.isArray(data.cashflow) && data.cashflow.length > 0) {
          setCashflow(data.cashflow);
          setIsCashflowSynced(true);
        }

        setBillingItems(loadedItems);
        setSyncStatus({ 
          status: 'success', 
          message: `Đã tải thành công ${loadedItems.length} đơn photo, CSDL Công Nợ và ${data.cashflow ? data.cashflow.length : 0} phiếu Sổ Quỹ từ Google Sheets!` 
        });
      } else {
        setSyncStatus({ status: 'error', message: 'Dữ liệu trả về từ Google Sheets không đúng định dạng.' });
      }
    } catch (err) {
      console.error(err);
      setSyncStatus({
        status: 'error',
        message: 'Không thể kết nối tải dữ liệu từ Google Sheets. Vui lòng kiểm tra lại URL Script.'
      });
    }

    setTimeout(() => {
      setSyncStatus({ status: 'idle', message: '' });
    }, 4500);
  };

  const dynamicDepartments = React.useMemo(() => {
    const set = new Set(['Tất cả các tổ']);
    DEFAULT_DEPARTMENTS.forEach(d => {
      if (d !== 'Tất cả các tổ' && d !== 'Chưa phân tổ') set.add(d);
    });
    teachers.forEach(t => {
      if (t.dept && t.dept !== 'Chưa phân tổ' && t.dept !== 'Tất cả các tổ') {
        set.add(t.dept.trim());
      }
    });
    set.add('Chưa phân tổ');
    return Array.from(set);
  }, [teachers]);

  return (
    <AppContext.Provider
      value={{
        departments: dynamicDepartments,
        teachers,
        setTeachers,
        classes,
        setClasses,
        assignments,
        setAssignments,
        settings,
        setSettings,
        cashflow,
        billingItems,
        setBillingItems,
        
        currentTab,
        setCurrentTab,
        selectedDept,
        setSelectedDept,
        selectedTeacher,
        setSelectedTeacher,
        isGroupedView,
        setIsGroupedView,
        isPrintModalOpen,
        setIsPrintModalOpen,
        printClassFilter,
        setPrintClassFilter,
        syncStatus,

        currentWeek,
        setCurrentWeek,
        availableWeeks,
        setAvailableWeeks,
        classPayments,
        setClassPayments,
        updateClassPayment,
        addWeek,
        getClassDebtSummary,
        getWeekStatistics,

        // Direct Class Debts (Quản lý trực tiếp nợ / thiếu theo yêu cầu người dùng)
        classDebts,
        setClassDebts,
        weeklyDebts,
        setWeeklyDebts,
        updateClassDebt,
        removeClassDebt,
        clearAllClassDebts,
        getClassDebt,
        getClassDebtNote,
        totalClassDebts,
        isDebtsSynced,
        isCashflowSynced,
        focusedItemId,
        setFocusedItemId,
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        isSidebarAutoHide,
        setIsSidebarAutoHide,

        addBillingItem,
        handleAddBlankRow,
        duplicateBillingItem,
        handleExportExcel,
        handleOpenDatabase,
        addBatchClassesForTeacher,
        updateBillingItem,
        removeBillingItem,
        clearBillingGrid,
        resetAllDataToEmpty,
        addCashflowRecord,
        removeCashflowRecord,
        syncToGoogleSheets,
        syncDebtsToGoogleSheets,
        syncCashflowToGoogleSheets,
        fetchCashflowFromGoogleSheets,
        fetchFromGoogleSheets,

        // Hệ thống lưu trữ song song File Excel Local & Google Sheets
        localExcelStatus,
        isOnline,
        saveToLocalExcelFile,
        loadFromLocalExcelFile,
        openLocalExcelFile,

        getStudentCountForClass,
        getHomeroomTeacher,
        ORDER_STATUSES
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
