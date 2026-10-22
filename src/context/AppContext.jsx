import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
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

  // Tự động xóa sạch mock data (các đơn photo mẫu và tiền nợ thử nghiệm) để bắt đầu dữ liệu thực tế
  if (typeof window !== 'undefined' && localStorage.getItem('photo_clean_mock_v4') !== 'true') {
    localStorage.removeItem('photo_billing_items');
    localStorage.removeItem('photo_class_debts');
    localStorage.removeItem('photo_class_payments');
    localStorage.setItem('photo_clean_mock_v4', 'true');
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

  // Weekly Billing & Debt Tracking State
  const [availableWeeks, setAvailableWeeks] = useState(() => {
    const saved = localStorage.getItem('photo_available_weeks');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return ['Tuần 1', 'Tuần 2', 'Tuần 3', 'Tuần 4', 'Tuần 5', 'Tuần 6', 'Tuần 7', 'Tuần 8', 'Tuần 9', 'Tuần 10'];
  });

  const [currentWeek, setCurrentWeek] = useState(() => {
    return localStorage.getItem('photo_current_week') || 'Tuần 1';
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

  // Simple Class Debts: Quản lý trực tiếp tiền nợ / thiếu của từng lớp
  // Format: { [className]: { amount: number, note: string, updatedAt: string } }
  const [classDebts, setClassDebts] = useState(() => {
    const saved = localStorage.getItem('photo_class_debts');
    if (saved) {
      try {
        return JSON.parse(saved) || {};
      } catch (e) {}
    }
    return {};
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
    localStorage.setItem('photo_available_weeks', JSON.stringify(availableWeeks));
  }, [availableWeeks]);

  useEffect(() => {
    localStorage.setItem('photo_current_week', currentWeek);
  }, [currentWeek]);

  useEffect(() => {
    localStorage.setItem('photo_class_payments', JSON.stringify(classPayments));
  }, [classPayments]);

  useEffect(() => {
    localStorage.setItem('photo_class_debts', JSON.stringify(classDebts));
  }, [classDebts]);

  // Cập nhật số tiền thiếu / nợ của 1 lớp
  const updateClassDebt = (className, amount, note = '') => {
    if (!className) return;
    setClassDebts(prev => {
      const numAmount = Math.max(0, Number(amount) || 0);
      if (numAmount === 0 && !note) {
        const next = { ...prev };
        delete next[className];
        return next;
      }
      return {
        ...prev,
        [className]: {
          amount: numAmount,
          note: note !== undefined ? note : (prev[className]?.note || ''),
          updatedAt: new Date().toLocaleDateString('vi-VN')
        }
      };
    });
  };

  // Xóa nợ của 1 lớp
  const removeClassDebt = (className) => {
    if (!className) return;
    setClassDebts(prev => {
      const next = { ...prev };
      delete next[className];
      return next;
    });
  };

  // Xóa toàn bộ nợ
  const clearAllClassDebts = () => {
    setClassDebts({});
  };

  // Lấy số tiền nợ của 1 lớp
  const getClassDebt = (className) => {
    if (!className) return 0;
    return Number(classDebts[className]?.amount) || 0;
  };

  // Lấy ghi chú nợ của 1 lớp
  const getClassDebtNote = (className) => {
    if (!className) return '';
    return classDebts[className]?.note || '';
  };

  // Tổng nợ tất cả các lớp
  const totalClassDebts = useMemo(() => {
    return Object.values(classDebts).reduce((sum, d) => sum + (Number(d?.amount) || 0), 0);
  }, [classDebts]);

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
    const studentCount = Math.max(0, Number(item.studentCount ?? getStudentCountForClass(item.className)) || 0);
    const extraCount = Math.max(0, Number(item.extraCount ?? 0) || 0);
    const unitPrice = Math.max(0, Number(item.unitPrice ?? settings.defaultUnitPrice) || settings.defaultUnitPrice);
    const amount = (studentCount + extraCount) * unitPrice;

    const newItem = {
      id: item.id || `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      week: item.week || currentWeek || 'Tuần 1',
      teacherName: item.teacherName || '',
      className: item.className || '',
      subject: item.subject || 'Tài liệu photo',
      studentCount: studentCount,
      extraCount: extraCount,
      unitPrice: unitPrice,
      amount: amount,
      status: item.status || 'CHO_TAI_LIEU',
      isPaid: item.status === 'DA_THANH_TOAN' || item.isPaid || false,
      note: item.note || '',
      isSynced: false
    };

    setBillingItems(prev => [...prev, newItem]);
  };

  // Helper: Thêm 1 dòng trống mới vào bảng tính
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
    if (currentTab !== 'billing') {
      setCurrentTab('billing');
    }
  };

  // Helper: Xuất dữ liệu bảng tính ra file Excel (.xlsx)
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

  // Thêm tuần mới vào danh sách tuần
  const addWeek = (newWeekName) => {
    if (!newWeekName || !newWeekName.trim()) return;
    const clean = newWeekName.trim();
    if (!availableWeeks.includes(clean)) {
      setAvailableWeeks(prev => [...prev, clean]);
    }
    setCurrentWeek(clean);
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
    
    const newItems = classAssignments.map(asg => {
      const studentCount = getStudentCountForClass(asg.className);
      const extraCount = 0; // Mặc định số lượng lẻ là 0 theo yêu cầu
      const unitPrice = settings.defaultUnitPrice;
      return {
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
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

  // Clear entire billing grid and debts (với cơ chế bảo vệ doanh thu)
  const clearBillingGrid = () => {
    if (billingItems.length > 0 && billingItems.some(i => !i.isSynced)) {
      if (!window.confirm('CẢNH BÁO BẢO VỆ DOANH THU: Bảng tính đang có dòng photo chưa được "Lưu CSDL"! Nếu làm mới lúc này, bạn sẽ bị mất thông tin tính tiền. Bạn có chắc chắn muốn xóa bảng tính và công nợ để bắt đầu phiên mới không?')) {
        return;
      }
    } else if (!window.confirm('Bạn có chắc chắn muốn làm mới (xóa toàn bộ bảng tính và công nợ) để bắt đầu tuần mới?')) {
      return;
    }
    setBillingItems([]);
    setClassDebts({});
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

    setSyncStatus({ status: 'syncing', message: 'Đang đồng bộ đơn photo & công nợ tuần lên Google Sheets...' });
    
    try {
      // Chuẩn bị dữ liệu công nợ các lớp
      const classDebtsList = Object.entries(classDebts).filter(([_, d]) => (d?.amount || 0) > 0).map(([cls, d]) => ({
        className: cls,
        homeroomTeacher: getHomeroomTeacher(cls),
        debtAmount: Number(d?.amount) || 0,
        note: d?.note || '',
        updatedAt: d?.updatedAt || new Date().toLocaleDateString('vi-VN')
      }));

      const payload = {
        action: 'saveBillingData',
        folderId: settings.driveFolderId || DEFAULT_SETTINGS.driveFolderId,
        items: billingItems.map(item => ({
          ...item,
          statusLabel: ORDER_STATUSES[item.status]?.label || (item.isPaid ? 'Đã thanh toán' : 'Chờ gửi tài liệu')
        })),
        classDebts: classDebtsList,
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
        message: `Đã lưu & đồng bộ thành công ${billingItems.length} mục đơn photo và công nợ các lớp lên Google Sheets!` 
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
    // Bảo vệ an toàn chống ghi đè dữ liệu chưa lưu
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

    setSyncStatus({ status: 'syncing', message: 'Đang tải dữ liệu từ Google Sheets trên Drive về...' });

    try {
      const fetchUrl = targetUrl + (targetUrl.includes('?') ? '&' : '?') + 'action=fetchBillingData';
      const res = await fetch(fetchUrl);
      const data = await res.json();

      if (data && data.status === 'success' && Array.isArray(data.items)) {
        if (data.spreadsheetUrl && (!settings.sheetUrl || settings.sheetUrl !== data.spreadsheetUrl)) {
          setSettings(prev => ({ ...prev, sheetUrl: data.spreadsheetUrl }));
        }

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
        updateClassDebt,
        removeClassDebt,
        clearAllClassDebts,
        getClassDebt,
        getClassDebtNote,
        totalClassDebts,

        addBillingItem,
        handleAddBlankRow,
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
