// Cấu hình ban đầu chuẩn (Hoàn toàn không có dữ liệu mẫu / Mock Data)

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

// Danh sách Giáo viên ban đầu: Trống (chờ tải lên từ Admin)
export const DEFAULT_TEACHERS = [];

// Danh sách Sĩ số Lớp & GVCN ban đầu: Trống (chờ tải lên từ Admin)
export const DEFAULT_CLASSES = [];

// Bảng Phân công giảng dạy ban đầu: Trống (chờ tải lên từ Admin)
export const DEFAULT_ASSIGNMENTS = [];

// Sổ quỹ Thu/Chi ban đầu: Trống
export const DEFAULT_CASHFLOW = [];

// Cấu hình hệ thống mặc định
export const DEFAULT_SETTINGS = {
  schoolName: '',
  departmentName: 'BỘ PHẬN THƯ VIỆN - PHOTOCOPY HỌC LIỆU',
  defaultUnitPrice: 380, // 380 VNĐ / trang
  schoolYear: '2025 - 2026',
  semester: 'Học kỳ I',
  driveFolderId: '19K5b-uR1La1UAUBOVoulYurXi0w97Efw',
  driveFolderUrl: 'https://drive.google.com/drive/folders/19K5b-uR1La1UAUBOVoulYurXi0w97Efw?usp=sharing',
  gasWebAppUrl: ''
};
