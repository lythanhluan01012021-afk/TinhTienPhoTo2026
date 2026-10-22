/**
 * GOOGLE APPS SCRIPT - CƠ SỞ DỮ LIỆU TÍNH TIỀN PHOTO TRƯỜNG HỌC (PHIÊN BẢN 2.0)
 * ==============================================================================
 * TÍNH NĂNG NÂNG CẤP MỚI:
 * 1. ĐỒNG BỘ 2 CHIỀU: Hỗ trợ đọc dữ liệu từ Sheet về Web App (fetchBillingData).
 * 2. CƠ CHẾ UPSERT (CẬP NHẬT HOẶC THÊM MỚI): 
 *    - Tự động tìm Mã Giao Dịch (Cột A) để cập nhật nội dung (tên tài liệu, số lượng, trạng thái).
 *    - Tuyệt đối KHÔNG sinh dòng trùng lặp khi lưu nhiều lần.
 * 3. HỖ TRỢ TRẠNG THÁI TIẾN ĐỘ: Chờ gửi tài liệu -> Đang photo -> Đã xong -> Đã thanh toán.
 * 4. TỰ ĐỘNG DỌN DẸP TRÙNG LẶP (cleanDuplicates): Xóa sạch các dòng trùng lặp sẵn có.
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
        var statusLabel = item.statusLabel || item.status || (item.isPaid ? "Đã thanh toán" : "Chờ gửi tài liệu");

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
          statusLabel,
          item.note || ""
        ];

        // Nếu đã có ID trên Sheet -> CẬP NHẬT VÀO ĐÚNG DÒNG ĐÓ
        if (idToRowMap[cleanId]) {
          var targetRow = idToRowMap[cleanId];
          sheet.getRange(targetRow, 1, 1, 12).setValues([rowValues]);
          updatedCount++;
        } else {
          // Chưa có -> THÊM MỚI
          sheet.appendRow(rowValues);
          idToRowMap[cleanId] = sheet.getLastRow();
          insertedCount++;
        }
      });

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Đồng bộ thành công! Đã cập nhật " + updatedCount + " mục và thêm mới " + insertedCount + " mục.",
        updatedCount: updatedCount,
        insertedCount: insertedCount,
        totalItems: items.length
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
    if (!sheet || sheet.getLastRow() <= 1) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        items: [],
        count: 0
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var lastRow = sheet.getLastRow();
    var rows = sheet.getRange(2, 1, lastRow - 1, 12).getValues();
    var items = [];

    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!r[0] && !r[2]) continue; // Bỏ qua dòng trống

      var studentCount = Number(r[5]) || 0;
      var extraCount = Number(r[6]) || 0;
      var totalCopies = Number(r[7]) || (studentCount + extraCount);
      var unitPrice = Number(r[8]) || 380;
      var amount = Number(r[9]) || (totalCopies * unitPrice);
      var statusText = r[10] ? r[10].toString() : "Chờ gửi tài liệu";

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
        status: normalizeStatusKey(statusText),
        statusLabel: statusText,
        isPaid: statusText === "Đã thanh toán",
        note: r[11] ? r[11].toString() : ""
      });
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      items: items,
      count: items.length
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // MẶC ĐỊNH: BÁO TRẠNG THÁI HOẠT ĐỘNG
  var sheet = ss ? ss.getSheetByName("NhatKy_Photo") : null;
  var rowCount = sheet ? Math.max(0, sheet.getLastRow() - 1) : 0;
  var fileName = ss ? ss.getName() : "Chưa xác định";

  return ContentService.createTextOutput(
    "API Web App Tinh Tien Photo (v2.0) đang hoạt động hoàn hảo!\n" +
    "- File Google Sheet: " + fileName + "\n" +
    "- Số bản ghi photo hiện có: " + rowCount + " dòng\n" +
    "- Hỗ trợ: Đồng bộ 2 chiều (GET/POST) & Chống trùng lặp (Upsert)"
  ).setMimeType(ContentService.MimeType.TEXT);
}

// Hàm hỗ trợ lấy hoặc tạo sheet NhatKy_Photo
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

    sheet.appendRow([
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
      "Trạng Thái Đơn",
      "Ghi Chú"
    ]);

    sheet.getRange(1, 1, 1, 12)
         .setFontWeight("bold")
         .setBackground("#1b5ebe")
         .setFontColor("#ffffff")
         .setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
    sheet.setRowHeight(1, 35);
  }
  return sheet;
}

// Chuyển đổi nhãn tiếng Việt sang mã trạng thái
function normalizeStatusKey(label) {
  if (!label) return "CHO_TAI_LIEU";
  if (label.indexOf("Đang photo") !== -1 || label.indexOf("DANG_IN") !== -1) return "DANG_IN";
  if (label.indexOf("Đã photo xong") !== -1 || label.indexOf("HOAN_THANH") !== -1) return "HOAN_THANH";
  if (label.indexOf("Đã thanh toán") !== -1 || label.indexOf("DA_THANH_TOAN") !== -1) return "DA_THANH_TOAN";
  return "CHO_TAI_LIEU";
}

/**
 * HÀM TIỆN ÍCH DỌN DẸP DÒNG TRÙNG LẶP SẴN CÓ TRÊN GOOGLE SHEET:
 * (Bạn có thể bấm chạy hàm này trực tiếp trong Apps Script nếu sheet đang bị trùng lặp)
 */
function cleanDuplicates() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("NhatKy_Photo");
  if (!sheet) return;

  var lastRow = sheet.getLastRow();
  if (lastRow <= 2) return;

  var data = sheet.getRange(2, 1, lastRow - 1, 12).getValues();
  var seenIds = {};
  var rowsToDelete = [];

  for (var i = 0; i < data.length; i++) {
    var id = data[i][0] ? data[i][0].toString().trim() : "";
    if (!id) continue;

    if (seenIds[id]) {
      // Dòng này bị trùng lặp -> Đánh dấu để xóa (dòng thực tế = i + 2)
      rowsToDelete.push(i + 2);
    } else {
      seenIds[id] = true;
    }
  }

  // Xóa từ dưới lên trên để không làm lệch chỉ mục dòng
  for (var k = rowsToDelete.length - 1; k >= 0; k--) {
    sheet.deleteRow(rowsToDelete[k]);
  }

  Logger.log("Đã dọn dẹp xong! Đã xóa " + rowsToDelete.length + " dòng trùng lặp.");
}
