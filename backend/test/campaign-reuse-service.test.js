import test from "node:test";
import assert from "node:assert/strict";
import {
  parseCustomerImportRows,
  parseDenominationsFromNote,
  extractGroupAndVoucherNote,
  matchDenominationToReward,
  validateVoucherImportRows,
} from "../src/campaign-reuse-service.js";

test("parseDenominationsFromNote extracts numeric values from Vietnamese text", () => {
  const result1 = parseDenominationsFromNote("5 triệu, 5 triệu, 3 triệu");
  assert.deepEqual(result1, [5000000, 5000000, 3000000]);

  const result2 = parseDenominationsFromNote("500k, 100k, 50k");
  assert.deepEqual(result2, [500000, 100000, 50000]);

  const result3 = parseDenominationsFromNote("5.000.000đ, 2.000.000đ");
  assert.deepEqual(result3, [5000000, 2000000]);
});

test("extractGroupAndVoucherNote separates group names from money voucher notes", () => {
  const res1 = extractGroupAndVoucherNote("4 triệu , 3 triệu , 3 triệu");
  assert.equal(res1.groupName, "");
  assert.equal(res1.note, "4 triệu, 3 triệu, 3 triệu");

  const res2 = extractGroupAndVoucherNote("VIP, 5 triệu , 3 triệu , 3 triệu");
  assert.equal(res2.groupName, "VIP");
  assert.equal(res2.note, "5 triệu, 3 triệu, 3 triệu");

  const res3 = extractGroupAndVoucherNote("Khách VIP Khai Trương");
  assert.equal(res3.groupName, "Khách VIP Khai Trương");
  assert.equal(res3.note, "");
});

test("parseCustomerImportRows normalizes Vietnamese phone numbers and validates columns", () => {
  const rows = [
    { "Tên KH": " Nguyễn Văn A ", "SĐT": "0912345678", "Số voucher tặng": "3", "Ghi chú": "5 triệu, 5 triệu, 3 triệu" },
    { "Tên KH": "Trần Thị B", "SĐT": "0987654321", "Số voucher tặng": "0", "Ghi chú": "" },
    { "Tên KH": "Lỗi Phone", "SĐT": "12345", "Số voucher tặng": "1", "Ghi chú": "1 triệu" },
  ];

  const parsed = parseCustomerImportRows(rows);
  assert.equal(parsed.length, 3);

  assert.equal(parsed[0].valid, true);
  assert.equal(parsed[0].phone, "0912345678");
  assert.equal(parsed[0].name, "Nguyễn Văn A");
  assert.equal(parsed[0].voucherCount, 3);
  assert.deepEqual(parsed[0].denominations, [5000000, 5000000, 3000000]);

  assert.equal(parsed[1].valid, true);
  assert.equal(parsed[1].voucherCount, 0);

  assert.equal(parsed[2].valid, false);
  assert.match(parsed[2].error, /phone|Số điện thoại/i);
});

test("matchDenominationToReward finds reward by value", () => {
  const rewards = [
    { id: "r1", title: "Voucher 5 triệu", value: 5000000, code_prefix: "V5M" },
    { id: "r2", title: "Voucher 3 triệu", value: 3000000, code_prefix: "V3M" },
  ];

  const match1 = matchDenominationToReward(5000000, rewards);
  assert.equal(match1.id, "r1");

  assert.throws(
    () => matchDenominationToReward(1000000, rewards),
    /Chưa có giải thưởng giá trị 1.000.000/,
  );
});

test("voucher import validation requires a denomination for every declared voucher", () => {
  const parsed = parseCustomerImportRows([
    { name: "Công ty A", phone: "0900000000", voucherCount: 2, note: "" },
  ]);
  const result = validateVoucherImportRows(parsed, []);
  assert.equal(result.validRows.length, 0);
  assert.match(result.errors[0], /mệnh giá|Mệnh giá|voucher/i);
});

test("parseCustomerImportRows tolerates column typos like 'Số vocher tặng' and infers count from note", () => {
  const rows = [
    {
      "Tên KH": "CÔNG TY TNHH TM SX & DV ĐẠI TRƯỜNG THÀNH",
      "SĐT": "0934252139",
      "Số vocher tặng": 3,
      "Ghi chú": "5 triệu , 5 triệu , 3 triệu",
    },
  ];

  const parsed = parseCustomerImportRows(rows);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].valid, true);
  assert.equal(parsed[0].voucherCount, 3);
  assert.deepEqual(parsed[0].denominations, [5000000, 5000000, 3000000]);
});
