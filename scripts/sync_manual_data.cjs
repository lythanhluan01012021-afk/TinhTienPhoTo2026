const fs = require('fs');
const XLSX = require('xlsx');
const https = require('https');

const manualFile = 'E:\\PHOTO 2026-2027\\TU\u1ea6N \u0300\u03007 26-27.xlsm';
const wbManual = XLSX.readFile(manualFile);
const sheet = wbManual.Sheets['soft'];
const rows = XLSX.utils.sheet_to_json(sheet, {header: 1});

function mapRow(r, i) {
  const shortTeacher = (r[1] || 'HỌC SINH').toString().trim();
  const className = (r[2] || '').toString().trim();
  const studentCount = Number(r[3]) || 0;
  const extraCount = Number(r[4]) || 0;
  const unitPrice = Number(r[5]) || 0;
  const amount = Number(r[6]) || 0;

  let teacherName = shortTeacher;
  let subject = 'Tài liệu / Đề kiểm tra';

  if (shortTeacher === 'T TRÍ') { teacherName = 'Hà Phước Trí'; subject = 'Ngoại ngữ'; }
  else if (shortTeacher === 'T MINH') {
    if (['12A1', '12A3'].includes(className)) { teacherName = 'Lê Văn Minh'; subject = 'Toán học'; }
    else if (['12A5', '10A5'].includes(className)) { teacherName = 'Đinh Văn Minh'; subject = 'Toán học'; }
    else if (['11A5', '11A7'].includes(className)) { teacherName = 'Kha Bửu Minh'; subject = 'Toán học'; }
    else { teacherName = 'Lê Văn Minh'; subject = 'Toán học'; }
  }
  else if (shortTeacher === 'C TRÂM') { teacherName = 'Đỗ Thị Bảo Trâm'; subject = 'Toán học'; }
  else if (shortTeacher === 'C TRANG') {
    if (['10A5', '10A10', '12A3', '12A6'].includes(className)) { teacherName = 'Phạm Nguyễn Thảo Trang'; subject = 'Ngữ văn'; }
    else if (['10A2', '10A3', '10A8', '11A2', '11A9'].includes(className)) { teacherName = 'Nguyễn Thị Mỹ Trang'; subject = 'Ngữ văn'; }
    else if (['11A7', '11A8', '11A10'].includes(className)) { teacherName = 'Lý Thị Thùy Trang'; subject = 'Lịch sử'; }
    else { teacherName = 'Nguyễn Thị Mỹ Trang'; subject = 'Ngữ văn'; }
  }
  else if (shortTeacher === 'C TÝ') { teacherName = 'Nguyễn Thị Tý'; subject = 'Sinh học'; }
  else if (shortTeacher === 'C LIÊN') { teacherName = 'Hồ Thị Liên'; subject = 'Địa lí'; }
  else if (shortTeacher === 'C HÀ') { teacherName = 'Nguyễn Thị Hà'; subject = 'Lịch sử'; }
  else if (shortTeacher === 'T GIANG') { teacherName = 'Võ Tiền Giang'; subject = 'Hóa học'; }
  else if (shortTeacher === 'C MY') { teacherName = 'Nguyễn Phạm Trà My'; subject = 'Ngữ văn'; }
  else if (shortTeacher === 'C GIANG') { teacherName = 'Nguyễn Thị Cẩm Giang'; subject = 'Ngoại ngữ'; }
  else if (shortTeacher === 'T THỌ') { teacherName = 'Ngô Hữu Thọ'; subject = 'Sinh học'; }
  else if (shortTeacher === 'T DUY') { teacherName = 'Phạm Quang Duy'; subject = 'Lịch sử'; }
  else if (shortTeacher === 'T TÚ') { teacherName = 'Phạm Thanh Tú'; subject = 'Địa lí'; }
  else if (shortTeacher === 'TN C BÌNH') { teacherName = 'Phạm Thị Bình'; subject = 'Thí nghiệm Hóa học'; }
  else if (shortTeacher === 'TN C THANH') { teacherName = 'Lưu Thị Phương Thanh'; subject = 'Thực hành Ngữ văn'; }
  else if (shortTeacher === 'TN C THẢO') { teacherName = 'Lê Thu Thảo'; subject = 'Thực hành Toán học'; }
  else if (shortTeacher === 'T PHƯỚC') { teacherName = 'Phạm Hữu Phước'; subject = 'Ngoại ngữ'; }
  else if (shortTeacher === 'T LUÂN') { teacherName = 'Lý Thành Luân'; subject = 'Tin học'; }
  else if (shortTeacher === 'T NAM') { teacherName = 'Nguyễn Phương Nam'; subject = 'Vật lí'; }
  else if (shortTeacher === 'C VI') { teacherName = 'Phạm Tường Vi'; subject = 'Hóa học'; }
  else if (shortTeacher === 'C HẠNH') { teacherName = 'Phạm Thị Ngọc Hạnh'; subject = 'Toán học'; }
  else if (shortTeacher === 'C NHI') {
    if (['10A1', '10A5', '10A9', '11A2', '11A3'].includes(className)) { teacherName = 'Nguyễn Thị Huỳnh Nhi'; subject = 'Ngoại ngữ'; }
    else if (['10A2', '11A1'].includes(className)) { teacherName = 'Võ Thị Yến Nhi'; subject = 'Địa lí'; }
    else { teacherName = 'Nguyễn Thị Huỳnh Nhi'; subject = 'Ngoại ngữ'; }
  }
  else if (shortTeacher === 'T ANH') { teacherName = 'Lê Bảo Anh'; subject = 'Vật lí'; }
  else if (shortTeacher === 'C ĐỆ') { teacherName = 'Nguyễn Thị Đệ'; subject = 'Ngữ văn'; }
  else if (shortTeacher === 'T NÊ') { teacherName = 'Nguyễn Văn Nê'; subject = 'Giáo dục kinh tế và pháp luật'; }
  else if (shortTeacher === 'T NHẬN') { teacherName = 'Đoàn Thanh Nhận'; subject = 'Giáo dục thể chất'; }
  else if (shortTeacher === 'C HOA') { teacherName = 'Nguyễn Thị Xuân Hoa'; subject = 'Ngoại ngữ'; }
  else if (shortTeacher === 'C DƯƠNG') { teacherName = 'Võ Thị Thùy Dương'; subject = 'Vật lí'; }
  else if (shortTeacher === 'C LÀI') { teacherName = 'Nguyễn Thị Lài'; subject = 'Hóa học'; }
  else if (shortTeacher === 'C TUYỀN') {
    if (['11A1', '11A7', '11A10', '12A6', '12A9'].includes(className)) { teacherName = 'Huỳnh Thanh Tuyền'; subject = 'Sinh học'; }
    else { teacherName = 'Nguyễn Thị Bích Tuyền'; subject = 'Ngoại ngữ'; }
  }
  else if (shortTeacher === 'T LÀNH') { teacherName = 'Nguyễn Ngọc Lành'; subject = 'Toán học'; }
  else if (shortTeacher === 'T HÀO') { teacherName = 'Lý Hồng Hào'; subject = 'Toán học'; }
  else if (shortTeacher === 'HỌC SINH') { teacherName = 'HỌC SINH'; subject = 'PHO TÀI LIỆU'; }
  else if (shortTeacher === 'C THANH') { teacherName = 'Lưu Thị Phương Thanh'; subject = 'Ngữ văn'; }
  else if (shortTeacher === 'C MAI') { teacherName = 'Võ Thị Tuyết Mai'; subject = 'Sinh học'; }
  else if (shortTeacher === 'T SANG') {
    if (className === '11A2') { teacherName = 'Mai Thanh Sang'; subject = 'Giáo dục quốc phòng và an ninh'; }
    else { teacherName = 'Văn Công Sang'; subject = 'Tin học'; }
  }
  else if (shortTeacher === 'C THẢO') { teacherName = 'Lê Thu Thảo'; subject = 'Toán học'; }
  else if (shortTeacher === 'C BÌNH') { teacherName = 'Phạm Thị Bình'; subject = 'Ngữ văn'; }
  else if (shortTeacher === 'T LÂM') { teacherName = 'Huỳnh Quốc Lâm'; subject = 'Vật lí'; }
  else if (shortTeacher === 'T KIỆN') { teacherName = 'Hồ Minh Kiện'; subject = 'Tin học'; }
  else if (shortTeacher === 'C NGÂN') { teacherName = 'Nguyễn Thị Ngân'; subject = 'Tin học'; }
  else if (shortTeacher === 'C B HẠNH') { teacherName = 'Dương Thị Bích Hạnh'; subject = 'Ngoại ngữ'; }

  const totalCopies = (Number(studentCount) || 0) + (Number(extraCount) || 0);

  return {
    id: `DON-T7-${String(i).padStart(3, '0')}`,
    week: 'Tuần 7',
    teacherName,
    className,
    subject,
    studentCount,
    extraCount,
    totalCopies,
    unitPrice,
    amount,
    status: 'DA_THANH_TOAN',
    isPaid: true,
    note: shortTeacher !== teacherName ? `GV: ${shortTeacher}` : '',
    updatedAt: new Date().toLocaleString('vi-VN')
  };
}

