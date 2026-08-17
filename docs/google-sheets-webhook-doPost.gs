// Deploy as a Web App and set access to anyone who has the URL.
// The backend sends the JSON payload built in backend/src/google-sheets-service.js.
function doGet() {
  return jsonResponse({ status: "ok", version: "v3-14-columns" });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var spreadsheetId = "142rxh1T_AC1ztwRCJd4q1T0eBbaD9-MAEcjp95Hb_KM";
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = ss.getSheetByName("Trang tính1") || ss.getActiveSheet();
    var data = JSON.parse((e && e.postData && e.postData.contents) || "{}");

    if (!data.spinId) throw new Error("spinId is required");

    // Auto-ensure header row has all 14 columns
    if (sheet.getLastRow() === 0 || sheet.getRange(1, 13).getValue() !== "ID Sự Kiện") {
      sheet.getRange(1, 1, 1, 14).setValues([[
        "Thời Gian",
        "Tên Khách Hàng",
        "Số Điện Thoại",
        "Kết Quả",
        "Giá Trị Voucher",
        "Tên Voucher",
        "Mã Voucher",
        "Mã Lượt Quay",
        "Award ID",
        "Trạng Thái Award",
        "Delivered At",
        "Redeemed At",
        "ID Sự Kiện",
        "Tên Sự Kiện"
      ]]);
      sheet.getRange(1, 1, 1, 14).setFontWeight("bold");
    }

    // H is the existing Mã Lượt Quay column. Retrying the same spin is a no-op.
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      var existing = sheet.getRange(2, 8, lastRow - 1, 1)
        .createTextFinder(String(data.spinId))
        .matchEntireCell(true)
        .findNext();
      if (existing) return jsonResponse({ status: "duplicate", spinId: data.spinId });
    }

    sheet.appendRow([
      formatDate(data.timestamp) || formatDate(new Date()),
      data.customerName || "Khách hàng",
      "'" + (data.phone || ""),
      data.outcome === "reward" ? "Trúng Voucher" : "May Mắn Lần Sau",
      Number(data.rewardValue || 0).toLocaleString("vi-VN") + "đ",
      data.rewardTitle || "May Mắn Lần Sau",
      data.rewardCode || "N/A",
      data.spinId,
      data.awardId || "",
      data.status || "",
      formatDate(data.deliveredAt),
      formatDate(data.redeemedAt),
      data.campaignId || "",
      data.campaignName || ""
    ]);

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
