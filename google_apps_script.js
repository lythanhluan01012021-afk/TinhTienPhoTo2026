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

    // 1. ACTION: LƯU & CẬP NHẬT DỮ LIỆU PHOTO (ĐỒNG BỘ CHUẨN XÁC THEO TUẦN & ĐỊNH DẠNG TIỀN TỆ VNĐ)
    if (data.action === "saveBillingData") {
      var sheet = getOrCreatePhotoSheet(ss);
      var items = data.items || [];
      var targetWeek = data.currentWeek || "Tuần 1";
      var timestamp = new Date();

      var lastRow = sheet.getLastRow();
      var incomingIds = {};
      items.forEach(function(item) {
        if (item.id) {
          incomingIds[item.id.toString().trim()] = true;
        }
      });

      // BƯỚC 1: XÓA CÁC DÒNG CỦA targetWeek ĐÃ BỊ XÓA TRÊN WEB APP
      // (Duyệt ngược từ dưới lên để không làm nhảy chỉ mục dòng)
      if (lastRow > 1) {
        var existingData = sheet.getRange(2, 1, lastRow - 1, 11).getValues();
        for (var r = existingData.length - 1; r >= 0; r--) {
          var rowId = existingData[r][0] ? existingData[r][0].toString().trim() : "";
          var rowWeek = existingData[r][10] ? existingData[r][10].toString().trim() : "";
          var rowNumber = r + 2;

          // Nếu dòng này thuộc targetWeek đang lưu nhưng không có trong danh sách gửi lên -> Xóa khỏi Sheet
          if (rowWeek === targetWeek && rowId && !incomingIds[rowId]) {
            sheet.deleteRow(rowNumber);
          }
        }
      }

      // BƯỚC 2: CẬP NHẬT HOẶC THÊM MỚI (UPSERT)
      var currentLastRow = sheet.getLastRow();
      var idToRowMap = {};
      if (currentLastRow > 1) {
        var currentIds = sheet.getRange(2, 1, currentLastRow - 1, 1).getValues();
        for (var i = 0; i < currentIds.length; i++) {
          var val = currentIds[i][0];
          if (val) {
            idToRowMap[val.toString().trim()] = (i + 2);
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
        var weekLabel = targetWeek;

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

        if (idToRowMap[cleanId]) {
          var targetRow = idToRowMap[cleanId];
          sheet.getRange(targetRow, 1, 1, 11).setValues([rowValues]);
          updatedCount++;
        } else {
          sheet.appendRow(rowValues);
          idToRowMap[cleanId] = sheet.getLastRow();
          insertedCount++;
        }
      });

      // BƯỚC 3: ĐỊNH DẠNG CHUẨN TIỀN TỆ VNĐ (CÓ DẤU PHÂN CÁCH HÀNG NGHÌN) & CĂN CHỈNH BẢNG
      var finalLastRow = sheet.getLastRow();
      if (finalLastRow > 1) {
        sheet.getRange(2, 2, finalLastRow - 1, 1).setHorizontalAlignment("center");
        sheet.getRange(2, 4, finalLastRow - 1, 1).setHorizontalAlignment("center").setFontWeight("bold");
        // Cột F, G, H: Sĩ Số, Lẻ, Tổng Bản In -> Định dạng số #,##0, căn giữa
        sheet.getRange(2, 6, finalLastRow - 1, 3).setNumberFormat("#,##0").setHorizontalAlignment("center");
        // Cột I: Đơn Giá -> Định dạng tiền tệ #,##0 "đ", căn phải
        sheet.getRange(2, 9, finalLastRow - 1, 1).setNumberFormat('#,##0 "đ"').setHorizontalAlignment("right");
        // Cột J: Thành Tiền -> Định dạng tiền tệ #,##0 "đ", in đậm, căn phải
        sheet.getRange(2, 10, finalLastRow - 1, 1).setNumberFormat('#,##0 "đ"').setFontWeight("bold").setHorizontalAlignment("right");
        // Cột K: Tuần Photo -> Căn giữa, in đậm
        sheet.getRange(2, 11, finalLastRow - 1, 1).setHorizontalAlignment("center").setFontWeight("bold");
      }

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

    // ĐỌC CÔNG NỢ CÁC TUẦN TỪ SHEET CongNo_TheoTuan
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
    "API Web App Tinh Tien Photo (v2.0) đang hoạt động hoàn hảo!\n" +
    "- File Google Sheet: " + fileName + "\n" +
    "- Số bản ghi photo hiện có: " + rowCount + " dòng\n" +
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
    // Định dạng tiền tệ VNĐ và số lượng cho các dòng dữ liệu
    sheet.getRange(2, 6, curLastRow - 1, 3).setNumberFormat("#,##0").setHorizontalAlignment("center");
    sheet.getRange(2, 9, curLastRow - 1, 1).setNumberFormat('#,##0 "đ"').setHorizontalAlignment("right");
    sheet.getRange(2, 10, curLastRow - 1, 1).setNumberFormat('#,##0 "đ"').setFontWeight("bold").setHorizontalAlignment("right");
    sheet.getRange(2, 11, curLastRow - 1, 1).setHorizontalAlignment("center").setFontWeight("bold");
  }

  return sheet;
}

