import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
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
          return parsed
            .filter(item => item.week !== 'Tuần 10') // Tự động loại bỏ hoàn toàn dòng rác Tuần 10 thử nghiệm
            .map(item => {
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
  const [isDebtsSynced, setIsDebtsSynced] = useState(true);
  const [isCashflowSynced, setIsCashflowSynced] = useState(true);
  const [focusedItemId, setFocusedItemId] = useState(null); // ID dòng cần focus con trỏ chuột khi vừa nạp giáo viên / lớp

  // Weekly Billing & Debt Tracking State
  const [availableWeeks, setAvailableWeeks] = useState(() => {
    const saved = localStorage.getItem('photo_available_weeks_v3');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return ['Tuần 1', 'Tuần 2', 'Tuần 3', 'Tuần 4', 'Tuần 5', 'Tuần 6'];
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

  // Quản lý tiền nợ / thiếu theo từng tuần: { [week]: { [className]: { amount, note, updatedAt } } }
  const [weeklyDebts, setWeeklyDebts] = useState(() => {
    const saved = localStorage.getItem('photo_weekly_debts_v2');
    if (saved) {
      try {
        return JSON.parse(saved) || {};
      } catch (e) {}
    }
    // Backward compatibility from photo_class_debts
    const oldDebts = localStorage.getItem('photo_class_debts');
    if (oldDebts) {
      try {
        const parsed = JSON.parse(oldDebts);
        if (parsed && typeof parsed === 'object') {
          const initWeek = localStorage.getItem('photo_current_week') || 'Tuần 1';
          return { [initWeek]: parsed };
        }
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
      note: record.note || ''
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

  // 1. Sync Đơn Photo lên Google Sheets (kèm công nợ tuần)
  const syncToGoogleSheets = async (isAutoSync = false) => {
    const currentWeekItems = billingItems.filter(item => (item.week || currentWeek) === currentWeek);

    // Nếu bảng photo trống nhưng có công nợ -> chuyển sang lưu công nợ
    if (currentWeekItems.length === 0) {
      if (Object.keys(classDebts).length > 0) {
        return await syncDebtsToGoogleSheets(currentWeek, isAutoSync);
      }
      if (!isAutoSync) {
        alert(`Bảng tính và danh sách công nợ của ${currentWeek} hiện đang trống, chưa có dữ liệu để lưu vào Google Sheets.`);
      }
      return;
    }

    const targetUrl = settings.gasWebAppUrl || DEFAULT_SETTINGS.gasWebAppUrl;
    if (!targetUrl || !targetUrl.startsWith('http')) {
      if (!isAutoSync) {
        alert('Chưa có URL Google Apps Script. Vui lòng cấu hình trong Tab 2: Dashboard Admin & CSDL.');
      }
      return;
    }

    setSyncStatus({ 
      status: 'syncing', 
      message: isAutoSync
        ? `Đang tự động lưu ${currentWeekItems.length} đơn photo (${currentWeek}) lên Google Sheets...`
        : `Đang đồng bộ ${currentWeekItems.length} đơn photo & công nợ (${currentWeek}) lên Google Sheets...` 
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

      setSyncStatus({ 
        status: 'success', 
        message: isAutoSync
          ? `Đã tự động lưu thành công ${currentWeekItems.length} đơn photo (${currentWeek}) lên Google Sheets!`
          : `Đã lưu & đồng bộ chuẩn xác ${currentWeekItems.length} mục đơn photo của ${currentWeek} lên Google Sheets!` 
      });
    } catch (err) {
      console.error(err);
      if (!isAutoSync) {
        setSyncStatus({
          status: 'error',
          message: 'Lỗi kết nối khi gửi lên Google Drive. Vui lòng kiểm tra lại đường truyền mạng.'
        });
      }
    }

    setTimeout(() => {
      setSyncStatus({ status: 'idle', message: '' });
    }, 3500);
  };

  // 2. Sync riêng Công Nợ các lớp theo tuần lên Google Sheets (Tab: CongNo_TheoTuan)
  const syncDebtsToGoogleSheets = async (targetWeek = currentWeek, isAutoSync = false) => {
    const targetDebts = weeklyDebts[targetWeek] || {};
    const targetWeekItems = billingItems.filter(item => (item.week || targetWeek) === targetWeek);

    const targetUrl = settings.gasWebAppUrl || DEFAULT_SETTINGS.gasWebAppUrl;
    if (!targetUrl || !targetUrl.startsWith('http')) {
      if (!isAutoSync) {
        alert('Chưa có URL Google Apps Script. Vui lòng cấu hình trong Tab 2: Dashboard Admin & CSDL.');
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
    const recordsToSync = customRecords || cashflow;
    const targetUrl = settings.gasWebAppUrl || DEFAULT_SETTINGS.gasWebAppUrl;
    if (!targetUrl || !targetUrl.startsWith('http')) {
      if (!isAutoSync) {
        alert('Chưa có URL Google Apps Script. Vui lòng cấu hình trong Tab 2: Dashboard Admin & CSDL.');
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
