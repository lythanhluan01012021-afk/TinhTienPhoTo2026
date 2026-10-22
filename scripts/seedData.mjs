import XLSX from 'xlsx';
import fs from 'fs';

function findColumnValue(row, candidates) {
  for (const key of Object.keys(row)) {
    const cleanKey = key.trim().toLowerCase();
    for (const cand of candidates) {
      if (cleanKey === cand.toLowerCase() || cleanKey.includes(cand.toLowerCase())) {
        return String(row[key] !== undefined ? row[key] : '').trim();
      }
    }
  }
  return '';
}

function inferDepartment(teacherName, subjects = []) {
  const clean = teacherName.toLowerCase().trim();
  if (clean.includes('thoa')) return 'Tổ Ngoại Ngữ';
  if (clean.includes('đăng') || clean.includes('tuyến')) return 'Tổ Sinh - CNNN';
  const tin = ['hồ minh kiện', 'lý thành luân', 'nguyễn thị ngân', 'văn công sang'];
  if (tin.some(t => clean.includes(t))) return 'Tổ Tin Học';
  
  const text = subjects.join(' ').toLowerCase();
  if (text.includes('toán') || text.includes('toan')) return 'Tổ Toán';
  if (text.includes('tin học') || text.includes('tin')) return 'Tổ Tin Học';
  if (text.includes('vật lí') || text.includes('vật lý') || (text.includes('công nghệ') && (clean.includes('lâm') || clean.includes('lành') || clean.includes('trung')))) return 'Tổ Lý - CNCN';
  if (text.includes('sinh') || text.includes('nông nghiệp')) return 'Tổ Sinh - CNNN';
  if (text.includes('văn') || text.includes('ngữ văn')) return 'Tổ Ngữ Văn';
  if (text.includes('ngoại ngữ') || text.includes('tiếng anh')) return 'Tổ Ngoại Ngữ';
  if (text.includes('hóa') || text.includes('hoá')) return 'Tổ Hóa Học';
  if (text.includes('lịch sử') || text.includes('sử')) return 'Tổ Lịch Sử';
  if (text.includes('địa lí') || text.includes('địa lý') || text.includes('địa')) return 'Tổ Địa Lí';
  if (text.includes('kinh tế') || text.includes('pháp luật') || text.includes('gdkt')) return 'Tổ GDKT & Pháp Luật';
  if (text.includes('quốc phòng') || text.includes('gdqp') || text.includes('thể chất') || text.includes('thể dục')) return 'Tổ GDQP - Thể Chất';
  return 'Chưa phân tổ';
}

// 1. Classes
const wbClass = XLSX.readFile('lop_hoc.xls');
const rawClasses = XLSX.utils.sheet_to_json(wbClass.Sheets[wbClass.SheetNames[0]]);
const classes = rawClasses.map(row => {
  const className = findColumnValue(row, ['tên lớp', 'lớp', 'class', 'classname']);
  const studentCount = Number(findColumnValue(row, ['sỹ số', 'sĩ số', 'học sinh', 'siso'])) || 40;
  const homeroomTeacher = findColumnValue(row, ['giáo viên chủ nhiệm', 'họ tên gvcn', 'gvcn', 'chủ nhiệm']) || 'Chưa xếp';
  const grade = findColumnValue(row, ['khối học', 'khối']) || (className ? className.slice(0, 2) : '10');
  return { className, studentCount, homeroomTeacher, grade };
}).filter(c => c.className);

// 2. Assignments
const wbAssign = XLSX.readFile('bang_phan_cong_giang_day.xls');
const rawAssign = XLSX.utils.sheet_to_json(wbAssign.Sheets[wbAssign.SheetNames[0]]);
const assignments = [];
const teacherSubjectsMap = {};

rawAssign.forEach(row => {
  const teacherName = findColumnValue(row, ['họ tên giáo viên', 'tên giáo viên', 'giáo viên', 'họ và tên']);
  const assignText = findColumnValue(row, ['phân công học kỳ 1', 'phân công', 'hk1', 'học kỳ 1']) || findColumnValue(row, ['phân công học kỳ 2', 'hk2']);
  if (!teacherName || !assignText) return;

  if (!teacherSubjectsMap[teacherName]) teacherSubjectsMap[teacherName] = [];
  const parts = assignText.split(';').map(p => p.trim()).filter(Boolean);

  parts.forEach(part => {
    const colonIdx = part.indexOf(':');
    if (colonIdx === -1) return;
    const subject = part.slice(0, colonIdx).trim();
    const classListStr = part.slice(colonIdx + 1).trim();
    teacherSubjectsMap[teacherName].push(subject);

    const classNames = classListStr.split(',').map(c => c.trim()).filter(Boolean);
    classNames.forEach(cls => {
      assignments.push({
        id: 'assign_' + Math.random().toString(36).substr(2, 9),
        teacherName,
        subject,
        className: cls,
        term: 'HK1'
      });
    });
  });
});

// 3. Teachers
const wbTeacher = XLSX.readFile('giao_vien.xls');
const rawTeacher = XLSX.utils.sheet_to_json(wbTeacher.Sheets[wbTeacher.SheetNames[0]]);
const teachers = rawTeacher.map((row, idx) => {
  const name = findColumnValue(row, ['họ và tên', 'họ tên', 'tên giáo viên', 'tên', 'name']) || ('GV ' + (idx + 1));
  const dept = inferDepartment(name, teacherSubjectsMap[name] || []);
  const phone = findColumnValue(row, ['số điện thoại', 'điện thoại', 'sđt', 'phone']) || '---';
  return { id: 'gv_' + (idx + 1), name, dept, phone };
}).filter(t => t.name && t.name !== 'Chưa rõ tên');

const content = `// Cấu hình dữ liệu gốc chính thức của trường (Được đồng bộ từ các file Excel nguồn)

export const DEFAULT_DEPARTMENTS = [
  'Tất cả các tổ',
  'Tổ Toán',
  'Tổ Tin Học',
  'Tổ Lý - CNCN',
  'Tổ Sinh - CNNN',
  'Tổ Ngữ Văn',
  'Tổ Ngoại Ngữ',
  'Tổ Hóa Học',
  'Tổ Lịch Sử',
  'Tổ Địa Lí',
  'Tổ GDKT & Pháp Luật',
  'Tổ GDQP - Thể Chất',
  'Chưa phân tổ'
];

export const DEFAULT_TEACHERS = ${JSON.stringify(teachers, null, 2)};

export const DEFAULT_CLASSES = ${JSON.stringify(classes, null, 2)};

export const DEFAULT_ASSIGNMENTS = ${JSON.stringify(assignments, null, 2)};

export const DEFAULT_CASHFLOW = [];

export const DEFAULT_SETTINGS = {
  schoolName: '',
  departmentName: 'BỘ PHẬN THƯ VIỆN - PHOTOCOPY HỌC LIỆU',
  defaultUnitPrice: 380,
  schoolYear: '2025 - 2026',
  semester: 'Học kỳ I',
  driveFolderId: '19K5b-uR1La1UAUBOVoulYurXi0w97Efw',
  driveFolderUrl: 'https://drive.google.com/drive/folders/19K5b-uR1La1UAUBOVoulYurXi0w97Efw?usp=sharing',
  gasWebAppUrl: ''
};
`;

fs.writeFileSync('src/data/defaultData.js', content, 'utf8');
console.log('Successfully wrote src/data/defaultData.js!');
