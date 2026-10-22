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
    setCurrentTab
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

  // Kiểm tra xem phân công lớp của GV này đã có trong bảng tính Excel hay chưa
  const isClassAdded = (asg) => {
    if (!selectedTeacher) return false;
    const cleanTeacherName = removeVietnameseTones(selectedTeacher.name);
    const cleanClass = removeVietnameseTones(asg.className);
    const cleanSubject = removeVietnameseTones(asg.subject);

    return billingItems.some(item => {
      const matchTeacher = removeVietnameseTones(item.teacherName) === cleanTeacherName;
      const matchClass = removeVietnameseTones(item.className) === cleanClass;
      const matchSubject = !asg.subject || removeVietnameseTones(item.subject).includes(cleanSubject) || cleanSubject.includes(removeVietnameseTones(item.subject));
      return matchTeacher && matchClass && matchSubject;
    });
  };

  // Kiểm tra xem tất cả các lớp của GV này đã được thêm vào bảng tính chưa
  const areAllClassesAdded = useMemo(() => {
    if (!selectedTeacher || teacherAssignments.length === 0) return false;
    return teacherAssignments.every(asg => isClassAdded(asg));
  }, [selectedTeacher, teacherAssignments, billingItems]);

  // Bật/tắt chọn 1 lớp (thêm hoặc xóa khỏi bảng tính)
  const handleToggleClass = (asg) => {
    if (!selectedTeacher) return;
    const added = isClassAdded(asg);

    if (added) {
      // Đã có -> Bỏ chọn (xóa khỏi bảng tính)
      const cleanTeacherName = removeVietnameseTones(selectedTeacher.name);
      const cleanClass = removeVietnameseTones(asg.className);
      const cleanSubject = removeVietnameseTones(asg.subject);

      setBillingItems(prev => prev.filter(item => {
        const matchTeacher = removeVietnameseTones(item.teacherName) === cleanTeacherName;
        const matchClass = removeVietnameseTones(item.className) === cleanClass;
        const matchSubject = !asg.subject || removeVietnameseTones(item.subject).includes(cleanSubject) || cleanSubject.includes(removeVietnameseTones(item.subject));
        return !(matchTeacher && matchClass && matchSubject);
      }));
    } else {
      // Chưa có -> Thêm vào bảng tính
      const studentCount = getStudentCountForClass(asg.className);
      addBillingItem({
        teacherName: selectedTeacher.name,
        className: asg.className,
        subject: asg.subject || 'Đề cương / Kiểm tra',
        studentCount: studentCount,
        extraCount: 0, // Mặc định số lượng lẻ là 0 theo yêu cầu
        note: 'In theo lớp'
      });
    }
  };

  // Bật/tắt tất cả các lớp của GV
  const handleToggleAllClasses = () => {
    if (!selectedTeacher || teacherAssignments.length === 0) return;

    if (areAllClassesAdded) {
      // Đang chọn hết -> Bỏ chọn tất cả lớp của GV này
      const cleanTeacherName = removeVietnameseTones(selectedTeacher.name);
      const classNames = new Set(teacherAssignments.map(a => removeVietnameseTones(a.className)));

      setBillingItems(prev => prev.filter(item => {
        const matchTeacher = removeVietnameseTones(item.teacherName) === cleanTeacherName;
        const matchClass = classNames.has(removeVietnameseTones(item.className));
        return !(matchTeacher && matchClass);
      }));
    } else {
      // Thêm những lớp chưa có vào bảng tính
      const unaddedAssignments = teacherAssignments.filter(asg => !isClassAdded(asg));
      addBatchClassesForTeacher(selectedTeacher, unaddedAssignments);
    }
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
              Bấm vào lớp để thêm vào bảng tính bên phải:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '140px', overflowY: 'auto', marginBottom: '12px', paddingRight: '2px' }}>
              {teacherAssignments.map((asg, idx) => {
                const studentCount = getStudentCountForClass(asg.className);
                const isAdded = isClassAdded(asg);

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleToggleClass(asg)}
                    className="neu-chip"
                    title={isAdded ? `Đã thêm vào bảng tính (Bấm để bỏ chọn)` : `Bấm để thêm lớp ${asg.className} vào bảng tính`}
                    style={{
                      background: isAdded 
                        ? 'linear-gradient(135deg, #1B5EBE 0%, #104289 100%)' 
                        : 'var(--bg-card)',
                      color: isAdded ? '#ffffff' : 'var(--text-bold)',
                      border: isAdded ? '1.5px solid #0d346c' : '1px solid #b7cae2',
                      padding: '6px 12px',
                      fontSize: '12.5px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      borderRadius: '20px',
                      boxShadow: isAdded 
                        ? '0 3px 10px rgba(27, 94, 190, 0.45), inset 0 1px 1px rgba(255, 255, 255, 0.35)' 
                        : 'var(--shadow-sm)',
                      fontWeight: isAdded ? '700' : '600',
                      transition: 'all 0.18s ease'
                    }}
                  >
                    {isAdded ? (
                      <CheckCircle2 size={15} color="#ffffff" />
                    ) : (
                      <Plus size={14} color="var(--color-primary)" />
                    )}

                    <b style={{ fontSize: '13px' }}>{asg.className}</b>

                    <span style={{ 
                      fontSize: '11px', 
                      background: isAdded ? 'rgba(255,255,255,0.25)' : 'rgba(27,94,190,0.1)', 
                      color: isAdded ? '#ffffff' : 'var(--color-primary)', 
                      padding: '2px 6px', 
                      borderRadius: '4px',
                      fontWeight: '600'
                    }}>
                      {asg.subject}
                    </span>

                    <span style={{ fontSize: '11px', color: isAdded ? '#d0e3fc' : 'var(--text-muted)' }}>
                      ({studentCount} hs)
                    </span>

                    {isAdded && (
                      <span style={{ 
                        fontSize: '10px', 
                        background: '#10B981', 
                        color: '#ffffff', 
                        padding: '1px 6px', 
                        borderRadius: '10px',
                        fontWeight: 'bold',
                        letterSpacing: '0.3px'
                      }}>
                        ✓ Đã chọn
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Batch Add Button */}
            <button
              type="button"
              onClick={handleToggleAllClasses}
              className={`neu-btn ${areAllClassesAdded ? 'neu-btn-success' : 'neu-btn-primary'}`}
              style={{ 
                width: '100%', 
                fontSize: '13.5px', 
                padding: '9px 12px',
                background: areAllClassesAdded ? 'linear-gradient(135deg, #059669 0%, #047857 100%)' : undefined,
                color: areAllClassesAdded ? '#ffffff' : undefined,
                boxShadow: areAllClassesAdded ? '0 3px 10px rgba(5, 150, 105, 0.4)' : undefined
              }}
            >
              {areAllClassesAdded ? (
                <>
                  <CheckCircle2 size={16} />
                  <span>✓ Đã Chọn Tất Cả {teacherAssignments.length} Lớp (Bấm Để Bỏ Chọn Hết)</span>
                </>
              ) : (
                <>
                  <PlusCircle size={16} />
                  <span>Thêm Tất Cả {teacherAssignments.length} Lớp Của {selectedTeacher.name}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