/**
 * HÀM SỬA BẢNG TOÀN DIỆN:
 * 1. Bỏ cột Trạng thái & Ghi chú, đưa Tuần Photo về Cột K.
 * 2. Tự động quét và xóa 2 dòng rác "Tuần 10" (do nhập thử nghiệm trước đó).
 * 3. Định dạng cột Thành Tiền & Đơn Giá chuẩn tiền tệ VNĐ có dấu phân cách hàng nghìn (#,##0 "đ").
 * 4. Căn lề số lượng, lớp, ngày giờ chuẩn chỉ đẹp mắt!
 * Bạn chỉ cần chọn hàm này và bấm "Chạy" (Run) trên Google Apps Script!
 */
function chuanHoaVaDienTuan() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreatePhotoSheet(ss);

  // 1. Quét và xóa bỏ các dòng rác "Tuần 10" nếu có
  var lastRow = sheet.getLastRow();
  var deletedCount = 0;
  if (lastRow > 1) {
    for (var r = lastRow; r >= 2; r--) {
      var w11 = sheet.getRange(r, 11).getValue().toString().trim();
      var w13 = sheet.getLastColumn() >= 13 ? sheet.getRange(r, 13).getValue().toString().trim() : "";
      if (w11 === "Tuần 10" || w13 === "Tuần 10") {
        sheet.deleteRow(r);
        deletedCount++;
      }
    }
  }

  // 2. Định dạng lại chuẩn tiền tệ VNĐ và căn lề cho tất cả các dòng còn lại
  var newLastRow = sheet.getLastRow();
  if (newLastRow > 1) {
    sheet.getRange(2, 2, newLastRow - 1, 1).setHorizontalAlignment("center");
    sheet.getRange(2, 4, newLastRow - 1, 1).setHorizontalAlignment("center").setFontWeight("bold");
    sheet.getRange(2, 6, newLastRow - 1, 3).setNumberFormat("#,##0").setHorizontalAlignment("center");
    sheet.getRange(2, 9, newLastRow - 1, 1).setNumberFormat('#,##0 "đ"').setHorizontalAlignment("right");
    sheet.getRange(2, 10, newLastRow - 1, 1).setNumberFormat('#,##0 "đ"').setFontWeight("bold").setHorizontalAlignment("right");
    sheet.getRange(2, 11, newLastRow - 1, 1).setHorizontalAlignment("center").setFontWeight("bold");
  }

  Logger.log("Đã chuẩn hóa CSDL thành công! Đã xóa " + deletedCount + " dòng rác Tuần 10 và định dạng tiền tệ VNĐ chuẩn.");
}

// Hàm hỗ trợ lấy hoặc tạo sheet CongNo_CacLop (Quản lý trực tiếp nợ của từng lớp)
function getOrCreateSimpleDebtSheet(ss) {
  var sheet = ss.getSheetByName("CongNo_CacLop");
  if (!sheet) {
    sheet = ss.insertSheet("CongNo_CacLop");
    sheet.appendRow([
      "Lớp",
      "GVCN",
      "Tiền Nợ / Thiếu (VNĐ)",
      "Ghi Chú Nợ",
      "Ngày Cập Nhật"
    ]);
    sheet.getRange(1, 1, 1, 5)
         .setFontWeight("bold")
         .setBackground("#b91c1c")
         .setFontColor("#ffffff")
         .setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
    sheet.setRowHeight(1, 35);
  }
  return sheet;
}

// Hàm hỗ trợ lấy hoặc tạo sheet CongNo_TheoTuan
function getOrCreateDebtSheet(ss) {
  var sheet = ss.getSheetByName("CongNo_TheoTuan");
  if (!sheet) {
    sheet = ss.insertSheet("CongNo_TheoTuan");
    sheet.appendRow([
      "Mã Định Danh (Tuần_Lớp)",
      "Tuần",
      "Lớp",
      "GVCN",
      "Tiền Nợ Tuần Trước (VNĐ)",
      "Tiền Photo Tuần Này (VNĐ)",
      "TỔNG CẦN THU (VNĐ)",
      "Ghi Chú Nợ",
      "Ngày Cập Nhật"
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
