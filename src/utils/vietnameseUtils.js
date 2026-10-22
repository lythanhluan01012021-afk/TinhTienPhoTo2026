/**
 * Utility functions for Vietnamese text processing & search
 */

// Bỏ dấu tiếng Việt chuẩn xác (Unicode Normalization Form D)
export const removeVietnameseTones = (str) => {
  if (!str) return '';
  str = str.toString();
  // Chuẩn hóa NFD và loại bỏ các dấu kết hợp
  str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Xử lý riêng ký tự đ/Đ
  str = str.replace(/[đĐ]/g, m => (m === 'đ' ? 'd' : 'D'));
  return str.toLowerCase().trim();
};

// Tìm kiếm gần đúng tiếng Việt (không phân biệt dấu, hoa thường)
export const fuzzyVietnameseMatch = (target, search) => {
  if (!search || !search.trim()) return true;
  if (!target) return false;

  const cleanTarget = removeVietnameseTones(target);
  const cleanSearch = removeVietnameseTones(search);

  // Khớp nếu chuỗi không dấu chứa từ khóa không dấu, hoặc chuỗi gốc chứa từ khóa gốc
  return cleanTarget.includes(cleanSearch) || target.toString().toLowerCase().includes(search.toLowerCase().trim());
};

// Tìm kiếm giáo viên chuẩn xác theo TÊN (bỏ qua Họ và Họ lót)
export const matchTeacherGivenName = (fullName, search) => {
  if (!search || !search.trim()) return true;
  if (!fullName) return false;

  const cleanSearch = removeVietnameseTones(search);
  const searchWords = cleanSearch.split(/\s+/).filter(Boolean);

  const cleanFullName = removeVietnameseTones(fullName);
  const nameParts = cleanFullName.split(/\s+/).filter(Boolean);
  if (nameParts.length === 0) return false;

  // Tên chính (từ cuối cùng): ví dụ "thoa" trong "le thi kim thoa"
  const givenName = nameParts[nameParts.length - 1];

  // 1. Nếu người dùng chỉ gõ 1 từ (ví dụ: "thoa", "dang", "minh", "hanh"):
  // CHỈ so sánh với TÊN CHÍNH của giáo viên, không khớp với họ (Lê, Nguyễn, Trần...) hay họ lót (Thị, Văn...)
  if (searchWords.length === 1) {
    return givenName.startsWith(cleanSearch) || givenName.includes(cleanSearch);
  }

  // 2. Nếu người dùng gõ từ 2 từ trở lên (ví dụ: "kim thoa", "bao tram", "ngoc hanh"):
  // So sánh với cụm 2 từ cuối (tên gọi)
  const lastTwoWords = nameParts.slice(-2).join(' ');
  if (lastTwoWords.includes(cleanSearch) || cleanSearch.includes(lastTwoWords)) {
    return true;
  }

  // 3. Nếu người dùng gõ cả họ tên đầy đủ
  return cleanFullName.includes(cleanSearch);
};
