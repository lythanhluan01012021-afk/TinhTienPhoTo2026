import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Users, 
  Filter, 
  Search, 
  Plus, 
  BookOpen, 
  GraduationCap, 
  CheckCircle2, 
  ChevronRight,
  PlusCircle,
  X,
  Sparkles
} from 'lucide-react';
import { fuzzyVietnameseMatch, removeVietnameseTones, matchTeacherGivenName } from '../../utils/vietnameseUtils';

export const TeacherFilterPanel = () => {
  const { 
    departments, 
    teachers, 
    assignments, 
    classes,
    billingItems,
    setBillingItems,
    selectedDept, 
    setSelectedDept, 
    selectedTeacher, 
    setSelectedTeacher,
    addBillingItem,
    addBatchClassesForTeacher,
    getStudentCountForClass,
    setCurrentTab,
    currentWeek
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [addedAnimationClass, setAddedAnimationClass] = useState(null);

  // Thống kê số lượng GV theo từng tổ
  const deptCounts = useMemo(() => {
    const counts = {};
    teachers.forEach(t => {
      const d = t.dept || 'Chưa phân tổ';
      counts[d] = (counts[d] || 0) + 1;
    });
    return counts;
  }, [teachers]);

  // Bộ lọc thông minh: Lọc theo Tổ và Tìm kiếm không dấu
  const filteredTeachers = useMemo(() => {
    const cleanSearch = searchTerm.trim();

    return teachers.filter(t => {
      // 1. Lọc theo Tổ chuyên môn
      const matchDept = selectedDept === 'Tất cả các tổ' || t.dept === selectedDept;

      // Nếu không nhập từ khóa tìm kiếm: áp dụng Lọc Tổ
      if (!cleanSearch) {
        return matchDept;
      }

      // 2. Tìm kiếm giáo viên chuẩn xác theo TÊN (bỏ qua Họ và Họ lót)
      const nameMatch = matchTeacherGivenName(t.name, cleanSearch);
      const deptMatch = fuzzyVietnameseMatch(t.dept, cleanSearch);
      
      const teacherAsgs = assignments.filter(a => a.teacherName.toLowerCase().trim() === t.name.toLowerCase().trim());
      const classOrSubjectMatch = teacherAsgs.some(a => 
        fuzzyVietnameseMatch(a.className, cleanSearch) || 
        fuzzyVietnameseMatch(a.subject, cleanSearch)
      );

      const matchesSearch = nameMatch || deptMatch || classOrSubjectMatch;

      return matchesSearch && (selectedDept === 'Tất cả các tổ' || matchDept);
    }).sort((a, b) => {
      const nameA = removeVietnameseTones(a.name).split(/\s+/).pop() || '';
      const nameB = removeVietnameseTones(b.name).split(/\s+/).pop() || '';
      return nameA.localeCompare(nameB, 'vi');
    });
  }, [teachers, assignments, selectedDept, searchTerm]);

  // Nếu 'Chưa phân tổ' trống (0 GV), tự động chuyển về 'Tất cả các tổ'
  useEffect(() => {
    if (selectedDept === 'Chưa phân tổ' && (!deptCounts['Chưa phân tổ'] || deptCounts['Chưa phân tổ'] === 0)) {
      setSelectedDept('Tất cả các tổ');
    }
  }, [selectedDept, deptCounts, setSelectedDept]);

  // Tự động chọn GV đầu tiên khi bộ lọc thay đổi để hiển thị ngay các lớp
  useEffect(() => {
    if (filteredTeachers.length > 0) {
      const isCurrentStillInList = selectedTeacher && filteredTeachers.some(t => t.id === selectedTeacher.id);
      if (!isCurrentStillInList) {
        setSelectedTeacher(filteredTeachers[0]);
      }
    } else {
      setSelectedTeacher(null);
    }
  }, [filteredTeachers, selectedTeacher, setSelectedTeacher]);

  // Danh sách các lớp được phân công cho GV đang chọn
  const teacherAssignments = useMemo(() => {
    if (!selectedTeacher) return [];
    const cleanName = removeVietnameseTones(selectedTeacher.name);
    return assignments.filter(asg => {
      if (selectedTeacher.id && asg.teacherId && asg.teacherId === selectedTeacher.id) return true;
      return removeVietnameseTones(asg.teacherName) === cleanName;
    });
  }, [selectedTeacher, assignments]);

  // Đếm số lần lớp này của GV đã được thêm vào bảng tính trong tuần hiện tại
  const getClassAddedCount = (asg) => {
    if (!selectedTeacher) return 0;
    const cleanTeacherName = removeVietnameseTones(selectedTeacher.name);
    const cleanClass = removeVietnameseTones(asg.className);
    const cleanSubject = removeVietnameseTones(asg.subject);

    return billingItems.filter(item => {
      if ((item.week || currentWeek) !== currentWeek) return false;
      const matchTeacher = removeVietnameseTones(item.teacherName) === cleanTeacherName;
      const matchClass = removeVietnameseTones(item.className) === cleanClass;
      const matchSubject = !asg.subject || removeVietnameseTones(item.subject).includes(cleanSubject) || cleanSubject.includes(removeVietnameseTones(item.subject));
      return matchTeacher && matchClass && matchSubject;
    }).length;
  };

  // Tổng số dòng photo của GV này trong bảng tính tuần hiện tại
  const teacherTotalCountInGrid = useMemo(() => {
    if (!selectedTeacher) return 0;
    const cleanTeacherName = removeVietnameseTones(selectedTeacher.name);
    return billingItems.filter(item => {
      if ((item.week || currentWeek) !== currentWeek) return false;
      return removeVietnameseTones(item.teacherName) === cleanTeacherName;
    }).length;
  }, [selectedTeacher, billingItems, currentWeek]);

  // Thêm 1 đợt photo mới cho lớp (Luôn thêm mới vào bảng, không xóa dữ liệu trước đó)
  const handleAddClass = (asg) => {
    if (!selectedTeacher) return;
    const studentCount = getStudentCountForClass(asg.className);
    addBillingItem({
      teacherName: selectedTeacher.name,
      className: asg.className,
      subject: asg.subject || 'Đề cương / Kiểm tra',
      studentCount: studentCount,
      extraCount: 0,
      note: 'In theo lớp'
    });

    setAddedAnimationClass(asg.className);
    setTimeout(() => setAddedAnimationClass(null), 1200);
  };

  // Thêm đợt photo mới cho tất cả các lớp của GV (Luôn thêm mới vào bảng)
  const handleAddAllClasses = () => {
    if (!selectedTeacher || teacherAssignments.length === 0) return;
    addBatchClassesForTeacher(selectedTeacher, teacherAssignments);
  };

  return (
    <div className="neu-card" style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '2px solid #d8e2ef', paddingBottom: '12px' }}>
        <div 
          className="neu-card-sm" 
          style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}
        >
          <Filter size={18} />
        </div>
        <div>
          <h2 style={{ fontSize: '17px', fontWeight: 'bold', color: 'var(--text-bold)' }}>
            CHỌN GIÁO VIÊN & LỚP
          </h2>
          <p style={{ fontSize: '12.5px', color: 'var(--text-sub)' }}>
            Lọc theo tổ & nạp nhanh các lớp giảng dạy
          </p>
        </div>
      </div>

      {/* 1. Lọc theo Tổ chuyên môn */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
          <label style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text-main)' }}>
            1. Chọn Tổ Chuyên Môn:
          </label>
          <span style={{ fontSize: '12px', color: 'var(--color-primary)', fontWeight: 'bold' }}>
            {selectedDept === 'Tất cả các tổ' ? `${teachers.length} GV` : `${deptCounts[selectedDept] || 0} GV`}
          </span>
        </div>
        <select 
          className="neu-select"
          value={selectedDept}
          onChange={(e) => {
            setSelectedDept(e.target.value);
          }}
          style={{ cursor: 'pointer', fontWeight: '600', fontSize: '13.5px' }}
        >
          {departments.map((dept, idx) => {
            const count = dept === 'Tất cả các tổ' ? teachers.length : (deptCounts[dept] || 0);
            return (
              <option key={idx} value={dept}>
                {dept} ({count} GV)
              </option>
            );
          })}
        </select>
      </div>

      {/* 2. Ô tìm kiếm thông minh không dấu */}
      <div>
        <label style={{ display: 'block', fontSize: '13.5px', fontWeight: '700', marginBottom: '5px', color: 'var(--text-main)' }}>
          2. Tìm Kiếm Nhanh:
        </label>
        <div style={{ position: 'relative' }}>
          <input 
            type="text" 
            className="neu-input"
            placeholder="Gõ tên GV (Thoa, Minh...), tổ, lớp, môn..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '34px', paddingRight: searchTerm ? '32px' : '10px', fontSize: '13px' }}
          />
          <Search 
            size={15} 
            style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} 
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
              title="Xóa tìm kiếm"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* 3. Danh sách Giáo viên */}
      <div style={{ flex: '1', minHeight: '140px', maxHeight: '230px', overflowY: 'auto', paddingRight: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>
            Danh sách Giáo viên ({filteredTeachers.length}):
          </label>
          {(searchTerm || selectedDept !== 'Tất cả các tổ') && (
            <button 
              onClick={() => {
                setSearchTerm('');
                setSelectedDept('Tất cả các tổ');
              }}
              style={{ fontSize: '11.5px', color: 'var(--color-primary)', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Đặt lại bộ lọc
            </button>
          )}
        </div>
        
        {teachers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '14px 8px', background: '#f4f8fc', borderRadius: '10px', border: '1px dashed #cad7e8' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-sub)', marginBottom: '8px' }}>
              Chưa có dữ liệu giáo viên.
            </p>
            <button
              onClick={() => setCurrentTab('admin')}
              className="neu-btn neu-btn-primary"
              style={{ fontSize: '12px', padding: '5px 12px' }}
            >
              👉 Vào Admin Nạp Excel
            </button>
          </div>
        ) : filteredTeachers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '14px 8px', background: '#fcf6f4', borderRadius: '10px', border: '1px dashed #e8d0cb' }}>
            <p style={{ fontSize: '12.5px', color: 'var(--color-danger)', marginBottom: '6px' }}>
              Không tìm thấy GV với từ khóa "{searchTerm}".
            </p>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedDept('Tất cả các tổ');
                setSelectedClassFilter('ALL');
              }}
              className="neu-btn"
              style={{ fontSize: '11.5px', padding: '4px 10px' }}
            >
              Xem tất cả giáo viên
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {filteredTeachers.map(teacher => {
              const isSelected = selectedTeacher?.id === teacher.id || selectedTeacher?.name === teacher.name;
              return (
                <div 
                  key={teacher.id || teacher.name}
                  onClick={() => setSelectedTeacher(teacher)}
                  data-dept={teacher.dept}
                  className={`teacher-list-card ${isSelected ? 'active-teacher' : ''}`}
                  style={{
                    padding: '8px 10px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.6)',
                    background: isSelected ? 'linear-gradient(135deg, #dbe8f7, #ebf3fd)' : 'var(--bg-card)',
                    boxShadow: isSelected ? 'var(--shadow-inset-sm)' : 'var(--shadow-sm)',
                    borderLeft: isSelected ? '4px solid var(--color-primary)' : '1px solid rgba(255,255,255,0.6)',
                    transition: 'all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: isSelected ? 'var(--color-primary)' : 'var(--text-bold)' }}>
                      {teacher.name}
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                      {teacher.dept}
                    </div>
                  </div>
                  <ChevronRight size={15} color={isSelected ? 'var(--color-primary)' : 'var(--text-muted)'} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Danh sách Lớp giảng dạy của GV được chọn */}
      <div 
        className="neu-card-sm"
        style={{ 
          padding: '12px', 
          background: '#f2f6fb',
          borderRadius: '12px',
          border: '1px solid #d2deed'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <GraduationCap size={16} color="var(--color-primary)" />
            <span style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text-bold)' }}>
              Lớp Phân Công Giảng Dạy:
            </span>
          </div>
          {selectedTeacher && (
            <span style={{ fontSize: '12.5px', color: 'var(--color-primary)', fontWeight: 'bold' }}>
              {selectedTeacher.name}
            </span>
          )}
        </div>

        {!selectedTeacher ? (
          <p style={{ fontSize: '12.5px', fontStyle: 'italic', color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0' }}>
            👈 Chọn giáo viên ở trên để xem các lớp đang dạy.
          </p>
        ) : teacherAssignments.length === 0 ? (
          <p style={{ fontSize: '12.5px', color: 'var(--color-warning)', textAlign: 'center', padding: '8px 0' }}>
            Chưa có phân công lớp cho GV này. Vào trang Admin để bổ sung.
          </p>
        ) : (
          <div>
            <p style={{ fontSize: '12px', color: 'var(--text-sub)', marginBottom: '8px' }}>
              Bấm vào lớp để thêm đợt photo vào bảng tính bên phải:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '160px', overflowY: 'auto', marginBottom: '12px', paddingRight: '2px' }}>
              {teacherAssignments.map((asg, idx) => {
                const studentCount = getStudentCountForClass(asg.className);
                const count = getClassAddedCount(asg);
                const isJustAdded = addedAnimationClass === asg.className;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAddClass(asg)}
                    className="neu-chip"
                    title={count > 0 ? `Lớp ${asg.className} đã có ${count} dòng trong bảng tính. Bấm để nhập thêm đợt photo mới!` : `Bấm để thêm lớp ${asg.className} vào bảng tính`}
                    style={{
                      background: count > 0 
                        ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' 
                        : 'var(--bg-card)',
                      color: count > 0 ? '#14532d' : 'var(--text-bold)',
                      border: count > 0 ? '1.5px solid #86efac' : '1px solid #b7cae2',
                      padding: '6px 12px',
                      fontSize: '12.5px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      borderRadius: '20px',
                      boxShadow: count > 0 
                        ? '0 2px 6px rgba(22, 101, 52, 0.18)' 
                        : 'var(--shadow-sm)',
                      fontWeight: '600',
                      transition: 'all 0.18s ease',
                      transform: isJustAdded ? 'scale(1.06)' : 'none'
                    }}
                  >
                    <Plus size={14} color={count > 0 ? '#16a34a' : 'var(--color-primary)'} />

                    <b style={{ fontSize: '13px' }}>{asg.className}</b>

                    <span style={{ 
                      fontSize: '11px', 
                      background: count > 0 ? 'rgba(22, 163, 74, 0.18)' : 'rgba(27,94,190,0.1)', 
                      color: count > 0 ? '#15803d' : 'var(--color-primary)', 
                      padding: '2px 6px', 
                      borderRadius: '4px',
                      fontWeight: '600'
                    }}>
                      {asg.subject}
                    </span>

                    <span style={{ fontSize: '11px', color: count > 0 ? '#166534' : 'var(--text-muted)' }}>
                      ({studentCount} hs)
                    </span>

                    {count > 0 && (
                      <span style={{ 
                        fontSize: '10px', 
                        background: '#16a34a', 
                        color: '#ffffff', 
                        padding: '1px 7px', 
                        borderRadius: '10px',
                        fontWeight: 'bold',
                        letterSpacing: '0.2px'
                      }}>
                        Đã có {count} lần • ➕ Thêm tiếp
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Batch Add Button - Luôn thêm mới, không bao giờ xóa dữ liệu */}
            <button
              type="button"
              onClick={handleAddAllClasses}
              className="neu-btn neu-btn-primary"
              style={{ 
                width: '100%', 
                fontSize: '13.5px', 
                padding: '9px 12px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              title="Bấm để nạp thêm các lớp vào bảng tính (luôn cộng thêm, không xóa dòng cũ)"
            >
              <PlusCircle size={16} />
              <span>
                {teacherTotalCountInGrid > 0 
                  ? `⊕ Nhập Thêm Đợt Mới Cho Cả ${teacherAssignments.length} Lớp Của ${selectedTeacher.name}`
                  : `⊕ Thêm Tất Cả ${teacherAssignments.length} Lớp Của ${selectedTeacher.name}`}
              </span>
            </button>
            <p style={{ fontSize: '11.5px', color: '#047857', marginTop: '6px', textAlign: 'center', fontStyle: 'italic' }}>
              💡 Mẹo: Bấm vào lớp để thêm các đợt photo mới (không làm mất dữ liệu đã nhập trước đó).
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
