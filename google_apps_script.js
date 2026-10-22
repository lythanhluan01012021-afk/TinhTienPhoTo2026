/**
 * GOOGLE APPS SCRIPT - CƠ SỞ DỮ LIỆU TÍNH TIỀN PHOTO TRƯỜNG HỌC
 * ================================================================
 * Thư mục Drive: https://drive.google.com/drive/folders/19K5b-uR1La1UAUBOVoulYurXi0w97Efw?usp=sharing
 * Folder ID: 19K5b-uR1La1UAUBOVoulYurXi0w97Efw
 *
 * HƯỚNG DẪN CÀI ĐẶT 1-CHẠM:
 * 1. Mở Google Drive, vào thư mục trên, tạo 1 file Google Sheet mới (Đặt tên: CSDL_Photo_HocDuong).
 * 2. Trên thanh menu Google Sheet: Chọn 'Tiện ích mở rộng' (Extensions) -> 'Apps Script'.
 * 3. Xóa toàn bộ mã mặc định, dán toàn bộ nội dung file này vào.
 * 4. Bấm nút 'Triển khai' (Deploy) ở góc trên bên phải -> 'Triển khai mới' (New deployment).
 * 5. Chọn loại: 'Ứng dụng web' (Web App).
 *    - Mô tả: API Tinh Tien Photo
 *    - Thực thi dưới dạng: Tôi (email của bạn)
 *    - Ai có quyền truy cập: 'Bất kỳ ai' (Anyone)
 * 6. Bấm 'Triển khai' -> Cấp quyền cho Script nếu được hỏi -> Sao chép URL Web App tạo ra.
 * 7. Mở Trang 2 (Admin) của Web App Tính tiền Photo -> Dán URL vào ô 'URL Web App' và bấm Lưu.
 * ================================================================
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(15000); // Đảm bảo an toàn không bị xung đột khi nhiều người ghi đồng thời

  try {
    var rawData = e.postData.contents;
    var data = JSON.parse(rawData);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (data.action === "saveBillingData") {
      var sheet = ss.getSheetByName("NhatKy_Photo");
      if (!sheet) {
        // Nếu bảng tính mới chỉ có 1 sheet mặc định đang trống (Sheet1 hoặc Trang tính 1), đổi tên thành NhatKy_Photo luôn
        var sheets = ss.getSheets();
        if (sheets.length === 1 && sheets[0].getLastRow() === 0) {
          sheet = sheets[0];
          sheet.setName("NhatKy_Photo");
        } else {
          sheet = ss.insertSheet("NhatKy_Photo");
        }

        sheet.appendRow([
          "Mã Giao Dịch",
          "Thời Gian Ghi Nhận",
          "Giáo Viên",
          "Lớp",
          "Môn Học / Nội Dung",
          "Sĩ Số",
          "Số Lượng Lẻ",
          "Tổng Bản In",
          "Đơn Giá (VNĐ)",
          "Thành Tiền (VNĐ)",
          "Trạng Thái Thanh Toán",
          "Ghi Chú"
        ]);
        sheet.getRange(1, 1, 1, 12)
             .setFontWeight("bold")
             .setBackground("#1b5ebe")
             .setFontColor("#ffffff");
        sheet.setFrozenRows(1);
      }

      var items = data.items || [];
      var timestamp = new Date();
      
      items.forEach(function(item) {
        var totalCopies = (Number(item.studentCount) || 0) + (Number(item.extraCount) || 0);
        sheet.appendRow([
          item.id,
          timestamp,
          item.teacherName,
          item.className,
          item.subject,
          item.studentCount,
          item.extraCount,
          totalCopies,
          item.unitPrice,
          item.amount,
          item.isPaid ? "Đã thanh toán" : "Chưa thanh toán",
          item.note || ""
        ]);
      });

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Đã lưu " + items.length + " bản ghi photo vào Google Sheet thành công!",
        recordsCount: items.length
      })).setMimeType(ContentService.MimeType.JSON);
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
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss ? ss.getSheetByName("NhatKy_Photo") : null;
  var rows = sheet ? sheet.getLastRow() : 0;
  var name = ss ? ss.getName() : "Không xác định";
  return ContentService.createTextOutput("API Web App Tinh Tien Photo đang hoạt động hoàn hảo!\n- File: " + name + "\n- Số dòng dữ liệu trong NhatKy_Photo: " + rows)
    .setMimeType(ContentService.MimeType.TEXT);
}
