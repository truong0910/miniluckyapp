// Deploy as a Web App and set access to anyone who has the URL.
// The backend sends the JSON payload built in backend/src/google-sheets-service.js.
function doGet() {
  return jsonResponse({ status: "ok", version: "v4-12-clean-columns" });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Trang tính1") || ss.getActiveSheet();
    var data = JSON.parse((e && e.postData && e.postData.contents) || "{}");

    if (!data.spinId) throw new Error("spinId is required");

    // Auto-ensure header row has 12 clean customer-friendly columns
    if (sheet.getLastRow() === 0 || sheet.getRange(1, 4).getValue() !== "Tên Sự Kiện") {
      sheet.getRange(1, 1, 1, 12).setValues([[
        "Thời Gian",
        "Tên Khách Hàng",
        "Số Điện Thoại",
        "Tên Sự Kiện",
        "Mã Sự Kiện",
        "Kết Quả",
        "Giá Trị Voucher",
        "Tên Voucher",
        "Mã Voucher",
        "Trạng Thái Award",
        "Thời Gian Gửi ZNS",
        "Thời Gian Đổi Thưởng"
      ]]);
      sheet.getRange(1, 1, 1, 12).setFontWeight("bold");
    }

    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      var existing = sheet.createTextFinder(String(data.spinId)).matchEntireCell(true).findNext();
      if (existing) return jsonResponse({ status: "duplicate", spinId: data.spinId });
    }

    sheet.appendRow([
      formatDate(data.timestamp) || formatDate(new Date()),
      data.customerName || "Khách hàng",
      "'" + (data.phone || ""),
      data.campaignName || "Chưa xác định",
      data.campaignCode || data.campaignId || "",
      data.outcome === "reward" ? "Trúng Voucher" : "May Mắn Lần Sau",
      Number(data.rewardValue || 0).toLocaleString("vi-VN") + "đ",
      data.rewardTitle || "May Mắn Lần Sau",
      data.rewardCode || "N/A",
      data.status || "",
      formatDate(data.deliveredAt),
      formatDate(data.redeemedAt)
    ]);

    // Attach spinId note for deduplication without polluting visible columns
    var newRow = sheet.getLastRow();
    sheet.getRange(newRow, 1).setNote("spinId:" + data.spinId);

    return jsonResponse({ status: "success", spinId: data.spinId });
  } catch (err) {
    return jsonResponse({ status: "error", message: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function formatDate(value) {
  if (!value) return "";
  var date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return "";
  var timezone = SpreadsheetApp.getActive().getSpreadsheetTimeZone() || "Asia/Ho_Chi_Minh";
  return Utilities.formatDate(date, timezone, "HH:mm:ss dd/MM/yyyy");
}

function jsonResponse(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
