/**
 * GOOGLE APPS SCRIPT - CƠ SỞ DỮ LIỆU TÍNH TIỀN PHOTO TRƯỜNG HỌC (PHIÊN BẢN 3.0 TOÀN DIỆN)
 * ==============================================================================
 * HỆ THỐNG QUẢN LÝ TOÀN DIỆN 3 TAB CƠ SỞ DỮ LIỆU:
 * 1. NhatKy_Photo: Nhật ký các đơn photo giáo viên/lớp theo từng tuần (11 cột chuẩn).
 * 2. CongNo_TheoTuan: Theo dõi học sinh / lớp thiếu tiền, nợ tuần trước chưa trả (9 cột).
 * 3. SoQuy_ThuChi: Sổ quỹ thu chi tiền mặt, vật tư giấy ram A4, nạp mực, sửa máy (8 cột).
 * 
 * TÍNH NĂNG NỔI BẬT:
 * - Đồng bộ 2 chiều (GET / POST) độc lập cho cả 3 module: Đơn Photo, Công Nợ, Sổ Quỹ.
 * - Cơ chế Upsert (chống trùng lặp tuyệt đối): Cập nhật thông tin nếu đã có, thêm mới nếu chưa có.
 * - Tự động định dạng chuẩn tiền tệ VNĐ (#,##0 "đ") có dấu phân cách hàng nghìn.
 * - Hàm chuanHoaVaDienTuan() tự động kẻ bảng, tô màu và chuẩn hóa 1 click.
 * - Tự động tạo menu "Quản Lý Photo" ngay trên giao diện Google Sheets.
 * ==============================================================================
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(15000); // Khóa an toàn chống xung đột đa luồng

  try {
    var rawData = e.postData.contents;
    var data = JSON.parse(rawData);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var timestamp = new Date();

    // =========================================================================
    // 1. ACTION: LƯU & CẬP NHẬT DỮ LIỆU PHOTO (NhatKy_Photo)
    // =========================================================================
    if (data.action === "saveBillingData") {
      var sheet = getOrCreatePhotoSheet(ss);
      var items = data.items || [];
      var targetWeek = data.currentWeek || "Tuần 1";

      var lastRow = sheet.getLastRow();
      var incomingIds = {};
      items.forEach(function(item) {
        if (item.id) {
          incomingIds[item.id.toString().trim()] = true;
        }
      });

      // 1. Lọc giữ lại dữ liệu của các tuần khác
      var keepRows = [];
      if (lastRow > 1) {
        var readCols = Math.min(13, Math.max(11, sheet.getLastColumn()));
        var existingData = sheet.getRange(2, 1, lastRow - 1, readCols).getValues();
        for (var r = 0; r < existingData.length; r++) {
          var row = existingData[r];
          var rowWeek = "";
          if (row[10] && row[10].toString().trim().indexOf("Tuần") === 0) {
            rowWeek = row[10].toString().trim();
          } else if (row[12] && row[12].toString().trim().indexOf("Tuần") === 0) {
            rowWeek = row[12].toString().trim();
          }
          if (rowWeek !== targetWeek && row[0]) {
            keepRows.push(row.slice(0, 11));
          }
        }
      }

      // 2. Chuyển items mới thành ma trận dữ liệu
      var newRows = [];
      items.forEach(function(item) {
        if (!item.id) return;
        var cleanId = item.id.toString().trim();
        var studentCount = Number(item.studentCount) || 0;
        var extraCount = Number(item.extraCount) || 0;
        var totalCopies = (Number(item.totalCopies) || (studentCount + extraCount));
        var unitPrice = Number(item.unitPrice) || 380;
        var amount = Number(item.amount) || (totalCopies * unitPrice);

        newRows.push([
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
          targetWeek
        ]);
      });

      // 3. Render toàn bộ dữ liệu photo theo tuần kèm dòng TỔNG KẾT cuối mỗi tuần
      var allRows = keepRows.concat(newRows);
      renderPhotoWithWeeklyTotals(sheet, allRows, timestamp);

      // Nếu có gửi kèm công nợ thì đồng bộ luôn sang tab CongNo_TheoTuan
      if (data.classDebts !== undefined) {
        syncDebtsInternal(ss, targetWeek, data.classDebts, timestamp);
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

    // =========================================================================
    // 2. ACTION: LƯU RIÊNG CÔNG NỢ HỌC SINH / LỚP THIẾU TRONG TUẦN (CongNo_TheoTuan)
    // =========================================================================
    if (data.action === "saveClassDebts") {
      var targetWeek = data.currentWeek || "Tuần 1";
      var debts = data.classDebts || data.debts || [];
      var syncResult = syncDebtsInternal(ss, targetWeek, debts, timestamp);

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Đã lưu CSDL Công Nợ (" + targetWeek + ") thành công! (" + syncResult.savedCount + " lớp còn thiếu/nợ)",
        savedCount: syncResult.savedCount,
        week: targetWeek,
        spreadsheetUrl: ss ? ss.getUrl() : ""
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // =========================================================================
    // 3. ACTION: LƯU SỔ QUỸ THU - CHI (SoQuy_ThuChi) VÀ TỰ ĐỘNG THỐNG KÊ TỔNG CHI, CÒN LẠI CUỐI MỖI TUẦN
    // =========================================================================
    if (data.action === "saveCashflow") {
      var cashflowSheet = getOrCreateCashflowSheet(ss);
      var records = data.records || [];

      // Render toàn bộ giao dịch theo tuần kèm dòng TỔNG THU, TỔNG CHI, CÒN LẠI ở cuối mỗi tuần
      var result = renderCashflowWithWeeklyTotals(cashflowSheet, records, timestamp);

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Đã lưu Sổ Quỹ Thu Chi thành công! Đã tự động thống kê Tổng Chi và Còn Lại ở dòng cuối mỗi tuần.",
        totalRecords: records.length,
        weeksCount: result.weeksCount,
        spreadsheetUrl: ss ? ss.getUrl() : ""
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // =========================================================================
    // 4. ACTION: XÓA ĐƠN PHOTO THEO ID
    // =========================================================================
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

    // =========================================================================
    // 5. ACTION: XÓA PHIẾU THU/CHI SỔ QUỸ THEO ID
    // =========================================================================
    if (data.action === "deleteCashflowRecord") {
      var cfSheet = ss.getSheetByName("SoQuy_ThuChi");
      if (cfSheet && data.id) {
        var lastRow = cfSheet.getLastRow();
        if (lastRow > 1) {
          var ids = cfSheet.getRange(2, 1, lastRow - 1, 1).getValues();
          for (var r = ids.length - 1; r >= 0; r--) {
            if (ids[r][0] && ids[r][0].toString().trim() === data.id.toString().trim()) {
              cfSheet.deleteRow(r + 2);
              break;
            }
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // =========================================================================
    // 6. ACTION: XÓA CÔNG NỢ CỦA MỘT LỚP TRONG TUẦN
    // =========================================================================
    if (data.action === "deleteClassDebt") {
      var debtSheet = ss.getSheetByName("CongNo_TheoTuan");
      if (debtSheet && data.key) {
        var lastRow = debtSheet.getLastRow();
        if (lastRow > 1) {
          var keys = debtSheet.getRange(2, 1, lastRow - 1, 1).getValues();
          for (var r = keys.length - 1; r >= 0; r--) {
            if (keys[r][0] && keys[r][0].toString().trim() === data.key.toString().trim()) {
              debtSheet.deleteRow(r + 2);
              break;
            }
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // =========================================================================
    // 7. ACTION: THỐNG KÊ TẤT CẢ HOẶC TỪNG BẢNG TỪ XA
    // =========================================================================
    if (data.action === "thongKeTatCa") {
      var rPhoto = thongKePhotoTheoTuan(ss);
      var rDebt = thongKeDebtTheoTuan(ss);
      var rCash = thongKeSoQuyTheoTuan(ss);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Đã hoàn thành thống kê cả 3 bảng CSDL thành công!",
        photo: rPhoto,
        debt: rDebt,
        cashflow: rCash,
        spreadsheetUrl: ss ? ss.getUrl() : ""
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === "thongKePhoto") {
      var resP = thongKePhotoTheoTuan(ss);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Đã thống kê NhatKy_Photo thành công!",
        result: resP,
        spreadsheetUrl: ss ? ss.getUrl() : ""
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === "thongKeDebt") {
      var resD = thongKeDebtTheoTuan(ss);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Đã thống kê CongNo_TheoTuan thành công!",
        result: resD,
        spreadsheetUrl: ss ? ss.getUrl() : ""
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

// =============================================================================
// XỬ LÝ GET REQUEST (ĐỌC DỮ LIỆU TỪ SHEETS VỀ WEB APP)
// =============================================================================
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "ping";
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // ĐỌC DỮ LIỆU TOÀN DIỆN VỀ WEB APP
  if (action === "fetchBillingData" || action === "getBillingData" || action === "fetchAllData") {
    // 1. Đọc NhatKy_Photo
    var sheet = ss ? ss.getSheetByName("NhatKy_Photo") : null;
    var items = [];

    if (sheet && sheet.getLastRow() > 1) {
      var lastRow = sheet.getLastRow();
      var lastCol = sheet.getLastColumn();
      var readCols = Math.min(13, Math.max(11, lastCol));
      var rows = sheet.getRange(2, 1, lastRow - 1, readCols).getValues();

      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        if (!r[0] && !r[2]) continue;
        if (r[0] && r[0].toString().indexOf("[TỔNG") === 0) continue;

        var studentCount = Number(r[5]) || 0;
        var extraCount = Number(r[6]) || 0;
        var totalCopies = Number(r[7]) || (studentCount + extraCount);
        var unitPrice = Number(r[8]) || 380;
        var amount = Number(r[9]) || (totalCopies * unitPrice);

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

    // 2. Đọc CongNo_TheoTuan
    var debts = {};
    var debtSheet = ss ? ss.getSheetByName("CongNo_TheoTuan") : null;
    if (debtSheet && debtSheet.getLastRow() > 1) {
      var dRows = debtSheet.getRange(2, 1, debtSheet.getLastRow() - 1, 9).getValues();
      for (var d = 0; d < dRows.length; d++) {
        var dr = dRows[d];
        var dId = dr[0] ? dr[0].toString().trim() : "";
        if (dId.indexOf("[TỔNG") === 0) continue; // Bỏ qua dòng thống kê tổng nợ
        var dWeek = dr[1] ? dr[1].toString().trim() : "Tuần 1";
        var dClass = dr[2] ? dr[2].toString().trim() : "";
        if (!dClass || dClass.indexOf("Tổng:") === 0) continue;
        var dAmount = parseMoneySafe(dr[4]);
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

    // 3. Đọc SoQuy_ThuChi (Lọc bỏ các dòng thống kê tổng kết)
    var cashflow = [];
    var cfSheet = ss ? ss.getSheetByName("SoQuy_ThuChi") : null;
    if (cfSheet && cfSheet.getLastRow() > 1) {
      var cfRows = cfSheet.getRange(2, 1, cfSheet.getLastRow() - 1, 8).getValues();
      for (var c = 0; c < cfRows.length; c++) {
        var cfr = cfRows[c];
        if (!cfr[0] && !cfr[3]) continue;
        var rId = cfr[0] ? cfr[0].toString().trim() : "";
        var rType = cfr[2] ? cfr[2].toString().toUpperCase().trim() : "";
        var rCat = cfr[3] ? cfr[3].toString().toUpperCase().trim() : "";
        
        // Bỏ qua dòng thống kê tổng kết tuần
        if (rId.indexOf("[TỔNG") === 0 || rId.indexOf("[CÒN LẠI") === 0 || 
            rCat.indexOf("TỔNG CHI") !== -1 || rCat.indexOf("CÒN LẠI") !== -1 ||
            (rType !== "THU" && rType !== "CHI")) {
          continue;
        }

        cashflow.push({
          id: rId ? rId : ("CF-" + c),
          date: cfr[1] ? formatDateForWeb(cfr[1]) : "",
          type: rType,
          category: cfr[3] ? cfr[3].toString() : "",
          amount: Number(cfr[4]) || 0,
          payer: cfr[5] ? cfr[5].toString() : "",
          note: cfr[6] ? cfr[6].toString() : ""
        });
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      items: items,
      count: items.length,
      debts: debts,
      cashflow: cashflow,
      cashflowCount: cashflow.length,
      spreadsheetUrl: ss ? ss.getUrl() : ""
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // ĐỌC RIÊNG SỔ QUỸ THU CHI (Lọc bỏ các dòng thống kê tổng kết)
  if (action === "fetchCashflow") {
    var cashflow = [];
    var cfSheet = ss ? ss.getSheetByName("SoQuy_ThuChi") : null;
    if (cfSheet && cfSheet.getLastRow() > 1) {
      var cfRows = cfSheet.getRange(2, 1, cfSheet.getLastRow() - 1, 8).getValues();
      for (var c = 0; c < cfRows.length; c++) {
        var cfr = cfRows[c];
        if (!cfr[0] && !cfr[3]) continue;
        var rId = cfr[0] ? cfr[0].toString().trim() : "";
        var rType = cfr[2] ? cfr[2].toString().toUpperCase().trim() : "";
        var rCat = cfr[3] ? cfr[3].toString().toUpperCase().trim() : "";

        // Bỏ qua dòng thống kê tổng kết tuần
        if (rId.indexOf("[TỔNG") === 0 || rId.indexOf("[CÒN LẠI") === 0 || 
            rCat.indexOf("TỔNG CHI") !== -1 || rCat.indexOf("CÒN LẠI") !== -1 ||
            (rType !== "THU" && rType !== "CHI")) {
          continue;
        }

        cashflow.push({
          id: rId ? rId : ("CF-" + c),
          date: cfr[1] ? formatDateForWeb(cfr[1]) : "",
          type: rType,
          category: cfr[3] ? cfr[3].toString() : "",
          amount: Number(cfr[4]) || 0,
          payer: cfr[5] ? cfr[5].toString() : "",
          note: cfr[6] ? cfr[6].toString() : ""
        });
      }
    }
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      cashflow: cashflow,
      count: cashflow.length,
      spreadsheetUrl: ss ? ss.getUrl() : ""
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // LẤY URL SPREADSHEET
  if (action === "getSpreadsheetUrl") {
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      spreadsheetUrl: ss ? ss.getUrl() : "",
      spreadsheetName: ss ? ss.getName() : ""
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // MẶC ĐỊNH: BÁO TRẠNG THÁI HOẠT ĐỘNG
  var pSheet = ss ? ss.getSheetByName("NhatKy_Photo") : null;
  var dSheet = ss ? ss.getSheetByName("CongNo_TheoTuan") : null;
  var cSheet = ss ? ss.getSheetByName("SoQuy_ThuChi") : null;

  var pCount = pSheet ? Math.max(0, pSheet.getLastRow() - 1) : 0;
  var dCount = dSheet ? Math.max(0, dSheet.getLastRow() - 1) : 0;
  var cCount = cSheet ? Math.max(0, cSheet.getLastRow() - 1) : 0;
  var fileName = ss ? ss.getName() : "Chưa xác định";

  return ContentService.createTextOutput(
    "API Web App Tinh Tien Photo (v3.0 Toàn Diện) đang hoạt động hoàn hảo!\n" +
    "- File Google Sheet: " + fileName + "\n" +
    "- Tab 1: NhatKy_Photo (" + pCount + " dòng)\n" +
    "- Tab 2: CongNo_TheoTuan (" + dCount + " lớp còn thiếu/nợ)\n" +
    "- Tab 3: SoQuy_ThuChi (" + cCount + " phiếu thu chi)\n" +
    "- Hỗ trợ: Đồng bộ 2 chiều (GET/POST) độc lập, Upsert chống trùng lặp & Định dạng VNĐ."
  ).setMimeType(ContentService.MimeType.TEXT);
}

// =============================================================================
// HÀM ĐỒNG BỘ NỘI BỘ CHO CÔNG NỢ (CongNo_TheoTuan)
// =============================================================================
function syncDebtsInternal(ss, targetWeek, debts, timestamp) {
  var debtSheet = getOrCreateDebtSheet(ss);
  var lastDebtRow = debtSheet.getLastRow();
  var incomingKeys = {};

  (debts || []).forEach(function(d) {
    if (!d.className) return;
    var weekVal = d.week || targetWeek || "Tuần 1";
    var cleanClass = d.className.toString().trim();
    var keyVal = d.key || (weekVal + "_" + cleanClass);
    incomingKeys[keyVal] = true;
  });

  // Xóa các dòng nợ của targetWeek không còn trong danh sách (lớp đã trả hết nợ)
  if (lastDebtRow > 1) {
    var existingDebts = debtSheet.getRange(2, 1, lastDebtRow - 1, 2).getValues();
    for (var k = existingDebts.length - 1; k >= 0; k--) {
      var dKey = existingDebts[k][0] ? existingDebts[k][0].toString().trim() : "";
      var dWeek = existingDebts[k][1] ? existingDebts[k][1].toString().trim() : "";
      if (dWeek === targetWeek && dKey && !incomingKeys[dKey]) {
        debtSheet.deleteRow(k + 2);
      }
    }
  }

  // Upsert các dòng công nợ
  var curLastDebtRow = debtSheet.getLastRow();
  var keyMap = {};
  if (curLastDebtRow > 1) {
    var curKeys = debtSheet.getRange(2, 1, curLastDebtRow - 1, 1).getValues();
    for (var i = 0; i < curKeys.length; i++) {
      if (curKeys[i][0]) keyMap[curKeys[i][0].toString().trim()] = (i + 2);
    }
  }

  var savedCount = 0;

  (debts || []).forEach(function(d) {
    if (!d.className) return;
    var weekVal = d.week || targetWeek || "Tuần 1";
    var cleanClass = d.className.toString().trim();
    var keyVal = d.key || (weekVal + "_" + cleanClass);
    var debtAmount = Number(d.previousDebt || d.debtAmount || d.amount) || 0;
    var photoAmount = Number(d.photoAmount) || 0;
    var totalDue = Number(d.totalDue) || (debtAmount + photoAmount);

    var debtRowValues = [
      keyVal,                         // Cột A: Mã Định Danh (Tuần_Lớp)
      weekVal,                        // Cột B: Tuần
      cleanClass,                     // Cột C: Lớp
      d.homeroomTeacher || "",        // Cột D: GVCN
      debtAmount,                     // Cột E: Tiền Nợ / Thiếu (VNĐ)
      photoAmount,                    // Cột F: Tiền Photo Tuần Này (VNĐ)
      totalDue,                       // Cột G: TỔNG CẦN THU (VNĐ)
      d.note || "",                   // Cột H: Ghi Chú Nợ
      d.updatedAt || timestamp        // Cột I: Ngày Cập Nhật
    ];

    if (keyMap[keyVal]) {
      debtSheet.getRange(keyMap[keyVal], 1, 1, 9).setValues([debtRowValues]);
    } else {
      debtSheet.appendRow(debtRowValues);
      keyMap[keyVal] = debtSheet.getLastRow();
    }
    savedCount++;
  });

  // Tự động gom nhóm theo tuần và chèn dòng TỔNG NỢ & CẦN THU ở cuối mỗi tuần
  renderDebtWithWeeklyTotals(debtSheet, null, timestamp);

  return { savedCount: savedCount };
}

// =============================================================================
// CÁC HÀM KHỞI TẠO VÀ ĐỊNH DẠNG 3 TAB CƠ SỞ DỮ LIỆU
// =============================================================================

// 1. Tab NhatKy_Photo (11 Cột Chuẩn)
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
  } else {
    // Sửa tiêu đề dòng 1 nếu chưa chuẩn
    sheet.getRange(1, 1, 1, 11).setValues([headers]);
    // Xóa cột thừa từ cột 12 trở đi nếu có
    if (sheet.getMaxColumns() >= 12) {
      sheet.getRange(1, 12, Math.max(1, sheet.getLastRow()), sheet.getMaxColumns() - 11).clear();
    }
  }

  sheet.getRange(1, 1, 1, 11)
       .setFontWeight("bold")
       .setBackground("#1b5ebe")
       .setFontColor("#ffffff")
       .setHorizontalAlignment("center");
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 35);

  formatPhotoSheet(sheet);
  return sheet;
}

function formatPhotoSheet(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 2, lastRow - 1, 1).setHorizontalAlignment("center");
    sheet.getRange(2, 4, lastRow - 1, 1).setHorizontalAlignment("center").setFontWeight("bold");
    sheet.getRange(2, 6, lastRow - 1, 3).setNumberFormat("#,##0").setHorizontalAlignment("center");
    sheet.getRange(2, 9, lastRow - 1, 1).setNumberFormat('#,##0 "đ"').setHorizontalAlignment("right");
    sheet.getRange(2, 10, lastRow - 1, 1).setNumberFormat('#,##0 "đ"').setFontWeight("bold").setHorizontalAlignment("right");
    sheet.getRange(2, 11, lastRow - 1, 1).setHorizontalAlignment("center").setFontWeight("bold");
  }
}

// Hàm ghi dữ liệu NhatKy_Photo và tự động thống kê ở cuối mỗi tuần
function renderPhotoWithWeeklyTotals(sheet, records, timestamp) {
  if (!sheet) return { weeksCount: 0 };

  var cleanRecords = [];
  if (!records || records.length === 0) {
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      var data = sheet.getRange(2, 1, lastRow - 1, 11).getValues();
      for (var i = 0; i < data.length; i++) {
        var r = data[i];
        var id = r[0] ? r[0].toString().trim() : "";
        if (!id || id.indexOf("[TỔNG") === 0) continue;
        cleanRecords.push({
          id: id,
          timestamp: r[1] ? formatTimeStr(new Date(r[1])) : formatTimeStr(timestamp),
          teacherName: r[2] ? r[2].toString().trim() : "",
          className: r[3] ? r[3].toString().trim() : "",
          subject: r[4] ? r[4].toString().trim() : "",
          studentCount: parseMoneySafe(r[5]),
          extraCount: parseMoneySafe(r[6]),
          totalCopies: parseMoneySafe(r[7]),
          unitPrice: parseMoneySafe(r[8]),
          amount: parseMoneySafe(r[9]),
          week: r[10] ? r[10].toString().trim() : "Tuần 1"
        });
      }
    }
  } else {
    records.forEach(function(r) {
      if (!r) return;
      var rawId = (Array.isArray(r) ? r[0] : r.id) ? (Array.isArray(r) ? r[0] : r.id).toString().trim() : "";
      if (!rawId || rawId.indexOf("[TỔNG") === 0) return;

      if (Array.isArray(r)) {
        cleanRecords.push({
          id: rawId,
          timestamp: r[1] ? formatTimeStr(new Date(r[1])) : formatTimeStr(timestamp),
          teacherName: r[2] ? r[2].toString().trim() : "",
          className: r[3] ? r[3].toString().trim() : "",
          subject: r[4] ? r[4].toString().trim() : "",
          studentCount: parseMoneySafe(r[5]),
          extraCount: parseMoneySafe(r[6]),
          totalCopies: parseMoneySafe(r[7]),
          unitPrice: parseMoneySafe(r[8]),
          amount: parseMoneySafe(r[9]),
          week: r[10] ? r[10].toString().trim() : "Tuần 1"
        });
      } else {
        var sCount = parseMoneySafe(r.studentCount);
        var eCount = parseMoneySafe(r.extraCount);
        var tCopies = parseMoneySafe(r.totalCopies) || (sCount + eCount);
        var uPrice = parseMoneySafe(r.unitPrice) || 380;
        var amt = parseMoneySafe(r.amount) || (tCopies * uPrice);
        cleanRecords.push({
          id: rawId,
          timestamp: r.timestamp ? formatTimeStr(new Date(r.timestamp)) : formatTimeStr(timestamp),
          teacherName: r.teacherName || "",
          className: r.className || "",
          subject: r.subject || "",
          studentCount: sCount,
          extraCount: eCount,
          totalCopies: tCopies,
          unitPrice: uPrice,
          amount: amt,
          week: (r.week || "Tuần 1").toString().trim()
        });
      }
    });
  }

  // Gom nhóm theo tuần
  var weekGroups = {};
  var weekOrder = [];
  cleanRecords.forEach(function(item) {
    var w = item.week || "Tuần 1";
    if (!weekGroups[w]) {
      weekGroups[w] = [];
      weekOrder.push(w);
    }
    weekGroups[w].push(item);
  });

  weekOrder.sort(function(a, b) {
    var numA = parseInt((a.match(/\d+/) || [999])[0], 10);
    var numB = parseInt((b.match(/\d+/) || [999])[0], 10);
    return numA - numB;
  });

  var allRows = [];
  var summaryRows = [];

  for (var wIdx = 0; wIdx < weekOrder.length; wIdx++) {
    var wk = weekOrder[wIdx];
    var items = weekGroups[wk];
    var sumSiSo = 0;
    var sumSoLuongLe = 0;
    var sumTongBanIn = 0;
    var sumThanhTien = 0;

    for (var j = 0; j < items.length; j++) {
      var it = items[j];
      sumSiSo += it.studentCount;
      sumSoLuongLe += it.extraCount;
      sumTongBanIn += it.totalCopies;
      sumThanhTien += it.amount;

      allRows.push([
        it.id,
        it.timestamp,
        it.teacherName,
        it.className,
        it.subject,
        it.studentCount,
        it.extraCount,
        it.totalCopies,
        it.unitPrice,
        it.amount,
        it.week
      ]);
    }

    // DÒNG CUỐI TUẦN: TỔNG KẾT PHOTO TUẦN
    var summaryRowIndex = allRows.length + 2;
    allRows.push([
      "[TỔNG KẾT]",
      formatDateForWeb(timestamp),
      "📊 TỔNG CỘNG PHOTO (" + wk + ")",
      "Tổng: " + items.length + " đơn",
      "Toàn trường",
      sumSiSo,
      sumSoLuongLe,
      sumTongBanIn,
      "",
      sumThanhTien,
      wk
    ]);
    summaryRows.push({ row: summaryRowIndex, week: wk, amount: sumThanhTien });
  }

  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 11).clear({ contentsOnly: false });
  }

  if (allRows.length > 0) {
    sheet.getRange(2, 1, allRows.length, 11).setValues(allRows);
    formatPhotoSheet(sheet);

    summaryRows.forEach(function(sm) {
      var range = sheet.getRange(sm.row, 1, 1, 11);
      range.setBackground("#dbeafe").setFontWeight("bold");
      sheet.getRange(sm.row, 1).setFontColor("#1e3a8a");
      sheet.getRange(sm.row, 3).setFontColor("#1e3a8a").setFontSize(10.5);
      sheet.getRange(sm.row, 4).setFontColor("#1e40af");
      sheet.getRange(sm.row, 8).setFontColor("#1e40af").setFontWeight("bold");
      sheet.getRange(sm.row, 10).setFontColor("#1e40af").setFontSize(11).setFontWeight("bold");
      range.setBorder(true, false, true, false, false, false, "#3b82f6", SpreadsheetApp.BorderStyle.SOLID);
    });
  }

  return { weeksCount: weekOrder.length, totalRows: allRows.length };
}

// 2. Tab CongNo_TheoTuan (9 Cột Chuẩn)
function getOrCreateDebtSheet(ss) {
  var sheet = ss.getSheetByName("CongNo_TheoTuan");
  if (!sheet) {
    sheet = ss.insertSheet("CongNo_TheoTuan");
  }

  var headers = [
    "Mã Định Danh (Tuần_Lớp)",
    "Tuần",
    "Lớp",
    "GVCN",
    "Tiền Nợ / Thiếu (VNĐ)",
    "Tiền Photo Tuần Này (VNĐ)",
    "TỔNG CẦN THU (VNĐ)",
    "Ghi Chú Nợ",
    "Ngày Cập Nhật"
  ];

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  } else {
    sheet.getRange(1, 1, 1, 9).setValues([headers]);
  }

  sheet.getRange(1, 1, 1, 9)
       .setFontWeight("bold")
       .setBackground("#0f766e")
       .setFontColor("#ffffff")
       .setHorizontalAlignment("center");
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 35);

  formatDebtSheet(sheet);
  return sheet;
}

function formatDebtSheet(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 1).setHorizontalAlignment("center");
    sheet.getRange(2, 2, lastRow - 1, 1).setHorizontalAlignment("center").setFontWeight("bold");
    sheet.getRange(2, 3, lastRow - 1, 1).setHorizontalAlignment("center").setFontWeight("bold");
    // Cột E (Tiền Nợ), F (Tiền Photo), G (Tổng Cần Thu) -> Định dạng tiền tệ VNĐ
    sheet.getRange(2, 5, lastRow - 1, 1).setNumberFormat('#,##0 "đ"').setFontWeight("bold").setHorizontalAlignment("right");
    sheet.getRange(2, 6, lastRow - 1, 1).setNumberFormat('#,##0 "đ"').setHorizontalAlignment("right");
    sheet.getRange(2, 7, lastRow - 1, 1).setNumberFormat('#,##0 "đ"').setFontWeight("bold").setFontColor("#b91c1c").setHorizontalAlignment("right");
    sheet.getRange(2, 9, lastRow - 1, 1).setHorizontalAlignment("center");
  }
}

// Hàm ghi dữ liệu CongNo_TheoTuan và tự động thống kê ở cuối mỗi tuần
function renderDebtWithWeeklyTotals(sheet, debts, timestamp) {
  if (!sheet) return { weeksCount: 0 };

  var cleanDebts = [];
  if (!debts || debts.length === 0) {
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      var data = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
      for (var i = 0; i < data.length; i++) {
        var r = data[i];
        var key = r[0] ? r[0].toString().trim() : "";
        if (!key || key.indexOf("[TỔNG") === 0) continue;
        cleanDebts.push({
          key: key,
          week: r[1] ? r[1].toString().trim() : "Tuần 1",
          className: r[2] ? r[2].toString().trim() : "",
          homeroomTeacher: r[3] ? r[3].toString().trim() : "",
          debtAmount: parseMoneySafe(r[4]),
          photoAmount: parseMoneySafe(r[5]),
          totalDue: parseMoneySafe(r[6]),
          note: r[7] ? r[7].toString().trim() : "",
          updatedAt: r[8] ? r[8].toString().trim() : formatDateForWeb(timestamp)
        });
      }
    }
  } else {
    debts.forEach(function(d) {
      if (!d) return;
      var rawKey = d.key || ((d.week || "Tuần 1") + "_" + (d.className || ""));
      if (!rawKey || rawKey.indexOf("[TỔNG") === 0) return;
      var dAmt = parseMoneySafe(d.previousDebt || d.debtAmount || d.amount);
      var pAmt = parseMoneySafe(d.photoAmount);
      var tDue = parseMoneySafe(d.totalDue) || (dAmt + pAmt);
      cleanDebts.push({
        key: rawKey,
        week: (d.week || "Tuần 1").toString().trim(),
        className: (d.className || "").toString().trim(),
        homeroomTeacher: d.homeroomTeacher || "",
        debtAmount: dAmt,
        photoAmount: pAmt,
        totalDue: tDue,
        note: d.note || "",
        updatedAt: d.updatedAt || formatDateForWeb(timestamp)
      });
    });
  }

  // Gom nhóm theo tuần
  var weekGroups = {};
  var weekOrder = [];
  cleanDebts.forEach(function(item) {
    var w = item.week || "Tuần 1";
    if (!weekGroups[w]) {
      weekGroups[w] = [];
      weekOrder.push(w);
    }
    weekGroups[w].push(item);
  });

  weekOrder.sort(function(a, b) {
    var numA = parseInt((a.match(/\d+/) || [999])[0], 10);
    var numB = parseInt((b.match(/\d+/) || [999])[0], 10);
    return numA - numB;
  });

  var allRows = [];
  var summaryRows = [];

  for (var wIdx = 0; wIdx < weekOrder.length; wIdx++) {
    var wk = weekOrder[wIdx];
    var items = weekGroups[wk];
    var sumNo = 0;
    var sumPhoto = 0;
    var sumCanThu = 0;

    for (var j = 0; j < items.length; j++) {
      var it = items[j];
      sumNo += it.debtAmount;
      sumPhoto += it.photoAmount;
      sumCanThu += it.totalDue;

      allRows.push([
        it.key,
        it.week,
        it.className,
        it.homeroomTeacher,
        it.debtAmount,
        it.photoAmount,
        it.totalDue,
        it.note,
        it.updatedAt
      ]);
    }

    // DÒNG CUỐI TUẦN: TỔNG NỢ & CẦN THU TOÀN TRƯỜNG
    var summaryRowIndex = allRows.length + 2;
    allRows.push([
      "[TỔNG NỢ]",
      wk,
      "Tổng: " + items.length + " lớp",
      "📊 TỔNG CÔNG NỢ TOÀN TRƯỜNG (" + wk + ")",
      sumNo,
      sumPhoto,
      sumCanThu,
      "Tổng thực tế cần thu về quỹ " + wk,
      formatDateForWeb(timestamp)
    ]);
    summaryRows.push({ row: summaryRowIndex, week: wk, totalDue: sumCanThu });
  }

  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 9).clear({ contentsOnly: false });
  }

  if (allRows.length > 0) {
    sheet.getRange(2, 1, allRows.length, 9).setValues(allRows);
    formatDebtSheet(sheet);

    summaryRows.forEach(function(sm) {
      var range = sheet.getRange(sm.row, 1, 1, 9);
      range.setBackground("#ccfbf1").setFontWeight("bold");
      sheet.getRange(sm.row, 1).setFontColor("#0f766e");
      sheet.getRange(sm.row, 3).setFontColor("#0f766e");
      sheet.getRange(sm.row, 4).setFontColor("#0f766e").setFontSize(10.5);
      sheet.getRange(sm.row, 5).setFontColor("#0f766e");
      sheet.getRange(sm.row, 6).setFontColor("#0f766e");
      sheet.getRange(sm.row, 7).setFontColor("#b91c1c").setFontSize(11);
      range.setBorder(true, false, true, false, false, false, "#0d9488", SpreadsheetApp.BorderStyle.SOLID);
    });
  }

  return { weeksCount: weekOrder.length, totalRows: allRows.length };
}

// 3. Tab SoQuy_ThuChi (8 Cột Chuẩn)
function getOrCreateCashflowSheet(ss) {
  var sheet = ss.getSheetByName("SoQuy_ThuChi");
  if (!sheet) {
    sheet = ss.insertSheet("SoQuy_ThuChi");
  }

  var headers = [
    "Mã Phiếu",
    "Ngày Ghi Sổ",
    "Loại",
    "Nội Dung Hạng Mục",
    "Số Tiền (VNĐ)",
    "Người Giao Dịch",
    "Ghi Chú",
    "Thời Gian Cập Nhật"
  ];

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  } else {
    sheet.getRange(1, 1, 1, 8).setValues([headers]);
  }

  sheet.getRange(1, 1, 1, 8)
       .setFontWeight("bold")
       .setBackground("#6d28d9")
       .setFontColor("#ffffff")
       .setHorizontalAlignment("center");
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 35);

  formatCashflowSheet(sheet);
  return sheet;
}

// =============================================================================
// HÀM GHI DỮ LIỆU SỔ QUỸ & TỰ ĐỘNG THỐNG KÊ TỔNG CHI, CÒN LẠI CUỐI MỖI TUẦN
// =============================================================================
function renderCashflowWithWeeklyTotals(sheet, records, timestamp) {
  if (!sheet) return { weeksCount: 0 };

  // 1. Lọc và chuẩn hóa dữ liệu giao dịch sạch
  var cleanRecords = [];
  (records || []).forEach(function(r) {
    if (!r) return;
    var rawId = r.id ? r.id.toString().trim() : "";
    var rawType = r.type ? r.type.toString().toUpperCase().trim() : "";
    var rawCat = r.category ? r.category.toString().trim() : "";

    // Bỏ qua các dòng thống kê tổng kết cũ
    if (!rawId || rawId.indexOf("[TỔNG") === 0 || rawId.indexOf("[CÒN LẠI") === 0 ||
        rawCat.indexOf("TỔNG CHI") !== -1 || rawCat.indexOf("CÒN LẠI") !== -1 ||
        (rawType !== "THU" && rawType !== "CHI")) {
      return;
    }

    var numAmount = parseMoneySafe(r.amount);
    var w = (r.week || "").toString().trim();
    if (!w) {
      var match = (rawCat + " " + (r.note || "")).match(/tuần\s*(\d+)/i);
      if (match) {
        w = "Tuần " + match[1];
      } else {
        w = "Tuần 6"; // Mặc định nếu không tìm thấy tuần
      }
    }

    cleanRecords.push({
      id: rawId,
      date: r.date || "",
      type: rawType,
      category: rawCat,
      amount: numAmount,
      payer: r.payer || "",
      note: r.note || "",
      week: w
    });
  });

  // 2. Gom nhóm giao dịch theo từng tuần
  var weekGroups = {};
  var weekOrder = [];

  cleanRecords.forEach(function(r) {
    var w = r.week;
    if (!weekGroups[w]) {
      weekGroups[w] = [];
      weekOrder.push(w);
    }
    weekGroups[w].push(r);
  });

  // Sắp xếp các tuần theo thứ tự tăng dần
  weekOrder.sort(function(a, b) {
    var numA = parseInt((a.match(/\d+/) || [999])[0], 10);
    var numB = parseInt((b.match(/\d+/) || [999])[0], 10);
    return numA - numB;
  });

  // 3. Xây dựng ma trận dữ liệu kèm dòng TỔNG THU, TỔNG CHI và CÒN LẠI ở cuối mỗi tuần
  var allRows = [];
  var styleDirectives = [];

  for (var wIdx = 0; wIdx < weekOrder.length; wIdx++) {
    var wk = weekOrder[wIdx];
    var itemsInWk = weekGroups[wk];
    var sumThu = 0;
    var sumChi = 0;
    var lastDate = (itemsInWk.length > 0 && itemsInWk[itemsInWk.length - 1].date)
      ? itemsInWk[itemsInWk.length - 1].date
      : formatDateForWeb(timestamp);

    // A. Thêm các dòng giao dịch của tuần này
    for (var j = 0; j < itemsInWk.length; j++) {
      var it = itemsInWk[j];
      if (it.type === "THU") sumThu += it.amount;
      else if (it.type === "CHI") sumChi += it.amount;

      var rowIdx = allRows.length + 2; // +2 vì dòng 1 là tiêu đề
      allRows.push([
        it.id,
        it.date,
        it.type,
        it.category,
        it.amount,
        it.payer,
        it.note,
        formatTimeStr(timestamp)
      ]);

      styleDirectives.push({
        row: rowIdx,
        styleType: it.type === "THU" ? "TRANS_THU" : "TRANS_CHI"
      });
    }

    // B. DÒNG CUỐI MỖI TUẦN: THỐNG KÊ TỔNG THU, TỔNG CHI VÀ CÒN LẠI
    var conLai = sumThu - sumChi;

    // 1. Dòng TỔNG THU
    var thuRow = allRows.length + 2;
    allRows.push([
      "[TỔNG THU]",
      lastDate,
      "THU",
      "💵 TỔNG THU (" + wk + ")",
      sumThu,
      "Toàn tuần",
      "Tổng số tiền thực thu vào quỹ trong " + wk,
      formatTimeStr(timestamp)
    ]);
    styleDirectives.push({ row: thuRow, styleType: "SUM_THU" });

    // 2. Dòng 🔴 TỔNG CHI (Đúng theo yêu cầu người dùng)
    var chiRow = allRows.length + 2;
    allRows.push([
      "[TỔNG CHI]",
      lastDate,
      "CHI",
      "🔴 TỔNG CHI (" + wk + ")",
      sumChi,
      "Toàn tuần",
      "Tổng chi phí mua giấy, nạp mực & hoạt động " + wk,
      formatTimeStr(timestamp)
    ]);
    styleDirectives.push({ row: chiRow, styleType: "SUM_CHI" });

    // 3. Dòng 💰 CÒN LẠI (Đúng theo yêu cầu người dùng)
    var conLaiRow = allRows.length + 2;
    allRows.push([
      "[CÒN LẠI]",
      lastDate,
      conLai >= 0 ? "DƯ QUỸ" : "ÂM QUỸ",
      "💰 CÒN LẠI (TỒN QUỸ " + wk.toUpperCase() + ")",
      conLai,
      conLai >= 0 ? "Tồn quỹ an toàn" : "Thiếu hụt quỹ",
      "Tồn quỹ = Thu (" + formatMoneySimple(sumThu) + ") - Chi (" + formatMoneySimple(sumChi) + ")",
      formatTimeStr(timestamp)
    ]);
    styleDirectives.push({ row: conLaiRow, styleType: "CON_LAI", isNegative: conLai < 0 });

    // Dòng trống cách quãng giữa các tuần (nếu còn tuần tiếp theo)
    if (wIdx < weekOrder.length - 1) {
      allRows.push(["", "", "", "", "", "", "", ""]);
      styleDirectives.push({ row: allRows.length + 1, styleType: "SEPARATOR" });
    }
  }

  // 4. Xóa dữ liệu cũ và ghi ma trận mới vào Sheet
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 8).clear({ contentsOnly: false });
  }

  if (allRows.length > 0) {
    sheet.getRange(2, 1, allRows.length, 8).setValues(allRows);

    // Định dạng cột chung
    sheet.getRange(2, 1, allRows.length, 1).setHorizontalAlignment("center").setFontWeight("bold");
    sheet.getRange(2, 2, allRows.length, 1).setHorizontalAlignment("center");
    sheet.getRange(2, 3, allRows.length, 1).setHorizontalAlignment("center").setFontWeight("bold");
    sheet.getRange(2, 5, allRows.length, 1).setNumberFormat('#,##0 "đ"').setFontWeight("bold").setHorizontalAlignment("right");
    sheet.getRange(2, 8, allRows.length, 1).setHorizontalAlignment("center");

    // Tô màu và định dạng chuyên biệt cho từng loại dòng
    styleDirectives.forEach(function(st) {
      var r = st.row;
      if (st.styleType === "TRANS_THU") {
        sheet.getRange(r, 3).setFontColor("#047857");
        sheet.getRange(r, 5).setFontColor("#047857");
      } else if (st.styleType === "TRANS_CHI") {
        sheet.getRange(r, 3).setFontColor("#dc2626");
        sheet.getRange(r, 5).setFontColor("#dc2626");
      } else if (st.styleType === "SUM_THU") {
        var rangeThu = sheet.getRange(r, 1, 1, 8);
        rangeThu.setBackground("#ecfdf5").setFontWeight("bold");
        sheet.getRange(r, 3).setFontColor("#047857");
        sheet.getRange(r, 4).setFontColor("#065f46");
        sheet.getRange(r, 5).setFontColor("#047857");
      } else if (st.styleType === "SUM_CHI") {
        var rangeChi = sheet.getRange(r, 1, 1, 8);
        rangeChi.setBackground("#fef2f2").setFontWeight("bold");
        sheet.getRange(r, 3).setFontColor("#b91c1c");
        sheet.getRange(r, 4).setFontColor("#991b1b");
        sheet.getRange(r, 5).setFontColor("#dc2626");
      } else if (st.styleType === "CON_LAI") {
        var rangeConLai = sheet.getRange(r, 1, 1, 8);
        rangeConLai.setBackground("#fef3c7").setFontWeight("bold");
        sheet.getRange(r, 3).setFontColor(st.isNegative ? "#b91c1c" : "#1e3a8a");
        sheet.getRange(r, 4).setFontColor("#1e3a8a").setFontSize(11);
        sheet.getRange(r, 5).setFontColor(st.isNegative ? "#dc2626" : "#1e3a8a").setFontSize(11);
        // Kẻ viền trên nét liền và viền dưới nét đôi (Double border)
        rangeConLai.setBorder(true, false, true, false, false, false, "#d97706", SpreadsheetApp.BorderStyle.SOLID);
      } else if (st.styleType === "SEPARATOR") {
        sheet.getRange(r, 1, 1, 8).setBackground("#ffffff");
      }
    });
  }

  return { weeksCount: weekOrder.length, totalRows: allRows.length };
}

// Hàm định dạng chung cho SoQuy_ThuChi
function formatCashflowSheet(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 1).setHorizontalAlignment("center").setFontWeight("bold");
    sheet.getRange(2, 2, lastRow - 1, 1).setHorizontalAlignment("center");
    sheet.getRange(2, 3, lastRow - 1, 1).setHorizontalAlignment("center").setFontWeight("bold");
    sheet.getRange(2, 5, lastRow - 1, 1).setNumberFormat('#,##0 "đ"').setFontWeight("bold").setHorizontalAlignment("right");
    sheet.getRange(2, 8, lastRow - 1, 1).setHorizontalAlignment("center");
  }
}

// =============================================================================
// HÀM TIỆN ÍCH DÀNH CHO NGƯỜI DÙNG: THỐNG KÊ TỔNG CHI VÀ CÒN LẠI CUỐI MỖI TUẦN (SỔ QUỸ)
// =============================================================================
function thongKeSoQuyTheoTuan(ss, silent) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("SoQuy_ThuChi");
  if (!sheet) {
    if (!silent) showAlertSafe("Lỗi", "Chưa tìm thấy sheet SoQuy_ThuChi!");
    return { weeksCount: 0 };
  }

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    if (!silent) showAlertSafe("Thông báo", "Sheet SoQuy_ThuChi chưa có giao dịch nào để thống kê!");
    return { weeksCount: 0 };
  }

  // Đọc toàn bộ các dòng hiện có trên sheet
  var data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
  var rawRecords = [];

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var id = row[0] ? row[0].toString().trim() : "";
    var dateVal = row[1] ? formatDateForWeb(row[1]) : "";
    var type = row[2] ? row[2].toString().toUpperCase().trim() : "";
    var cat = row[3] ? row[3].toString().trim() : "";
    var amt = parseMoneySafe(row[4]);
    var payer = row[5] ? row[5].toString().trim() : "";
    var note = row[6] ? row[6].toString().trim() : "";

    // Bỏ qua dòng thống kê cũ
    if (!id || id.indexOf("[TỔNG") === 0 || id.indexOf("[CÒN LẠI") === 0 ||
        cat.indexOf("TỔNG CHI") !== -1 || cat.indexOf("CÒN LẠI") !== -1 ||
        (type !== "THU" && type !== "CHI")) {
      continue;
    }

    rawRecords.push({
      id: id,
      date: dateVal,
      type: type,
      category: cat,
      amount: amt,
      payer: payer,
      note: note
    });
  }

  var res = renderCashflowWithWeeklyTotals(sheet, rawRecords, new Date());

  if (!silent) {
    showAlertSafe(
      "✅ ĐÃ THỐNG KÊ SỔ QUỸ THÀNH CÔNG!",
      "Đã tự động tính toán và hiển thị:\n" +
      "- 🔴 TỔNG CHI\n" +
      "- 💰 CÒN LẠI (TỒN QUỸ)\n" +
      "ở dòng cuối của " + res.weeksCount + " tuần trong sheet SoQuy_ThuChi!"
    );
  }

  return res;
}

// =============================================================================
// HÀM TIỆN ÍCH DÀNH CHO NGƯỜI DÙNG: THỐNG KÊ NHẬT KÝ PHOTO THEO TUẦN (TAB 1)
// =============================================================================
function thongKePhotoTheoTuan(ss, silent) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("NhatKy_Photo");
  if (!sheet) {
    if (!silent) showAlertSafe("Lỗi", "Chưa tìm thấy sheet NhatKy_Photo!");
    return { weeksCount: 0 };
  }
  var res = renderPhotoWithWeeklyTotals(sheet, null, new Date());
  if (!silent) {
    showAlertSafe(
      "✅ ĐÃ THỐNG KÊ NHẬT KÝ PHOTO!",
      "Đã tự động tính toán và hiển thị dòng [TỔNG KẾT] cuối mỗi tuần:\n" +
      "- Tổng sĩ số & số lượng lẻ\n" +
      "- Tổng số bản in toàn trường\n" +
      "- Tổng thành tiền photo\n" +
      "cho " + res.weeksCount + " tuần trong sheet NhatKy_Photo!"
    );
  }
  return res;
}

// =============================================================================
// HÀM TIỆN ÍCH DÀNH CHO NGƯỜI DÙNG: THỐNG KÊ CÔNG NỢ THEO TUẦN (TAB 2)
// =============================================================================
function thongKeDebtTheoTuan(ss, silent) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("CongNo_TheoTuan");
  if (!sheet) {
    if (!silent) showAlertSafe("Lỗi", "Chưa tìm thấy sheet CongNo_TheoTuan!");
    return { weeksCount: 0 };
  }
  var res = renderDebtWithWeeklyTotals(sheet, null, new Date());
  if (!silent) {
    showAlertSafe(
      "✅ ĐÃ THỐNG KÊ CÔNG NỢ THEO TUẦN!",
      "Đã tự động tính toán và hiển thị dòng [TỔNG NỢ] cuối mỗi tuần:\n" +
      "- Tổng tiền nợ cũ/thiếu\n" +
      "- Tổng tiền photo tuần này\n" +
      "- TỔNG CẦN THU TOÀN TRƯỜNG\n" +
      "cho " + res.weeksCount + " tuần trong sheet CongNo_TheoTuan!"
    );
  }
  return res;
}

// =============================================================================
// HÀM TIỆN ÍCH: THỐNG KÊ TẤT CẢ 3 TAB TRONG 1 LẦN BẤM (ALL-IN-ONE)
// =============================================================================
function thongKeTatCaSheet(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  var pSheet = ss.getSheetByName("NhatKy_Photo");
  var dSheet = ss.getSheetByName("CongNo_TheoTuan");
  var cSheet = ss.getSheetByName("SoQuy_ThuChi");

  var resP = pSheet ? renderPhotoWithWeeklyTotals(pSheet, null, new Date()) : { weeksCount: 0 };
  var resD = dSheet ? renderDebtWithWeeklyTotals(dSheet, null, new Date()) : { weeksCount: 0 };
  var resC = cSheet ? thongKeSoQuyTheoTuan(ss, true) : { weeksCount: 0 };

  showAlertSafe(
    "✅ ĐÃ THỐNG KÊ TOÀN DIỆN CẢ 3 BẢNG THÀNH CÔNG!",
    "Hệ thống đã tự động tính và chèn dòng thống kê ở dòng cuối mỗi tuần cho:\n\n" +
    "1. 📄 NhatKy_Photo: Tổng Sĩ Số, Tổng Bản In & Tổng Tiền Photo.\n" +
    "2. 📋 CongNo_TheoTuan: Tổng Nợ Cũ, Tiền Photo & TỔNG CẦN THU.\n" +
    "3. 💰 SoQuy_ThuChi: 🔴 TỔNG CHI và 💰 CÒN LẠI (Tồn Quỹ)."
  );

  return { photo: resP, debt: resD, cashflow: resC };
}

// Helper: Hiển thị thông báo an toàn không gây crash nếu chạy ngầm
function showAlertSafe(title, msg) {
  try {
    SpreadsheetApp.getUi().alert(title, msg, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    Logger.log(title + ": " + msg);
  }
}

// Helper: Format Date cho Web App
function formatDateForWeb(d) {
  if (!d) return "";
  if (typeof d === "string") return d;
  try {
    var yyyy = d.getFullYear();
    var mm = (d.getMonth() + 1);
    var dd = d.getDate();
    return yyyy + "-" + (mm < 10 ? "0" + mm : mm) + "-" + (dd < 10 ? "0" + dd : dd);
  } catch (e) {
    return d.toString();
  }
}

// Helper: Format Time string DD/MM/YYYY HH:MM:SS
function formatTimeStr(d) {
  if (!d) d = new Date();
  var pad = function(n) { return n < 10 ? '0' + n : n; };
  try {
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' +
           pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  } catch(e) {
    return d.toString();
  }
}

// Helper: Parse tiền tệ an toàn từ chuỗi hoặc số
function parseMoneySafe(val) {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  var digits = val.toString().replace(/[^\d]/g, '');
  return parseInt(digits, 10) || 0;
}

// Helper: Format số tiền đơn giản
function formatMoneySimple(num) {
  return Number(num || 0).toLocaleString('vi-VN') + ' đ';
}

// =============================================================================
// HÀM TIỆN ÍCH DÀNH CHO NGƯỜI DÙNG: CHUẨN HÓA 1-CLICK TẤT CẢ 3 TAB
// =============================================================================
function chuanHoaVaDienTuan() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Chuẩn hóa Tab 1: NhatKy_Photo
  var pSheet = getOrCreatePhotoSheet(ss);
  var lastRow = pSheet.getLastRow();
  var deletedCount = 0;
  if (lastRow > 1) {
    for (var r = lastRow; r >= 2; r--) {
      var w11 = pSheet.getRange(r, 11).getValue().toString().trim();
      var w13 = pSheet.getLastColumn() >= 13 ? pSheet.getRange(r, 13).getValue().toString().trim() : "";
      if (w11 === "Tuần 10" || w13 === "Tuần 10") {
        pSheet.deleteRow(r);
        deletedCount++;
      }
    }
  }

  // 2. Chuẩn hóa Tab 2: CongNo_TheoTuan
  getOrCreateDebtSheet(ss);

  // 3. Chuẩn hóa Tab 3: SoQuy_ThuChi
  getOrCreateCashflowSheet(ss);

  // Tự động thống kê đồng loạt cả 3 bảng
  thongKeTatCaSheet(ss);

  Logger.log("ĐÃ CHUẨN HÓA & THỐNG KÊ THÀNH CÔNG CẢ 3 TAB CƠ SỞ DỮ LIỆU!");
}

// Tự động tạo menu trên thanh công cụ của Google Sheet khi mở file
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu("⚙️ QUẢN LÝ PHOTO")
    .addItem("📊 Thống kê TẤT CẢ 3 BẢNG (Photo + Công Nợ + Sổ Quỹ)", "thongKeTatCaSheet")
    .addSeparator()
    .addItem("1️⃣ Thống kê Tab 1: NhatKy_Photo", "thongKePhotoTheoTuan")
    .addItem("2️⃣ Thống kê Tab 2: CongNo_TheoTuan", "thongKeDebtTheoTuan")
    .addItem("3️⃣ Thống kê Tab 3: SoQuy_ThuChi", "thongKeSoQuyTheoTuan")
    .addSeparator()
    .addItem("🚀 Chuẩn hóa và kẻ khung 3 bảng CSDL", "chuanHoaVaDienTuan")
    .addItem("🧹 Dọn dẹp dòng trùng lặp (Photo)", "cleanDuplicates")
    .addToUi();
}

// Dọn dẹp dòng trùng lặp trên NhatKy_Photo
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
    if (!id || id.indexOf("[TỔNG") === 0) continue;

    if (seenIds[id]) {
      rowsToDelete.push(i + 2);
    } else {
      seenIds[id] = true;
    }
  }

  for (var k = rowsToDelete.length - 1; k >= 0; k--) {
    sheet.deleteRow(rowsToDelete[k]);
  }

  Logger.log("Đã dọn dẹp xong! Đã xóa " + rowsToDelete.length + " dòng trùng lặp.");
}