const items = [];
let totalAmt = 0;
for(let i=0; i<rows.length; i++) {
  const r = rows[i];
  if(r && typeof r[6] === 'number') {
    const item = mapRow(r, i);
    items.push(item);
    totalAmt += item.amount;
  }
}

console.log('Tổng số dòng photo chính xác:', items.length);
console.log('Tổng thành tiền photo chuẩn xác:', totalAmt.toLocaleString('vi-VN') + ' đ');

const classDebts = {
  '10A10': { amount: 51300, note: 'THIẾU TUẦN 6', updatedAt: new Date().toLocaleString('vi-VN') },
  '10A3': { amount: 102600, note: 'THIẾU TUẦN 6', updatedAt: new Date().toLocaleString('vi-VN') },
  '10A7': { amount: 153900, note: 'THIẾU TUẦN 6', updatedAt: new Date().toLocaleString('vi-VN') },
  '11A3': { amount: 127680, note: 'THIẾU TUẦN 6', updatedAt: new Date().toLocaleString('vi-VN') },
  '11A7': { amount: 31160, note: 'THIẾU TUẦN 6', updatedAt: new Date().toLocaleString('vi-VN') },
  '11A10': { amount: 28800, note: 'THIẾU TUẦN 6', updatedAt: new Date().toLocaleString('vi-VN') }
};

