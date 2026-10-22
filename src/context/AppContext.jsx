import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  DEFAULT_DEPARTMENTS,
  DEFAULT_TEACHERS,
  DEFAULT_CLASSES,
  DEFAULT_ASSIGNMENTS,
  DEFAULT_SETTINGS,
  DEFAULT_CASHFLOW
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

  // Active Billing items on Page 1 Excel-like grid - starts 100% empty
  const [billingItems, setBillingItems] = useState(() => {
    const saved = localStorage.getItem('photo_billing_items');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map(item => {
            const up = (!item.unitPrice || item.unitPrice === 300) ? 380 : item.unitPrice;
            const extra = (item.extraCount === 1) ? 0 : (Number(item.extraCount) || 0);
            const copies = (Number(item.studentCount) || 0) + extra;
            return {
              ...item,
              unitPrice: up,
              extraCount: extra,
              amount: copies * up
            };
          });
        }
      } catch (e) {
        console.error('Error parsing saved billing items', e);
      }
    }
    return [];
  });

  // UI state
  const [currentTab, setCurrentTab] = useState('billing'); // 'billing' | 'admin' | 'cashflow'
  const [selectedDept, setSelectedDept] = useState('Tất cả các tổ');
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [isGroupedView, setIsGroupedView] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printClassFilter, setPrintClassFilter] = useState('all');
  const [syncStatus, setSyncStatus] = useState({ status: 'idle', message: '' });

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

  // Helper: Get student count for a class
  const getStudentCountForClass = (className) => {
    if (!className) return 0;
    const found = classes.find(c => c.className.toLowerCase() === className.toLowerCase());
    return found ? found.studentCount : 40;
  };

  // Helper: Get Homeroom Teacher for a class
  const getHomeroomTeacher = (className) => {
    if (!className) return 'Chưa phân công';
    const found = classes.find(c => c.className.toLowerCase() === className.toLowerCase());
    return found ? found.homeroomTeacher : 'Chưa phân công';
  };

  // Helper: Add a single item to billing grid
  const addBillingItem = (item) => {
    const studentCount = item.studentCount ?? getStudentCountForClass(item.className);
    const extraCount = item.extraCount ?? 0;
    const unitPrice = item.unitPrice ?? settings.defaultUnitPrice;
    const amount = (Number(studentCount) + Number(extraCount)) * Number(unitPrice);

    const newItem = {
      id: item.id || `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      teacherName: item.teacherName || '',
      className: item.className || '',
      subject: item.subject || 'Tài liệu photo',
      studentCount: Number(studentCount) || 0,
      extraCount: Number(extraCount) || 0,
      unitPrice: Number(unitPrice) || settings.defaultUnitPrice,
      amount: amount,
      status: item.status || 'CHO_TAI_LIEU',
      isPaid: item.status === 'DA_THANH_TOAN' || item.isPaid || false,
      note: item.note || '',
      isSynced: false
    };

    setBillingItems(prev => [...prev, newItem]);
  };

  // Helper: Add all classes taught by a teacher
  const addBatchClassesForTeacher = (teacher, classAssignments) => {
    if (!classAssignments || classAssignments.length === 0) return;
    
    const newItems = classAssignments.map(asg => {
      const studentCount = getStudentCountForClass(asg.className);
      const extraCount = 0; // Mặc định số lượng lẻ là 0 theo yêu cầu
      const unitPrice = settings.defaultUnitPrice;
      return {
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
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
  };

  // Update a single field in billing item (auto recalculates Thành Tiền)
  const updateBillingItem = (id, field, value) => {
    setBillingItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item;

        const updated = { ...item, [field]: value, isSynced: false };
        
        // If className changes, auto update studentCount if default
        if (field === 'className') {
          updated.studentCount = getStudentCountForClass(value);
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

  // Remove single row
  const removeBillingItem = (id) => {
    setBillingItems(prev => prev.filter(i => i.id !== id));
  };

  // Clear entire billing grid
  const clearBillingGrid = () => {
    if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ bảng tính hiện tại để tạo phiên mới?')) {
      setBillingItems([]);
    }
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
      note: record.note || ''
    };
    setCashflow(prev => [newRecord, ...prev]);
  };

  const removeCashflowRecord = (id) => {
    setCashflow(prev => prev.filter(r => r.id !== id));
  };

  // Sync to Google Sheets Web App (Hỗ trợ UPSERT - cập nhật thông minh không trùng lặp)
  const syncToGoogleSheets = async () => {
    if (billingItems.length === 0) {
      alert('Bảng tính hiện đang trống, chưa có dữ liệu để lưu vào Google Sheets.');
      return;
    }

    const targetUrl = settings.gasWebAppUrl || DEFAULT_SETTINGS.gasWebAppUrl;
    if (!targetUrl || !targetUrl.startsWith('http')) {
      alert('Chưa có URL Google Apps Script. Vui lòng cấu hình trong Tab 2: Dashboard Admin & CSDL.');
      return;
    }

    setSyncStatus({ status: 'syncing', message: 'Đang đồng bộ và cập nhật lên Google Sheets trên Drive...' });
    
    try {
      const payload = {
        action: 'saveBillingData',
        folderId: settings.driveFolderId || DEFAULT_SETTINGS.driveFolderId,
        items: billingItems.map(item => ({
          ...item,
          statusLabel: ORDER_STATUSES[item.status]?.label || (item.isPaid ? 'Đã thanh toán' : 'Chờ gửi tài liệu')
        })),
        timestamp: new Date().toISOString()
      };

      // Gửi POST tới Google Apps Script với mode no-cors để trình duyệt không chặn chuyển hướng CORS
      await fetch(targetUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });

      // Đánh dấu tất cả các dòng hiện tại đã đồng bộ thành công
      setBillingItems(prev => prev.map(item => ({ ...item, isSynced: true })));

      setSyncStatus({ 
        status: 'success', 
        message: `Đã lưu & đồng bộ thành công ${billingItems.length} mục vào Google Sheets (tự động cập nhật không trùng lặp)!` 
      });
    } catch (err) {
      console.error(err);
      setSyncStatus({
        status: 'error',
        message: 'Lỗi kết nối khi gửi lên Google Drive. Vui lòng kiểm tra lại đường truyền mạng.'
      });
    }

    setTimeout(() => {
      setSyncStatus({ status: 'idle', message: '' });
    }, 4500);
  };

  // Tải toàn bộ dữ liệu đơn photo từ Google Sheets trên Drive về Web App (Đồng bộ chiều về)
  const fetchFromGoogleSheets = async () => {
    const targetUrl = settings.gasWebAppUrl || DEFAULT_SETTINGS.gasWebAppUrl;
    if (!targetUrl || !targetUrl.startsWith('http')) {
      alert('Chưa có URL Google Apps Script. Vui lòng cấu hình trong Tab 2: Dashboard Admin & CSDL.');
      return;
    }

    setSyncStatus({ status: 'syncing', message: 'Đang tải dữ liệu từ Google Sheets trên Drive về...' });

    try {
      const fetchUrl = targetUrl + (targetUrl.includes('?') ? '&' : '?') + 'action=fetchBillingData';
      const res = await fetch(fetchUrl);
      const data = await res.json();

      if (data && data.status === 'success' && Array.isArray(data.items)) {
        if (data.items.length === 0) {
          setSyncStatus({ status: 'info', message: 'Google Sheets hiện chưa có dữ liệu đơn photo nào.' });
        } else {
          const loadedItems = data.items.map(item => ({
            ...item,
            status: item.status || (item.isPaid ? 'DA_THANH_TOAN' : 'CHO_TAI_LIEU'),
            isSynced: true
          }));
          setBillingItems(loadedItems);
          setSyncStatus({ 
            status: 'success', 
            message: `Đã tải thành công ${data.items.length} mục đơn photo từ Google Sheets trên Drive!` 
          });
        }
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

        addBillingItem,
        addBatchClassesForTeacher,
        updateBillingItem,
        removeBillingItem,
        clearBillingGrid,
        resetAllDataToEmpty,
        addCashflowRecord,
        removeCashflowRecord,
        syncToGoogleSheets,
        fetchFromGoogleSheets,
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
