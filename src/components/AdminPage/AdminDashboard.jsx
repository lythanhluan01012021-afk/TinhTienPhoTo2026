import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Users, 
  BookOpen, 
  GraduationCap, 
  HardDrive, 
  Upload, 
  Download, 
  Plus, 
  Trash2, 
  CheckCircle, 
  Copy, 
  ExternalLink,
  Save,
  FileSpreadsheet,
  Settings as SettingsIcon,
  HelpCircle,
  Database,
  DollarSign
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { fuzzyVietnameseMatch } from '../../utils/vietnameseUtils';

export const AdminDashboard = () => {
  const { 
    teachers, 
    setTeachers, 
    classes, 
    setClasses, 
    assignments, 
    setAssignments, 
    settings, 
    setSettings,
    departments,
    resetAllDataToEmpty
  } = useApp();

  const [activeAdminSubTab, setActiveAdminSubTab] = useState('teachers'); // 'teachers' | 'assignments' | 'classes' | 'database' | 'settings'
  const [copySuccess, setCopySuccess] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [classSearch, setClassSearch] = useState('');

  // 1. New Teacher form state
  const [newTeacher, setNewTeacher] = useState({ name: '', dept: departments[2] || 'Tổ Toán - Tin học', phone: '' });

  // 2. New Assignment form state
  const [newAssignment, setNewAssignment] = useState({ teacherName: teachers[0]?.name || '', subject: 'Toán Học', className: classes[0]?.className || '10A1' });

  // 3. New Class form state
  const [newClass, setNewClass] = useState({ className: '', studentCount: 40, homeroomTeacher: '', grade: '10' });

  // Google Apps Script source code (v2.0 - Đồng bộ 2 chiều & Chống trùng lặp & Quản lý theo tuần chuẩn 11 cột)
  const gasScriptCode = `/**
 * GOOGLE APPS SCRIPT - CƠ SỞ DỮ LIỆU TÍNH TIỀN PHOTO TRƯỜNG HỌC (PHIÊN BẢN 2.0)
 * ==============================================================================
 * TÍNH NĂNG NÂNG CẤP MỚI:
 * 1. ĐỒNG BỘ 2 CHIỀU: Hỗ trợ đọc dữ liệu từ Sheet về Web App (fetchBillingData).
 * 2. CƠ CHẾ UPSERT (CẬP NHẬT HOẶC THÊM MỚI): 
 *    - Tự động tìm Mã Giao Dịch (Cột A) để cập nhật nội dung (tên tài liệu, số lượng, đơn giá).
 *    - Tuyệt đối KHÔNG sinh dòng trùng lặp khi lưu nhiều lần.
 * 3. QUẢN LÝ THEO TUẦN: Cột K (Cột 11) lưu "Tuần Photo" và Tab CongNo_TheoTuan lưu công nợ theo tuần.
 *    - Đã loại bỏ 2 cột "Trạng Thái Đơn" và "Ghi Chú" để bảng gọn gàng, tối ưu.
 * 4. TỰ ĐỘNG CHUẨN HÓA DÒNG TIÊU ĐỀ: Tự động chuyển Tuần Photo từ cột M sang cột K và xóa cột thừa!
 * ==============================================================================
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(15000); // Khóa an toàn chống xung đột đa luồng

  try {
    var rawData = e.postData.contents;
    var data = JSON.parse(rawData);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. ACTION: LƯU & CẬP NHẬT DỮ LIỆU PHOTO (UPSERT - KHÔNG TRÙNG LẶP)
    if (data.action === "saveBillingData") {
      var sheet = getOrCreatePhotoSheet(ss);
      var items = data.items || [];
      var timestamp = new Date();

      var lastRow = sheet.getLastRow();
      var idToRowMap = {};

      // Đọc toàn bộ Mã Giao Dịch hiện có tại Cột A (từ dòng 2)
      if (lastRow > 1) {
        var existingIds = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
        for (var i = 0; i < existingIds.length; i++) {
          var val = existingIds[i][0];
          if (val) {
            idToRowMap[val.toString().trim()] = (i + 2); // Lưu vị trí dòng (1-indexed)
          }
        }
      }

      var updatedCount = 0;
      var insertedCount = 0;

      items.forEach(function(item) {
        if (!item.id) return;
        var cleanId = item.id.toString().trim();
        var studentCount = Number(item.studentCount) || 0;
        var extraCount = Number(item.extraCount) || 0;
        var totalCopies = (Number(item.totalCopies) || (studentCount + extraCount));
        var unitPrice = Number(item.unitPrice) || 380;
        var amount = Number(item.amount) || (totalCopies * unitPrice);
        var weekLabel = item.week || data.currentWeek || "Tuần 1";

        var rowValues = [
          cleanId,
          timestamp,
          item.teacherName || "",
          item.className || "",
          item.subject || "",
          studentCount,
          extraCount,
          totalCopies,
          unitPrice,
          amount,
          weekLabel
        ];

        // Nếu đã có ID trên Sheet -> CẬP NHẬT VÀO ĐÚNG DÒNG ĐÓ
        if (idToRowMap[cleanId]) {
          var targetRow = idToRowMap[cleanId];
          sheet.getRange(targetRow, 1, 1, 11).setValues([rowValues]);
          updatedCount++;
        } else {
          // Chưa có -> THÊM MỚI
          sheet.appendRow(rowValues);
          idToRowMap[cleanId] = sheet.getLastRow();
          insertedCount++;
        }
      });

      // CẬP NHẬT HOẶC TẠO TAB CÔNG NỢ THEO TUẦN (CongNo_TheoTuan)
      if (data.classDebts && data.classDebts.length > 0) {
        var debtSheet = getOrCreateDebtSheet(ss);
        var lastDebtRow = debtSheet.getLastRow();
        var debtKeyToRowMap = {};

        if (lastDebtRow > 1) {
          var existingKeys = debtSheet.getRange(2, 1, lastDebtRow - 1, 1).getValues();
          for (var k = 0; k < existingKeys.length; k++) {
            var dKey = existingKeys[k][0];
            if (dKey) {
              debtKeyToRowMap[dKey.toString().trim()] = (k + 2);
            }
          }
        }

        data.classDebts.forEach(function(d) {
          if (!d.className) return;
          var weekVal = d.week || data.currentWeek || "Tuần 1";
          var cleanClass = d.className.toString().trim();
          var keyVal = d.key || (weekVal + "_" + cleanClass);
          var previousDebt = Number(d.previousDebt || d.debtAmount) || 0;
          var photoAmount = Number(d.photoAmount) || 0;
          var totalDue = Number(d.totalDue) || (previousDebt + photoAmount);

          var debtRowValues = [
            keyVal,                         // Cột A: Mã Định Danh (Tuần_Lớp)
            weekVal,                        // Cột B: Tuần
            cleanClass,                     // Cột C: Lớp
            d.homeroomTeacher || "",        // Cột D: GVCN
            previousDebt,                   // Cột E: Tiền Nợ Tuần Trước (VNĐ)
            photoAmount,                    // Cột F: Tiền Photo Tuần Này (VNĐ)
            totalDue,                       // Cột G: TỔNG CẦN THU (VNĐ)
            d.note || "",                   // Cột H: Ghi Chú Nợ
            d.updatedAt || timestamp        // Cột I: Ngày Cập Nhật
          ];

          if (debtKeyToRowMap[keyVal]) {
            debtSheet.getRange(debtKeyToRowMap[keyVal], 1, 1, 9).setValues([debtRowValues]);
          } else {
            debtSheet.appendRow(debtRowValues);
            debtKeyToRowMap[keyVal] = debtSheet.getLastRow();
          }
        });
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Đồng bộ thành công! Đã cập nhật " + updatedCount + " mục và thêm mới " + insertedCount + " mục vào CSDL.",
        updatedCount: updatedCount,
        insertedCount: insertedCount,
        totalItems: items.length,
        spreadsheetUrl: ss ? ss.getUrl() : ""
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 2. ACTION: XÓA DÒNG THEO ID
    if (data.action === "deleteBillingItem") {
      var sheet = ss.getSheetByName("NhatKy_Photo");
      if (sheet && data.id) {
        var lastRow = sheet.getLastRow();
        if (lastRow > 1) {
          var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
          for (var r = ids.length - 1; r >= 0; r--) {
            if (ids[r][0] && ids[r][0].toString().trim() === data.id.toString().trim()) {
              sheet.deleteRow(r + 2);
              break;
            }
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "Action không hợp lệ: " + data.action
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "ping";
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // ĐỌC DỮ LIỆU TỪ GOOGLE SHEETS VỀ WEB APP
  if (action === "fetchBillingData" || action === "getBillingData") {
    var sheet = ss ? ss.getSheetByName("NhatKy_Photo") : null;
    var items = [];

    if (sheet && sheet.getLastRow() > 1) {
      var lastRow = sheet.getLastRow();
      var lastCol = sheet.getLastColumn();
      var readCols = Math.min(13, Math.max(11, lastCol));
      var rows = sheet.getRange(2, 1, lastRow - 1, readCols).getValues();

      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        if (!r[0] && !r[2]) continue; // Bỏ qua dòng trống

        var studentCount = Number(r[5]) || 0;
        var extraCount = Number(r[6]) || 0;
        var totalCopies = Number(r[7]) || (studentCount + extraCount);
        var unitPrice = Number(r[8]) || 380;
        var amount = Number(r[9]) || (totalCopies * unitPrice);
        // Tuần Photo nằm ở Cột K (chỉ mục 10) hoặc nếu còn ở sheet cũ 13 cột thì nằm ở Cột M (chỉ mục 12)
        var weekText = "Tuần 1";
        if (r[10] && r[10].toString().trim().indexOf("Tuần") === 0) {
          weekText = r[10].toString().trim();
        } else if (r[12] && r[12].toString().trim().indexOf("Tuần") === 0) {
          weekText = r[12].toString().trim();
        }

        items.push({
          id: r[0] ? r[0].toString() : ("item-" + i),
          timestamp: r[1],
          teacherName: r[2] ? r[2].toString() : "",
          className: r[3] ? r[3].toString() : "",
          subject: r[4] ? r[4].toString() : "",
          studentCount: studentCount,
          extraCount: extraCount,
          totalCopies: totalCopies,
          unitPrice: unitPrice,
          amount: amount,
          week: weekText
        });
      }
    }

    var debts = {};
    var debtSheet = ss ? ss.getSheetByName("CongNo_TheoTuan") : null;
    if (debtSheet && debtSheet.getLastRow() > 1) {
      var dRows = debtSheet.getRange(2, 1, debtSheet.getLastRow() - 1, 9).getValues();
      for (var d = 0; d < dRows.length; d++) {
        var dr = dRows[d];
        var dWeek = dr[1] ? dr[1].toString().trim() : "Tuần 1";
        var dClass = dr[2] ? dr[2].toString().trim() : "";
        var dAmount = Number(dr[4]) || 0;
        var dNote = dr[7] ? dr[7].toString().trim() : "";
        var dDate = dr[8] ? dr[8].toString().trim() : "";
        if (dClass && dAmount > 0) {
          if (!debts[dWeek]) debts[dWeek] = {};
          debts[dWeek][dClass] = {
            amount: dAmount,
            note: dNote,
            updatedAt: dDate
          };
        }
      }
    }

    return ContentService.createTextOutput(JSON.stringify({ 
      status: "success", 
      items: items, 
      count: items.length,
      debts: debts,
      spreadsheetUrl: ss ? ss.getUrl() : ""
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // LẤY TRỰC TIẾP URL SPREADSHEET ĐỂ MỞ NHANH
  if (action === "getSpreadsheetUrl") {
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      spreadsheetUrl: ss ? ss.getUrl() : "",
      spreadsheetName: ss ? ss.getName() : ""
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // MẶC ĐỊNH: BÁO TRẠNG THÁI HOẠT ĐỘNG
  var sheet = ss ? ss.getSheetByName("NhatKy_Photo") : null;
  var rowCount = sheet ? Math.max(0, sheet.getLastRow() - 1) : 0;
  var fileName = ss ? ss.getName() : "Chưa xác định";

  return ContentService.createTextOutput(
    "API Web App Tinh Tien Photo (v2.0) đang hoạt động hoàn hảo!\\n" +
    "- File Google Sheet: " + fileName + "\\n" +
    "- Số bản ghi photo: " + rowCount + "\\n" +
    "- Hỗ trợ: Đồng bộ 2 chiều (GET/POST) & Chống trùng lặp (Upsert)"
  ).setMimeType(ContentService.MimeType.TEXT);
}

// Hàm hỗ trợ lấy hoặc tạo sheet NhatKy_Photo và tự động chuẩn hóa 11 cột tiêu đề (bỏ Trạng Thái & Ghi Chú)
function getOrCreatePhotoSheet(ss) {
  var sheet = ss.getSheetByName("NhatKy_Photo");
  if (!sheet) {
    var sheets = ss.getSheets();
    if (sheets.length === 1 && sheets[0].getLastRow() === 0) {
      sheet = sheets[0];
      sheet.setName("NhatKy_Photo");
    } else {
      sheet = ss.insertSheet("NhatKy_Photo");
    }
  }

  var headers = [
    "Mã Giao Dịch",
    "Thời Gian Cập Nhật",
    "Giáo Viên",
    "Lớp",
    "Môn Học / Nội Dung",
    "Sĩ Số",
    "Số Lượng Lẻ",
    "Tổng Bản In",
    "Đơn Giá (VNĐ)",
    "Thành Tiền (VNĐ)",
    "Tuần Photo"
  ];

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, 11)
         .setFontWeight("bold")
         .setBackground("#1b5ebe")
         .setFontColor("#ffffff")
         .setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
    sheet.setRowHeight(1, 35);
  } else {
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();

    // Kiểm tra nếu sheet cũ đang có cột Tuần Photo ở cột M (13) hoặc cột K đang là Trạng Thái Đơn
    var headerK = sheet.getRange(1, 11).getValue().toString().trim();
    var headerM = lastCol >= 13 ? sheet.getRange(1, 13).getValue().toString().trim() : "";

    if (headerM === "Tuần Photo" || headerK === "Trạng Thái Đơn") {
      if (lastRow > 1 && headerM === "Tuần Photo") {
        // Sao chép toàn bộ giá trị Tuần Photo từ cột M (13) sang cột K (11)
        var weekValues = sheet.getRange(2, 13, lastRow - 1, 1).getValues();
        sheet.getRange(2, 11, lastRow - 1, 1).setValues(weekValues);
      }
      // Xóa hoàn toàn nội dung và định dạng thừa ở cột L (12) và cột M (13) trở đi
      if (sheet.getMaxColumns() >= 12) {
        sheet.getRange(1, 12, Math.max(1, lastRow), sheet.getMaxColumns() - 11).clear();
      }
    }

    // Đặt lại dòng tiêu đề chuẩn 11 cột tại dòng 1
    sheet.getRange(1, 1, 1, 11).setValues([headers]);
    sheet.getRange(1, 1, 1, 11)
         .setFontWeight("bold")
         .setBackground("#1b5ebe")
         .setFontColor("#ffffff")
         .setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
    sheet.setRowHeight(1, 35);
  }

  // Tự động điền "Tuần 1" vào cột K (cột 11) cho các dòng cũ nếu đang bị trống
  var curLastRow = sheet.getLastRow();
  if (curLastRow > 1) {
    var colK = sheet.getRange(2, 11, curLastRow - 1, 1).getValues();
    var needUpdate = false;
    for (var r = 0; r < colK.length; r++) {
      if (!colK[r][0] || colK[r][0].toString().trim() === "") {
        colK[r][0] = "Tuần 1";
        needUpdate = true;
      }
    }
    if (needUpdate) {
      sheet.getRange(2, 11, curLastRow - 1, 1).setValues(colK);
    }
  }

  return sheet;
}

/**
 * HÀM SỬA BẢNG: BỎ CỘT TRẠNG THÁI & GHI CHÚ, ĐƯA TUẦN PHOTO VỀ CỘT K
 * Bạn có thể chọn hàm này trên menu Google Apps Script và bấm "Chạy" (Run).
 * Sheet sẽ lập tức chuyển Tuần Photo về Cột K, xóa sạch Cột L và M!
 */
function chuanHoaVaDienTuan() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreatePhotoSheet(ss);
  Logger.log("Đã loại bỏ cột Trạng thái đơn & Ghi chú, đưa Tuần Photo về Cột K thành công!");
}

function getOrCreateDebtSheet(ss) {
  var sheet = ss.getSheetByName("CongNo_TheoTuan");
  if (!sheet) {
    sheet = ss.insertSheet("CongNo_TheoTuan");
    sheet.appendRow([
      "Mã Định Danh (Tuần_Lớp)", "Tuần", "Lớp", "GVCN", 
      "Tiền Nợ Tuần Trước (VNĐ)", "Tiền Photo Tuần Này (VNĐ)", 
      "TỔNG CẦN THU (VNĐ)", "Ghi Chú Nợ", "Ngày Cập Nhật"
    ]);
    sheet.getRange(1, 1, 1, 9)
         .setFontWeight("bold")
         .setBackground("#0f766e")
         .setFontColor("#ffffff")
         .setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
    sheet.setRowHeight(1, 35);
  }
  return sheet;
}

function normalizeStatusKey(label) {
  if (!label) return "CHO_TAI_LIEU";
  if (label.indexOf("Đang photo") !== -1 || label.indexOf("DANG_IN") !== -1) return "DANG_IN";
  if (label.indexOf("Đã photo xong") !== -1 || label.indexOf("HOAN_THANH") !== -1) return "HOAN_THANH";
  if (label.indexOf("Đã thanh toán") !== -1 || label.indexOf("DA_THANH_TOAN") !== -1) return "DA_THANH_TOAN";
  return "CHO_TAI_LIEU";
}

function cleanDuplicates() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("NhatKy_Photo");
  if (!sheet) return;
  var lastRow = sheet.getLastRow();
  if (lastRow <= 2) return;
  var data = sheet.getRange(2, 1, lastRow - 1, 11).getValues();
  var seenIds = {};
  var rowsToDelete = [];
  for (var i = 0; i < data.length; i++) {
    var id = data[i][0] ? data[i][0].toString().trim() : "";
    if (!id) continue;
    if (seenIds[id]) {
      rowsToDelete.push(i + 2);
    } else {
      seenIds[id] = true;
    }
  }
  for (var k = rowsToDelete.length - 1; k >= 0; k--) {
    sheet.deleteRow(rowsToDelete[k]);
  }
}`;

  // Copy GAS Code
  const handleCopyCode = () => {
    navigator.clipboard.writeText(gasScriptCode);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  // Add Teacher
  const handleAddTeacher = (e) => {
    e.preventDefault();
    if (!newTeacher.name.trim()) return;
    const item = {
      id: `GV${Date.now().toString().slice(-4)}`,
      name: newTeacher.name.trim(),
      dept: newTeacher.dept,
      phone: newTeacher.phone.trim() || '---'
    };
    setTeachers(prev => [...prev, item]);
    setNewTeacher({ name: '', dept: departments[1] || 'Tổ Toán - Tin học', phone: '' });
  };

  // Add Assignment
  const handleAddAssignment = (e) => {
    e.preventDefault();
    if (!newAssignment.teacherName || !newAssignment.className) return;
    const foundTeacher = teachers.find(t => t.name === newAssignment.teacherName);
    const item = {
      teacherId: foundTeacher ? foundTeacher.id : 'GV_CUSTOM',
      teacherName: newAssignment.teacherName,
      subject: newAssignment.subject.trim() || 'Môn học',
      className: newAssignment.className
    };
    setAssignments(prev => [...prev, item]);
  };

  // Add Class
  const handleAddClass = (e) => {
    e.preventDefault();
    if (!newClass.className.trim()) return;
    const item = {
      className: newClass.className.trim().toUpperCase(),
      studentCount: Number(newClass.studentCount) || 40,
      homeroomTeacher: newClass.homeroomTeacher.trim() || 'Chưa phân công',
      grade: newClass.grade
    };
    setClasses(prev => [...prev, item]);
    setNewClass({ className: '', studentCount: 40, homeroomTeacher: '', grade: '10' });
  };

  // Export Sample Excel Template for Teachers
  const handleDownloadTeacherTemplate = () => {
    const data = [
      { 'Mã GV': 'GV01', 'Họ Và Tên': 'Nguyễn Văn An', 'Tổ Chuyên Môn': 'Tổ Toán - Tin học', 'Số Điện Thoại': '0912345678' },
      { 'Mã GV': 'GV02', 'Họ Và Tên': 'Trần Thị Mai', 'Tổ Chuyên Môn': 'Tổ Toán - Tin học', 'Số Điện Thoại': '0912345679' }
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'GiaoVien');
    XLSX.writeFile(wb, 'Mau_Danh_Sach_Giao_Vien.xlsx');
  };

  // Export Sample Assignments Template
  const handleDownloadAssignmentTemplate = () => {
    const data = [
      { 'Tên Giáo Viên': 'Nguyễn Văn An', 'Môn Giảng Dạy': 'Toán Học', 'Lớp': '10A1' },
      { 'Tên Giáo Viên': 'Nguyễn Văn An', 'Môn Giảng Dạy': 'Toán Học', 'Lớp': '10A2' }
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PhanCong');
    XLSX.writeFile(wb, 'Mau_Phan_Cong_Giang_Day.xlsx');
  };

  // Export Sample Classes Template
  const handleDownloadClassTemplate = () => {
    const data = [
      { 'Tên Lớp': '10A1', 'Sĩ Số': 42, 'Họ Tên GVCN': 'Nguyễn Văn An', 'Khối': '10' },
      { 'Tên Lớp': '10A2', 'Sĩ Số': 40, 'Họ Tên GVCN': 'Vũ Minh Tuấn', 'Khối': '10' }
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SiSo_GVCN');
    XLSX.writeFile(wb, 'Mau_Si_So_Va_GVCN.xlsx');
  };

  // Hàm đối soát linh hoạt tên cột trong file Excel (không phân biệt hoa/thường, có/không dấu, khoảng trắng)
  const findColumnValue = (row, candidatePatterns) => {
    if (!row || typeof row !== 'object') return '';
    const rowKeys = Object.keys(row);
    for (const pattern of candidatePatterns) {
      const normPattern = pattern.toLowerCase().replace(/[\s_\-\.]+/g, '');
      for (const key of rowKeys) {
        const normKey = key.toLowerCase().replace(/[\s_\-\.]+/g, '');
        if (normKey === normPattern || normKey.includes(normPattern) || normPattern.includes(normKey)) {
          const val = row[key];
          if (val !== undefined && val !== null && String(val).trim() !== '') {
            return String(val).trim();
          }
        }
      }
    }
    return '';
  };

  // Nạp trực tiếp file giao_vien.xls có sẵn trong thư mục dự án
  const handleLoadAvailableTeacherFile = async () => {
    try {
      const res = await fetch('/giao_vien.xls');
      const arrayBuffer = await res.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type: 'array' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);

      const parsed = data.map((row, idx) => {
        const name = findColumnValue(row, ['họ và tên', 'họ tên', 'tên giáo viên', 'tên gv', 'họ tên giáo viên', 'tên', 'fullname', 'name', 'hoten']) || `GV ${idx + 1}`;
        let dept = findColumnValue(row, ['tổ chuyên môn', 'tổ bộ môn', 'tổ', 'chuyên môn', 'bộ môn', 'phòng ban', 'khoa', 'department']);
        if (!dept || dept === 'Chưa phân tổ') {
          dept = inferDepartmentFromSubject('', [], name);
        }
        const phone = findColumnValue(row, ['số điện thoại', 'điện thoại', 'sđt', 'sdt', 'phone', 'mobile', 'tel']) || '---';
        return { id, name, dept, phone };
      }).filter(t => t.name && t.name !== 'Chưa rõ tên');

      setTeachers(parsed);
      setImportMessage(`Đã nạp thành công ${parsed.length} giáo viên từ file giao_vien.xls có sẵn!`);
      setTimeout(() => setImportMessage(''), 4500);
    } catch (err) {
      console.error(err);
      alert('Không thể nạp tự động file. Vui lòng bấm "Nạp Từ File Excel" và chọn file giao_vien.xls từ máy tính.');
    }
  };

  // Suy luận tổ chuyên môn từ môn học giảng dạy
  const inferDepartmentFromSubject = (subject, allSubjectsForTeacher = [], teacherName = '') => {
    const cleanName = (teacherName || '').toLowerCase().trim();
    if (cleanName.includes('đăng') || cleanName.includes('tuyến')) {
      return 'Tổ Sinh - CNNN';
    }
    if (cleanName.includes('thoa')) {
      return 'Tổ Ngoại Ngữ';
    }
    const tinTeachers = ['hồ minh kiện', 'lý thành luân', 'nguyễn thị ngân', 'văn công sang'];
    if (tinTeachers.some(t => cleanName.includes(t))) {
      return 'Tổ Tin Học';
    }
    if (!subject) return 'Chưa phân tổ';
    const s = subject.toLowerCase();
    if (s.includes('toán')) return 'Tổ Toán';
    if (s.includes('tin học') || s.includes('tin')) return 'Tổ Tin Học';
    if (s.includes('ngữ văn') || s.includes('văn')) return 'Tổ Ngữ Văn';
    if (s.includes('ngoại ngữ') || s.includes('tiếng anh')) return 'Tổ Ngoại Ngữ';
    if (s.includes('vật lí') || s.includes('vật lý') || s.includes('lý')) return 'Tổ Lý - CNCN';
    if (s.includes('sinh học') || s.includes('sinh')) return 'Tổ Sinh - CNNN';
    if (s.includes('công nghệ')) {
      if (allSubjectsForTeacher.some(sub => sub.toLowerCase().includes('sinh'))) {
        return 'Tổ Sinh - CNNN';
      }
      return 'Tổ Lý - CNCN';
    }
    if (s.includes('hóa học') || s.includes('hóa')) return 'Tổ Hóa Học';
    if (s.includes('lịch sử') || s.includes('sử')) return 'Tổ Lịch Sử';
    if (s.includes('địa lí') || s.includes('địa lý') || s.includes('địa')) return 'Tổ Địa Lí';
    if (s.includes('kinh tế') || s.includes('pháp luật') || s.includes('gdcd')) return 'Tổ GDKT & Pháp Luật';
    if (s.includes('quốc phòng') || s.includes('thể dục') || s.includes('thể chất')) return 'Tổ GDQP - Thể Chất';
    return 'Tổ ' + subject;
  };

  // Trích xuất phân công giảng dạy từ dữ liệu raw (hỗ trợ cả chuỗi phân công SMAS lẫn bảng chuẩn)
  const parseAssignmentsFromRawData = (data) => {
    const newAssignments = [];
    const teacherDeptMap = {};
    const detectedClasses = new Set();

    data.forEach(row => {
      const teacherName = (findColumnValue(row, ['họ tên giáo viên', 'họ và tên', 'tên giáo viên', 'họ tên', 'gv', 'name']) || '').trim();
      if (!teacherName) return;

      const cleanName = teacherName.toLowerCase();
      if (cleanName.includes('thoa')) {
        teacherDeptMap[teacherName] = 'Tổ Ngoại Ngữ';
      }
      if (cleanName.includes('đăng') || cleanName.includes('tuyến')) {
        teacherDeptMap[teacherName] = 'Tổ Sinh - CNNN';
      }

      const pc = findColumnValue(row, ['phân công học kỳ 1', 'phân công học kì 1', 'học kỳ 1', 'phân công học kỳ 2', 'học kỳ 2', 'phân công']) || '';

      if (pc && pc.includes(':')) {
        const parts = pc.split(';');
        const teacherSubjects = [];
        parts.forEach(part => {
          const colonIdx = part.indexOf(':');
          if (colonIdx > 0) {
            teacherSubjects.push(part.substring(0, colonIdx).trim());
          }
        });

        let mainDept = '';
        parts.forEach(part => {
          const colonIdx = part.indexOf(':');
          if (colonIdx > 0) {
            const subject = part.substring(0, colonIdx).trim();
            const classesStr = part.substring(colonIdx + 1).trim();
            const classList = classesStr.split(',').map(c => c.trim()).filter(Boolean);

            if (!mainDept && !subject.includes('địa phương') && !subject.includes('trải nghiệm')) {
              mainDept = inferDepartmentFromSubject(subject, teacherSubjects, teacherName);
            }

            classList.forEach(cls => {
              detectedClasses.add(cls);
              newAssignments.push({
                teacherId: 'GV_ASG',
                teacherName: teacherName,
                subject: subject,
                className: cls
              });
            });
          }
        });
        if (mainDept) teacherDeptMap[teacherName] = mainDept;
      } else {
        const subject = findColumnValue(row, ['môn giảng dạy', 'môn học', 'môn', 'học phần', 'subject', 'nội dung']) || 'Tài liệu photo';
        const className = findColumnValue(row, ['lớp dạy', 'lớp', 'tên lớp', 'class', 'classname']);
        if (className) {
          detectedClasses.add(className);
          newAssignments.push({
            teacherId: 'GV_ASG',
            teacherName: teacherName,
            subject: subject,
            className: className
          });
          teacherDeptMap[teacherName] = inferDepartmentFromSubject(subject, [subject], teacherName);
        }
      }
    });

    return { newAssignments, teacherDeptMap, detectedClasses };
  };

  // Cập nhật phân công, tự động đồng bộ tổ của giáo viên và danh sách lớp học
  const applyAssignmentsData = (parsedResult) => {
    const { newAssignments, teacherDeptMap, detectedClasses } = parsedResult;

    setAssignments(newAssignments);

    // 1. Tự động đồng bộ và gán tổ cho giáo viên
    setTeachers(prev => {
      if (prev.length === 0) {
        return Object.keys(teacherDeptMap).map((name, idx) => ({
          id: `GV${idx + 1}`,
          name: name,
          dept: teacherDeptMap[name] || 'Chưa phân tổ',
          phone: '---'
        }));
      }
      return prev.map(t => {
        if (teacherDeptMap[t.name]) {
          return { ...t, dept: teacherDeptMap[t.name] };
        }
        if (t.name.toLowerCase().includes('thoa')) {
          return { ...t, dept: 'Tổ Ngoại Ngữ' };
        }
        if (t.name.toLowerCase().includes('đăng') || t.name.toLowerCase().includes('tuyến')) {
          return { ...t, dept: 'Tổ Sinh - CNNN' };
        }
        return t;
      });
    });

    // 2. Tự động bổ sung các lớp học nếu chưa có trong danh sách
    setClasses(prev => {
      const existingNames = new Set(prev.map(c => c.className));
      const newClassesToAdd = [];
      detectedClasses.forEach(cls => {
        if (!existingNames.has(cls)) {
          const grade = cls.startsWith('10') ? '10' : cls.startsWith('11') ? '11' : '12';
          newClassesToAdd.push({
            className: cls,
            studentCount: 42,
            homeroomTeacher: 'Chưa xếp',
            grade: grade
          });
        }
      });
      return [...prev, ...newClassesToAdd].sort((a, b) => a.className.localeCompare(b.className));
    });
  };

  // Nạp trực tiếp file bang_phan_cong_giang_day.xls có sẵn
  const handleLoadAvailableAssignmentsFile = async () => {
    try {
      const res = await fetch('/bang_phan_cong_giang_day.xls');
      const arrayBuffer = await res.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type: 'array' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);

      const parsedResult = parseAssignmentsFromRawData(data);
      applyAssignmentsData(parsedResult);

      setImportMessage(`Đã nạp thành công ${parsedResult.newAssignments.length} phân công và tự động gán tổ cho ${Object.keys(parsedResult.teacherDeptMap).length} giáo viên!`);
      setTimeout(() => setImportMessage(''), 4500);
    } catch (err) {
      console.error(err);
      alert('Không thể nạp tự động file. Vui lòng bấm "Nạp Từ File Excel" và chọn file bang_phan_cong_giang_day.xls.');
    }
  };

  // Nạp trực tiếp file lop_hoc.xls có sẵn
  const handleLoadAvailableClassesFile = async () => {
    try {
      const res = await fetch('/lop_hoc.xls');
      const arrayBuffer = await res.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type: 'array' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);

      const parsed = data.map(row => {
        const className = findColumnValue(row, ['tên lớp', 'lớp', 'class', 'classname']);
        const studentCount = Number(findColumnValue(row, ['sỹ số', 'sĩ số', 'sỹ số học sinh', 'sĩ số học sinh', 'số lượng', 'học sinh', 'siso', 'syso', 'count'])) || 40;
        const homeroomTeacher = findColumnValue(row, ['giáo viên chủ nhiệm', 'họ tên gvcn', 'gvcn', 'chủ nhiệm', 'gv chủ nhiệm']) || 'Chưa xếp';
        const grade = findColumnValue(row, ['khối học', 'khối', 'khối lớp', 'grade']) || (className ? className.slice(0, 2) : '10');
        return {
          className,
          studentCount,
          homeroomTeacher,
          grade
        };
      }).filter(c => c.className);

      setClasses(parsed);
      setImportMessage(`Đã nạp thành công ${parsed.length} lớp học kèm Sĩ số và GVCN từ file lop_hoc.xls!`);
      setTimeout(() => setImportMessage(''), 4500);
    } catch (err) {
      console.error(err);
      alert('Không thể nạp tự động file lop_hoc.xls. Vui lòng bấm "Nạp Từ File Excel" và chọn file từ máy.');
    }
  };

  // Generic File Upload Handler linh hoạt
  const handleFileUpload = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (type === 'teachers') {
          const parsed = data.map((row, idx) => {
            const name = findColumnValue(row, ['họ và tên', 'họ tên', 'tên giáo viên', 'tên gv', 'họ tên giáo viên', 'tên', 'fullname', 'name', 'hoten']) || `GV ${idx + 1}`;
            let dept = findColumnValue(row, ['tổ chuyên môn', 'tổ bộ môn', 'tổ', 'chuyên môn', 'bộ môn', 'phòng ban', 'khoa', 'department']);
            if (!dept || dept === 'Chưa phân tổ') {
              dept = inferDepartmentFromSubject('', [], name);
            }
            const phone = findColumnValue(row, ['số điện thoại', 'điện thoại', 'sđt', 'sdt', 'phone', 'mobile', 'tel']) || '---';
            return { id, name, dept, phone };
          }).filter(t => t.name && t.name !== 'Chưa rõ tên');

          setTeachers(parsed);
          setImportMessage(`Đã nạp thành công ${parsed.length} giáo viên từ file Excel!`);
        } else if (type === 'assignments') {
          const parsedResult = parseAssignmentsFromRawData(data);
          applyAssignmentsData(parsedResult);
          setImportMessage(`Đã nạp thành công ${parsedResult.newAssignments.length} phân công và tự động đồng bộ tổ cho ${Object.keys(parsedResult.teacherDeptMap).length} giáo viên!`);
        } else if (type === 'classes') {
          const parsed = data.map(row => {
            const className = findColumnValue(row, ['tên lớp', 'lớp', 'class', 'classname']);
            const studentCount = Number(findColumnValue(row, ['sỹ số', 'sĩ số', 'sỹ số học sinh', 'sĩ số học sinh', 'số lượng', 'học sinh', 'siso', 'syso', 'count'])) || 40;
            const homeroomTeacher = findColumnValue(row, ['giáo viên chủ nhiệm', 'họ tên gvcn', 'gvcn', 'chủ nhiệm', 'gv chủ nhiệm']) || 'Chưa xếp';
            const grade = findColumnValue(row, ['khối học', 'khối', 'khối lớp', 'grade']) || (className ? className.slice(0, 2) : '10');
            return {
              className,
              studentCount,
              homeroomTeacher,
              grade
            };
          }).filter(c => c.className);

          setClasses(parsed);
          setImportMessage(`Đã nạp thành công ${parsed.length} lớp học, Sĩ số và GVCN từ file Excel!`);
        }

        setTimeout(() => setImportMessage(''), 4500);
      } catch (err) {
        console.error(err);
        alert('Lỗi đọc file Excel. Vui lòng kiểm tra file có đúng định dạng .xlsx hoặc .xls không.');
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="neu-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Title */}
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          borderBottom: '2px solid #d8e2ef', 
          paddingBottom: '16px',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div 
            className="neu-card-sm" 
            style={{ width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}
          >
            <SettingsIcon size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text-bold)' }}>
              DASHBOARD ADMIN: CẤU HÌNH MASTER DATA & CSDL GOOGLE SHEETS
            </h2>
            <p style={{ fontSize: '13.5px', color: 'var(--text-sub)' }}>
              Quản trị danh sách giáo viên, phân công dạy, sĩ số lớp, GVCN và thiết lập lưu trữ Drive
            </p>
          </div>
        </div>

        {importMessage && (
          <div 
            className="neu-card-sm"
            style={{ 
              padding: '8px 16px', 
              fontSize: '13.5px', 
              color: 'var(--color-success)', 
              fontWeight: 'bold',
              background: '#f0f9f4' 
            }}
          >
            <CheckCircle size={16} style={{ display: 'inline', marginRight: '6px' }} />
            {importMessage}
          </div>
        )}
      </div>

      {/* Admin Sub-navigation Tabs */}
      <div className="nav-tab-container" style={{ flexWrap: 'wrap' }}>
        <button 
          className={`nav-tab ${activeAdminSubTab === 'teachers' ? 'active' : ''}`}
          onClick={() => setActiveAdminSubTab('teachers')}
        >
          <Users size={16} />
          <span>1. Danh Sách Giáo Viên ({teachers.length})</span>
        </button>

        <button 
          className={`nav-tab ${activeAdminSubTab === 'assignments' ? 'active' : ''}`}
          onClick={() => setActiveAdminSubTab('assignments')}
        >
          <BookOpen size={16} />
          <span>2. Phân Công Giảng Dạy ({assignments.length})</span>
        </button>

        <button 
          className={`nav-tab ${activeAdminSubTab === 'classes' ? 'active' : ''}`}
          onClick={() => setActiveAdminSubTab('classes')}
        >
          <GraduationCap size={16} />
          <span>3. Sĩ Số & GVCN Lớp ({classes.length})</span>
        </button>

        <button 
          className={`nav-tab ${activeAdminSubTab === 'database' ? 'active' : ''}`}
          onClick={() => setActiveAdminSubTab('database')}
        >
          <HardDrive size={16} />
          <span>4. Cấu Hình CSDL Google Drive</span>
        </button>

        <button 
          className={`nav-tab ${activeAdminSubTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveAdminSubTab('settings')}
        >
          <SettingsIcon size={16} />
          <span>5. Cài Đặt Chung</span>
        </button>
      </div>

      {/* SUB-TAB 1: TEACHERS */}
      {activeAdminSubTab === 'teachers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Action & Import Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-bold)' }}>
              Danh Sách Giáo Viên Kèm Tổ Chuyên Môn ({teachers.length} giáo viên)
            </h3>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button 
                onClick={handleLoadAvailableTeacherFile} 
                className="neu-btn neu-btn-success" 
                style={{ fontSize: '13px' }}
                title="Tự động nạp 63 giáo viên từ file giao_vien.xls trong thư mục dự án"
              >
                <CheckCircle size={15} />
                <span>Nạp Ngay File "giao_vien.xls" Có Sẵn</span>
              </button>

              <button onClick={handleDownloadTeacherTemplate} className="neu-btn" style={{ fontSize: '13px' }}>
                <Download size={15} />
                <span>Tải File Mẫu Excel</span>
              </button>

              <label className="neu-btn neu-btn-primary" style={{ fontSize: '13px', cursor: 'pointer' }}>
                <Upload size={15} />
                <span>Nạp Từ File Excel</span>
                <input 
                  type="file" 
                  accept=".xlsx, .xls, .csv" 
                  style={{ display: 'none' }} 
                  onChange={(e) => handleFileUpload(e, 'teachers')} 
                />
              </label>
            </div>
          </div>


          {/* Quick Add Form */}
          <form 
            onSubmit={handleAddTeacher}
            className="neu-card-sm"
            style={{ padding: '14px', display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}
          >
            <div style={{ flex: '2', minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Họ Và Tên GV:</label>
              <input 
                type="text" 
                className="neu-input" 
                placeholder="Ví dụ: Lê Thị Thanh Thảo"
                value={newTeacher.name}
                onChange={e => setNewTeacher({ ...newTeacher, name: e.target.value })}
                required
              />
            </div>
            <div style={{ flex: '2', minWidth: '220px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Tổ Chuyên Môn:</label>
              <select 
                className="neu-select"
                value={newTeacher.dept}
                onChange={e => setNewTeacher({ ...newTeacher, dept: e.target.value })}
              >
                {departments.filter(d => d !== 'Tất cả các tổ').map((dept, i) => (
                  <option key={i} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: '1', minWidth: '140px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Số Điện Thoại:</label>
              <input 
                type="text" 
                className="neu-input" 
                placeholder="09..."
                value={newTeacher.phone}
                onChange={e => setNewTeacher({ ...newTeacher, phone: e.target.value })}
              />
            </div>
            <button type="submit" className="neu-btn neu-btn-primary" style={{ padding: '8px 18px', fontSize: '13.5px' }}>
              <Plus size={16} />
              <span>Thêm GV</span>
            </button>
          </form>

          {/* Teachers Table with Editable Cells */}
          <div className="excel-table-container" style={{ maxHeight: '440px' }}>
            <table className="excel-table">
              <thead>
                <tr>
                  <th style={{ width: '45px' }}>STT</th>
                  <th style={{ width: '130px' }}>Mã / Số Định Danh</th>
                  <th>Họ Và Tên Giáo Viên (Có thể sửa)</th>
                  <th style={{ width: '250px' }}>Tổ Chuyên Môn (Chọn trực tiếp)</th>
                  <th style={{ width: '130px' }}>Số Điện Thoại</th>
                  <th style={{ width: '50px' }}>Xóa</th>
                </tr>
              </thead>
              <tbody>
                {teachers.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                      Chưa có giáo viên nào. Bấm <b>"Nạp Ngay File 'giao_vien.xls' Có Sẵn"</b> hoặc <b>"Nạp Từ File Excel"</b> ở trên.
                    </td>
                  </tr>
                ) : (
                  teachers.map((teacher, idx) => {
                    return (
                      <tr key={teacher.id || idx}>
                        <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                        <td style={{ textAlign: 'center', fontWeight: '600', fontSize: '13px' }}>{teacher.id}</td>
                          <td style={{ fontWeight: 'bold', color: 'var(--text-bold)' }}>
                            <input 
                              type="text"
                              className="excel-cell-input"
                              value={teacher.name}
                              onChange={(e) => {
                                const val = e.target.value;
                                setTeachers(prev => prev.map(t => t.id === teacher.id ? { ...t, name: val } : t));
                              }}
                              style={{ fontWeight: 'bold' }}
                            />
                          </td>
                          <td>
                            <select 
                              className="neu-select"
                              value={teacher.dept}
                              onChange={(e) => {
                                const val = e.target.value;
                                setTeachers(prev => prev.map(t => t.id === teacher.id ? { ...t, dept: val } : t));
                              }}
                              style={{ padding: '3px 8px', fontSize: '13px' }}
                            >
                              {departments.filter(d => d !== 'Tất cả các tổ').map((dept, i) => (
                                <option key={i} value={dept}>{dept}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input 
                              type="text"
                              className="excel-cell-input"
                              value={teacher.phone}
                              onChange={(e) => {
                                const val = e.target.value;
                                setTeachers(prev => prev.map(t => t.id === teacher.id ? { ...t, phone: val } : t));
                              }}
                            />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button 
                              onClick={() => setTeachers(prev => prev.filter(t => t.id !== teacher.id))}
                              style={{ border: 'none', background: 'transparent', color: 'var(--color-danger)', cursor: 'pointer' }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: ASSIGNMENTS */}
      {activeAdminSubTab === 'assignments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-bold)' }}>
                Bảng Phân Công Giảng Dạy ({assignments.length} phân công)
              </h3>
              <p style={{ fontSize: '12.5px', color: 'var(--text-sub)' }}>
                Tự động suy luận Tổ chuyên môn của GV và danh sách lớp học
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button 
                onClick={handleLoadAvailableAssignmentsFile} 
                className="neu-btn neu-btn-success" 
                style={{ fontSize: '13px' }}
                title="Tự động nạp phân công từ file bang_phan_cong_giang_day.xls và gán tổ cho giáo viên"
              >
                <CheckCircle size={15} />
                <span>Nạp Ngay File "bang_phan_cong_giang_day.xls" Có Sẵn</span>
              </button>

              <button onClick={handleDownloadAssignmentTemplate} className="neu-btn" style={{ fontSize: '13px' }}>
                <Download size={15} />
                <span>Tải File Mẫu Phân Công</span>
              </button>

              <label className="neu-btn neu-btn-primary" style={{ fontSize: '13px', cursor: 'pointer' }}>
                <Upload size={15} />
                <span>Nạp Từ File Excel</span>
                <input 
                  type="file" 
                  accept=".xlsx, .xls, .csv" 
                  style={{ display: 'none' }} 
                  onChange={(e) => handleFileUpload(e, 'assignments')} 
                />
              </label>
            </div>
          </div>

          {/* Search Bar for Assignments */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ position: 'relative', width: '280px' }}>
              <input 
                type="text"
                className="neu-input"
                placeholder="Tìm GV, môn học, lớp dạy..."
                value={assignmentSearch}
                onChange={e => setAssignmentSearch(e.target.value)}
                style={{ padding: '6px 10px 6px 30px', fontSize: '13px' }}
              />
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5, fontSize: '12px' }}>🔍</span>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--text-sub)' }}>
              Hiển thị <b>{assignments.filter(a => !assignmentSearch.trim() || fuzzyVietnameseMatch(a.teacherName, assignmentSearch) || fuzzyVietnameseMatch(a.subject, assignmentSearch) || fuzzyVietnameseMatch(a.className, assignmentSearch)).length}</b> / {assignments.length} phân công
            </div>
          </div>

          {/* Quick Add Assignment */}
          <form 
            onSubmit={handleAddAssignment}
            className="neu-card-sm"
            style={{ padding: '14px', display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}
          >
            <div style={{ flex: '2', minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Chọn Giáo Viên:</label>
              <select 
                className="neu-select"
                value={newAssignment.teacherName}
                onChange={e => setNewAssignment({ ...newAssignment, teacherName: e.target.value })}
              >
                {teachers.length === 0 ? (
                  <option value="">-- Chưa có giáo viên (Vui lòng thêm ở Tab 1) --</option>
                ) : (
                  teachers.map((t, idx) => (
                    <option key={idx} value={t.name}>{t.name} ({t.dept})</option>
                  ))
                )}
              </select>
            </div>
            <div style={{ flex: '2', minWidth: '180px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Môn Giảng Dạy:</label>
              <input 
                type="text" 
                className="neu-input" 
                placeholder="Ví dụ: Toán Học / Tiếng Anh"
                value={newAssignment.subject}
                onChange={e => setNewAssignment({ ...newAssignment, subject: e.target.value })}
                required
              />
            </div>
            <div style={{ flex: '1', minWidth: '120px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Lớp Dạy:</label>
              <select 
                className="neu-select"
                value={newAssignment.className}
                onChange={e => setNewAssignment({ ...newAssignment, className: e.target.value })}
              >
                {classes.length === 0 ? (
                  <option value="">-- Chưa có lớp (Vui lòng thêm ở Tab 3) --</option>
                ) : (
                  classes.map((c, idx) => (
                    <option key={idx} value={c.className}>{c.className}</option>
                  ))
                )}
              </select>
            </div>
            <button type="submit" className="neu-btn neu-btn-primary" style={{ padding: '8px 18px', fontSize: '13.5px' }}>
              <Plus size={16} />
              <span>Thêm Phân Công</span>
            </button>
          </form>

          {/* Assignments Table */}
          <div className="excel-table-container" style={{ maxHeight: '440px' }}>
            <table className="excel-table">
              <thead>
                <tr>
                  <th style={{ width: '50px' }}>STT</th>
                  <th>Họ Tên Giáo Viên</th>
                  <th style={{ width: '220px' }}>Tổ Chuyên Môn (Gợi ý)</th>
                  <th>Môn Giảng Dạy</th>
                  <th style={{ width: '120px' }}>Lớp Phụ Trách</th>
                  <th style={{ width: '60px' }}>Xóa</th>
                </tr>
              </thead>
              <tbody>
                {assignments.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                      Chưa có phân công nào. Bấm <b>"Nạp Ngay File 'bang_phan_cong_giang_day.xls' Có Sẵn"</b> hoặc nạp từ file Excel ở trên.
                    </td>
                  </tr>
                ) : (
                  assignments
                    .filter(a => !assignmentSearch.trim() || fuzzyVietnameseMatch(a.teacherName, assignmentSearch) || fuzzyVietnameseMatch(a.subject, assignmentSearch) || fuzzyVietnameseMatch(a.className, assignmentSearch))
                    .map((asg, idx) => {
                      const teacher = teachers.find(t => t.name === asg.teacherName);
                      return (
                        <tr key={idx}>
                          <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                          <td style={{ fontWeight: '600' }}>{asg.teacherName}</td>
                          <td style={{ color: 'var(--color-primary)', fontWeight: '600', fontSize: '13px' }}>
                            {teacher?.dept || inferDepartmentFromSubject(asg.subject)}
                          </td>
                          <td>{asg.subject}</td>
                          <td style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                            Lớp {asg.className}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button 
                              onClick={() => setAssignments(prev => prev.filter((_, i) => i !== idx))}
                              style={{ border: 'none', background: 'transparent', color: 'var(--color-danger)', cursor: 'pointer' }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: CLASSES & HOMEROOM */}
      {activeAdminSubTab === 'classes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-bold)' }}>
                Danh Sách Sĩ Số Lớp Học & Giáo Viên Chủ Nhiệm (GVCN) ({classes.length} lớp)
              </h3>
              <p style={{ fontSize: '12.5px', color: 'var(--text-sub)' }}>
                Sĩ số lớp sẽ tự động áp dụng khi photo tài liệu và tính thành tiền
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button 
                onClick={handleLoadAvailableClassesFile} 
                className="neu-btn neu-btn-success" 
                style={{ fontSize: '13px' }}
                title="Tự động nạp 30 lớp học kèm Sĩ số và GVCN từ file lop_hoc.xls trong thư mục"
              >
                <CheckCircle size={15} />
                <span>Nạp Ngay File "lop_hoc.xls" Có Sẵn</span>
              </button>

              <button onClick={handleDownloadClassTemplate} className="neu-btn" style={{ fontSize: '13px' }}>
                <Download size={15} />
                <span>Tải File Mẫu Sĩ Số</span>
              </button>

              <label className="neu-btn neu-btn-primary" style={{ fontSize: '13px', cursor: 'pointer' }}>
                <Upload size={15} />
                <span>Nạp Từ File Excel</span>
                <input 
                  type="file" 
                  accept=".xlsx, .xls, .csv" 
                  style={{ display: 'none' }} 
                  onChange={(e) => handleFileUpload(e, 'classes')} 
                />
              </label>
            </div>
          </div>

          {/* Search Bar for Classes */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ position: 'relative', width: '280px' }}>
              <input 
                type="text"
                className="neu-input"
                placeholder="Tìm tên lớp, GVCN, khối..."
                value={classSearch}
                onChange={e => setClassSearch(e.target.value)}
                style={{ padding: '6px 10px 6px 30px', fontSize: '13px' }}
              />
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5, fontSize: '12px' }}>🔍</span>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--text-sub)' }}>
              Hiển thị <b>{classes.filter(c => !classSearch.trim() || fuzzyVietnameseMatch(c.className, classSearch) || fuzzyVietnameseMatch(c.homeroomTeacher, classSearch) || fuzzyVietnameseMatch(c.grade, classSearch)).length}</b> / {classes.length} lớp học
            </div>
          </div>

          {/* Quick Add Class */}
          <form 
            onSubmit={handleAddClass}
            className="neu-card-sm"
            style={{ padding: '14px', display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}
          >
            <div style={{ flex: '1', minWidth: '120px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Tên Lớp:</label>
              <input 
                type="text" 
                className="neu-input" 
                placeholder="VD: 10A4"
                value={newClass.className}
                onChange={e => setNewClass({ ...newClass, className: e.target.value })}
                required
              />
            </div>
            <div style={{ flex: '1', minWidth: '100px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Sĩ Số (hs):</label>
              <input 
                type="number" 
                min="1"
                max="60"
                className="neu-input" 
                value={newClass.studentCount}
                onChange={e => setNewClass({ ...newClass, studentCount: e.target.value })}
                required
              />
            </div>
            <div style={{ flex: '2', minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Họ Tên GVCN:</label>
              <input 
                type="text" 
                className="neu-input" 
                placeholder="VD: Thầy Nguyễn Văn An"
                value={newClass.homeroomTeacher}
                onChange={e => setNewClass({ ...newClass, homeroomTeacher: e.target.value })}
              />
            </div>
            <div style={{ flex: '1', minWidth: '100px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Khối:</label>
              <select 
                className="neu-select"
                value={newClass.grade}
                onChange={e => setNewClass({ ...newClass, grade: e.target.value })}
              >
                <option value="10">Khối 10</option>
                <option value="11">Khối 11</option>
                <option value="12">Khối 12</option>
              </select>
            </div>
            <button type="submit" className="neu-btn neu-btn-primary" style={{ padding: '8px 18px', fontSize: '13.5px' }}>
              <Plus size={16} />
              <span>Thêm Lớp</span>
            </button>
          </form>

          {/* Classes Table */}
          <div className="excel-table-container" style={{ maxHeight: '440px' }}>
            <table className="excel-table">
              <thead>
                <tr>
                  <th style={{ width: '50px' }}>STT</th>
                  <th style={{ width: '90px' }}>Khối</th>
                  <th style={{ width: '120px' }}>Tên Lớp</th>
                  <th style={{ width: '130px' }}>Sĩ Số (Có thể sửa)</th>
                  <th>Giáo Viên Chủ Nhiệm (Có thể sửa)</th>
                  <th style={{ width: '60px' }}>Xóa</th>
                </tr>
              </thead>
              <tbody>
                {classes.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                      Chưa có lớp học nào. Bấm <b>"Nạp Ngay File 'lop_hoc.xls' Có Sẵn"</b> hoặc nạp từ file Excel ở trên.
                    </td>
                  </tr>
                ) : (
                  classes
                    .filter(c => !classSearch.trim() || fuzzyVietnameseMatch(c.className, classSearch) || fuzzyVietnameseMatch(c.homeroomTeacher, classSearch) || fuzzyVietnameseMatch(c.grade, classSearch))
                    .map((cls, idx) => (
                      <tr key={idx}>
                        <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                        <td style={{ textAlign: 'center' }}>Khối {cls.grade}</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--color-primary)', fontSize: '15px' }}>
                          {cls.className}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                          <input 
                            type="number"
                            className="excel-cell-input"
                            value={cls.studentCount}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              setClasses(prev => prev.map((c, i) => i === idx ? { ...c, studentCount: val } : c));
                            }}
                            style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--color-primary-dark)' }}
                          />
                        </td>
                        <td style={{ fontWeight: '600' }}>
                          <input 
                            type="text"
                            className="excel-cell-input"
                            value={cls.homeroomTeacher}
                            onChange={(e) => {
                              const val = e.target.value;
                              setClasses(prev => prev.map((c, i) => i === idx ? { ...c, homeroomTeacher: val } : c));
                            }}
                          />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button 
                            onClick={() => setClasses(prev => prev.filter((_, i) => i !== idx))}
                            style={{ border: 'none', background: 'transparent', color: 'var(--color-danger)', cursor: 'pointer' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: GOOGLE DRIVE & GOOGLE SHEETS DATABASE */}
      {activeAdminSubTab === 'database' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Drive Folder Box */}
          <div 
            className="neu-card-sm"
            style={{ 
              padding: '18px', 
              background: 'linear-gradient(135deg, #e4ecf7, #f1f6fd)', 
              borderRadius: '14px',
              borderLeft: '5px solid var(--color-primary)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ fontSize: '16.5px', fontWeight: 'bold', color: 'var(--text-bold)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <HardDrive size={18} color="var(--color-primary)" />
                  Thư Mục Google Drive Đích:
                </h3>
                <p style={{ fontSize: '13.5px', color: 'var(--text-sub)', marginTop: '4px' }}>
                  ID Thư mục: <code style={{ background: '#ffffff', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>{settings.driveFolderId}</code>
                </p>
              </div>

              <a 
                href={settings.driveFolderUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="neu-btn neu-btn-primary"
                style={{ fontSize: '13.5px', padding: '8px 16px' }}
              >
                <ExternalLink size={15} />
                <span>Mở Thư Mục Google Drive</span>
              </a>
            </div>
          </div>

          {/* Web App URL Config */}
          <div className="neu-card-sm" style={{ padding: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>
              URL Google Apps Script Web App (API Endpoint):
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input 
                type="text"
                className="neu-input"
                placeholder="Dán URL Web App (VD: https://script.google.com/macros/s/AKfycb.../exec)"
                value={settings.gasWebAppUrl || ''}
                onChange={(e) => setSettings({ ...settings, gasWebAppUrl: e.target.value })}
                style={{ flex: '1' }}
              />
              <button 
                onClick={() => {
                  localStorage.setItem('photo_settings', JSON.stringify(settings));
                  alert('Đã lưu URL kết nối CSDL Google Drive thành công!');
                }}
                className="neu-btn neu-btn-primary"
                style={{ padding: '8px 18px', fontSize: '13.5px' }}
              >
                <Save size={16} />
                <span>Lưu URL</span>
              </button>
            </div>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '6px' }}>
              Khi lưu URL, mỗi lần nhấn nút "Lưu CSDL" ở thanh tiêu đề, toàn bộ bảng tính sẽ được ghi tự động vào Google Sheet trên Drive.
            </p>
          </div>

          {/* Google Sheets Direct File URL Config */}
          <div className="neu-card-sm" style={{ padding: '16px', marginTop: '12px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>
              Link Trực Tiếp File Google Sheets (CSDL) để mở nhanh:
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input 
                type="text"
                className="neu-input"
                placeholder="Dán link file Google Sheets (VD: https://docs.google.com/spreadsheets/d/.../edit)"
                value={settings.sheetUrl || ''}
                onChange={(e) => setSettings({ ...settings, sheetUrl: e.target.value })}
                style={{ flex: '1' }}
              />
              <button 
                onClick={() => {
                  localStorage.setItem('photo_settings', JSON.stringify(settings));
                  alert('Đã lưu Link Google Sheets thành công!');
                }}
                className="neu-btn neu-btn-primary"
                style={{ padding: '8px 18px', fontSize: '13.5px' }}
              >
                <Save size={16} />
                <span>Lưu Link</span>
              </button>
              <button 
                onClick={() => {
                  const url = settings.sheetUrl || settings.driveFolderUrl;
                  if (url) window.open(url, '_blank');
                }}
                className="neu-btn"
                title="Mở bảng tính Google Sheets này trong tab mới"
                style={{ padding: '8px 16px', fontSize: '13.5px', color: '#065f46', fontWeight: 'bold' }}
              >
                <ExternalLink size={16} />
                <span>Mở Thử</span>
              </button>
            </div>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '6px' }}>
              Link này dùng cho nút <strong>"Xem CSDL"</strong> ở thanh tiêu đề trên cùng để mở ngay file Google Sheet bảng tính của bạn.
            </p>
          </div>

          {/* Guide and GAS Code Generator */}
          <div className="neu-card-sm" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-bold)' }}>
                  Mã Nguồn Google Apps Script (Sẵn Sàng Triển Khai 1-Chạm)
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--text-sub)' }}>
                  Tạo 1 Google Sheet trong thư mục Drive chỉ định $\rightarrow$ Tiện ích mở rộng (Extensions) $\rightarrow$ Apps Script $\rightarrow$ Dán mã dưới đây $\rightarrow$ Triển khai dưới dạng Web App.
                </p>
              </div>

              <button 
                onClick={handleCopyCode}
                className="neu-btn"
                style={{ fontSize: '13px', padding: '8px 14px' }}
              >
                {copySuccess ? <CheckCircle size={15} color="var(--color-success)" /> : <Copy size={15} />}
                <span>{copySuccess ? 'Đã Sao Chép!' : 'Sao Chép Mã Script'}</span>
              </button>
            </div>

            <textarea 
              readOnly
              value={gasScriptCode}
              style={{
                width: '100%',
                height: '220px',
                fontFamily: 'Consolas, monospace',
                fontSize: '12.5px',
                padding: '12px',
                borderRadius: '8px',
                background: '#1a2233',
                color: '#8be9fd',
                border: '1px solid #334460',
                outline: 'none',
                resize: 'vertical'
              }}
            />
          </div>
        </div>
      )}

      {/* SUB-TAB 5: GENERAL SETTINGS */}
      {activeAdminSubTab === 'settings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '680px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-bold)' }}>
            Cấu Hình Hệ Thống & Đơn Giá Mặc Định
          </h3>

          <div>
            <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 'bold', marginBottom: '4px' }}>
              Tên Cơ Quan / Trường Học (Để trống nếu không hiển thị):
            </label>
            <input 
              type="text"
              className="neu-input"
              placeholder="Để trống nếu không hiển thị tên trường"
              value={settings.schoolName || ''}
              onChange={(e) => setSettings({ ...settings, schoolName: e.target.value })}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 'bold', marginBottom: '4px' }}>
              Tên Bộ Phận / Tổ Thực Hiện:
            </label>
            <input 
              type="text"
              className="neu-input"
              value={settings.departmentName}
              onChange={(e) => setSettings({ ...settings, departmentName: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', gap: '15px' }}>
            <div style={{ flex: '1' }}>
              <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 'bold', marginBottom: '4px' }}>
                Đơn Giá Photo Mặc Định (VNĐ / trang):
              </label>
              <input 
                type="number"
                step="380"
                min="0"
                className="neu-input"
                value={settings.defaultUnitPrice}
                onChange={(e) => setSettings({ ...settings, defaultUnitPrice: Number(e.target.value) || 380 })}
              />
            </div>
            <div style={{ flex: '1' }}>
              <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 'bold', marginBottom: '4px' }}>
                Niên Khóa Hiện Hành:
              </label>
              <input 
                type="text"
                className="neu-input"
                value={settings.schoolYear}
                onChange={(e) => setSettings({ ...settings, schoolYear: e.target.value })}
              />
            </div>
          </div>

          <div style={{ marginTop: '10px', display: 'flex', gap: '15px', alignItems: 'center' }}>
            <button 
              onClick={() => alert('Đã lưu các thiết lập hệ thống thành công!')}
              className="neu-btn neu-btn-primary"
              style={{ padding: '9px 24px', fontSize: '14.5px' }}
            >
              <Save size={16} />
              <span>Lưu Cấu Hình</span>
            </button>

            <button 
              onClick={resetAllDataToEmpty}
              className="neu-btn"
              style={{ padding: '9px 18px', fontSize: '13.5px', color: 'var(--color-danger)' }}
              title="Xóa trắng toàn bộ danh sách giáo viên, lớp, phân công và bảng tính"
            >
              <Trash2 size={16} />
              <span>Xóa Sạch Dữ Liệu (Reset Trắng)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