// 1. Ghi file Excel CSDL_PHOTO_LOCAL_DONG_BO.xlsx & CSDL_PHOTO_LOCAL.xlsx
const wbNew = XLSX.utils.book_new();

const billingRows = items.map((it, idx) => ({
  'STT': idx + 1,
  'Mã Đơn': it.id,
  'Tuần': it.week,
  'Tên Giáo Viên': it.teacherName,
  'Lớp': it.className,
  'Môn Học / Nội Dung': it.subject,
  'Sĩ Số': it.studentCount,
  'Số Lượng Lẻ': it.extraCount,
  'Tổng Bản In': it.totalCopies,
  'Đơn Giá (đ)': it.unitPrice,
  'Thành Tiền (đ)': it.amount,
  'Đã Thanh Toán': 'Đã thu tiền',
  'Ghi Chú': it.note,
  'Cập Nhật Lúc': it.updatedAt
}));
const wsBilling = XLSX.utils.json_to_sheet(billingRows);
XLSX.utils.book_append_sheet(wbNew, wsBilling, 'BangTinhTien');

const debtRows = Object.keys(classDebts).map((cls, idx) => ({
  'STT': idx + 1,
  'Tuần': 'Tuần 7',
  'Lớp': cls,
  'Số Tiền Nợ / Thiếu (đ)': classDebts[cls].amount,
  'Lý Do / Ghi Chú Nợ': classDebts[cls].note,
  'Cập Nhật Lúc': classDebts[cls].updatedAt
}));
const wsDebts = XLSX.utils.json_to_sheet(debtRows);
XLSX.utils.book_append_sheet(wbNew, wsDebts, 'NoCacLop');

const wsCashflow = XLSX.utils.json_to_sheet([]);
XLSX.utils.book_append_sheet(wbNew, wsCashflow, 'SoQuyThuChi');

const summaryRows = [{
  'STT': 1,
  'Tuần Làm Việc': 'Tuần 7',
  'Tổng Số Lớp Photo': new Set(items.map(it => it.className)).size,
  'Tổng Số Bản In': items.reduce((s, it) => s + it.totalCopies, 0),
  'Tổng Tiền Photo (đ)': totalAmt,
  'Nợ Cũ Mang Sang (đ)': 495440,
  'Tổng Doanh Thu Cần Thu (đ)': totalAmt + 495440,
  'Cập Nhật Lúc': new Date().toLocaleString('vi-VN')
}];
const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
XLSX.utils.book_append_sheet(wbNew, wsSummary, 'TongHopDoanhThu');

XLSX.writeFile(wbNew, 'CSDL_PHOTO_LOCAL_DONG_BO.xlsx');
console.log('Đã lưu thành công vào CSDL_PHOTO_LOCAL_DONG_BO.xlsx');

try {
  XLSX.writeFile(wbNew, 'CSDL_PHOTO_LOCAL.xlsx');
  console.log('Đã cập nhật trực tiếp thành công CSDL_PHOTO_LOCAL.xlsx');
} catch(e) {
  console.log('CSDL_PHOTO_LOCAL.xlsx đang mở trong Excel, file dự phòng CSDL_PHOTO_LOCAL_DONG_BO.xlsx sẽ tự động đồng bộ khi Excel đóng.');
}

// 2. Gửi đồng bộ lên Google Sheets
const gasUrl = 'https://script.google.com/macros/s/AKfycbxDY3_avCD1wEOKb0eOQd7C8GeF-33JF9PvnSIkpUm44yJG2phdVRZOXCyfX_ONVGQG/exec';
const payload = JSON.stringify({
  action: 'saveBillingData',
  currentWeek: 'Tuần 7',
  items: items,
  classDebts: classDebts
});

console.log('Đang gửi đồng bộ lên Google Sheets...');
function post(url, data, callback) {
  const parsed = new URL(url);
  const options = {
    hostname: parsed.hostname,
    path: parsed.pathname + parsed.search,
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
      'Content-Length': Buffer.byteLength(data)
    }
  };

  const req = https.request(options, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      post(res.headers.location, data, callback);
      return;
    }
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => callback(null, body));
  });

  req.on('error', err => callback(err));
  req.write(data);
  req.end();
}

post(gasUrl, payload, (err, resBody) => {
  if (err) {
    console.error('Lỗi khi gửi lên Google Sheets:', err.message);
  } else {
    console.log('Kết quả từ Google Sheets:', resBody.slice(0, 300));
  }
});
