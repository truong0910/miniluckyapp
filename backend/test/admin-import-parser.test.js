import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "../../admin-web/node_modules/xlsx/xlsx.mjs";
import { parseCsvToRows, parseWorkbookToRows } from "../../admin-web/src/import-parser.js";

test("customer import parser handles the supplied CSV headers", () => {
  const rows = parseCsvToRows(
    'Tên KH,SĐT,Số voucher tặng,Ghi chú\n"Công ty A",0900000000,3,"5 triệu, 5 triệu, 3 triệu"',
  );
  assert.deepEqual(rows, [
    {
      "Tên KH": "Công ty A",
      "SĐT": "0900000000",
      "Số voucher tặng": "3",
      "Ghi chú": "5 triệu, 5 triệu, 3 triệu",
    },
  ]);
});

test("customer import parser reads native XLSX workbooks", () => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Tên KH", "SĐT", "Số voucher tặng", "Ghi chú"],
    ["Công ty B", "0912345678", 3, "5 triệu, 5 triệu, 3 triệu"],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "Khách hàng");
  const rows = parseWorkbookToRows(XLSX.write(workbook, { type: "array", bookType: "xlsx" }));
  assert.equal(rows[0]["Tên KH"], "Công ty B");
  assert.equal(rows[0]["Số voucher tặng"], 3);
});
