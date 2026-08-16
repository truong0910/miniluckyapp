import { createCampaign, getCampaign } from "./campaign-service.js";
import { isValidVietnamesePhone, normalizePhone, publicError } from "./utils.js";

export function parseDenominationsFromNote(noteRaw = "") {
  const text = String(noteRaw || "").trim();
  if (!text) return [];

  const parts = text.split(/[,;\n+]+/).map((s) => s.trim()).filter(Boolean);
  const results = [];

  for (const part of parts) {
    const clean = part.toLowerCase().replace(/\s+/g, "");
    let val = 0;

    const trieuMatch = clean.match(/^(\d+(?:[.,]\d+)?)(?:triệu|trieu|m)$/);
    const kMatch = clean.match(/^(\d+(?:[.,]\d+)?)(?:k|ngàn|ngan)$/);
    const numMatch = clean.match(/^(\d[\d.,]*)(?:đ|vnd|dong)?$/);

    if (trieuMatch) {
      val = Math.round(parseFloat(trieuMatch[1].replace(",", ".")) * 1_000_000);
    } else if (kMatch) {
      val = Math.round(parseFloat(kMatch[1].replace(",", ".")) * 1_000);
    } else if (numMatch) {
      const rawNum = numMatch[1].replace(/[.,]/g, "");
      val = parseInt(rawNum, 10) || 0;
    }

    if (val > 0) {
      results.push(val);
    }
  }

  return results;
}

export function parseCustomerImportRows(rows = []) {
  if (!Array.isArray(rows)) return [];

  return rows.map((row, idx) => {
    const name = String(row["Tên KH"] || row.name || "").trim();
    const phoneRaw = String(row["SĐT"] || row.phone || "").trim();
    const voucherCountRaw = row["Số voucher tặng"] ?? row.voucherCount ?? 0;
    const note = String(row["Ghi chú"] || row.note || "").trim();

    if (!name) {
      return { valid: false, rowNumber: idx + 1, error: "Tên KH không được để trống" };
    }

    const phone = normalizePhone(phoneRaw);
    if (!isValidVietnamesePhone(phone)) {
      return { valid: false, rowNumber: idx + 1, name, error: "Số điện thoại không hợp lệ" };
    }

    const voucherCount = Math.max(0, parseInt(String(voucherCountRaw), 10) || 0);
    const denominations = parseDenominationsFromNote(note);

    if (voucherCount > 0 && denominations.length > 0 && denominations.length !== voucherCount) {
      return {
        valid: false,
        rowNumber: idx + 1,
        name,
        phone,
        error: `Số lượng voucher (${voucherCount}) không khớp với danh sách ghi chú (${denominations.length} mệnh giá)`,
      };
    }

    return {
      valid: true,
      rowNumber: idx + 1,
      name,
      phone,
      voucherCount,
      note,
      denominations,
    };
  });
}

export function matchDenominationToReward(value, rewards = []) {
  const match = (rewards || []).find((r) => Number(r.value) === Number(value));
  if (!match) {
    throw publicError(`Chưa có giải thưởng giá trị ${value.toLocaleString("vi-VN")}đ trong sự kiện — vui lòng tạo giải thưởng trước khi tiếp tục`);
  }
  return match;
}

export async function cloneCampaign({ db, sourceCampaignId, newCode, newName, cloneMode = "config_only" }) {
  const source = await getCampaign({ db, id: sourceCampaignId });
  const newCampaign = await createCampaign({ db, input: { code: newCode, name: newName, timezone: source.timezone } });

  // Clone rules and spin configs if present
  const { data: rules } = await db.from("campaign_rules").select("*").eq("scope", source.code);
  if (rules && rules.length > 0) {
    for (const rule of rules) {
      await db.from("campaign_rules").insert({
        name: `${rule.name} (Cloned)`,
        code: `${rule.code}_CLONED_${Date.now().toString(36).toUpperCase()}`,
        scope: newCampaign.code,
        priority: rule.priority,
        active: rule.active,
        max_total_wins: rule.max_total_wins,
        oa_required: rule.oa_required,
      });
    }
  }

  // Audience clone mode
  if (cloneMode === "config_and_audience") {
    const { data: participants } = await db
      .from("campaign_participants")
      .select("customer_id,spin_quota,imported_group")
      .eq("campaign_id", sourceCampaignId);

    if (participants && participants.length > 0) {
      const rowsToInsert = participants.map((p) => ({
        campaign_id: newCampaign.id,
        customer_id: p.customer_id,
        spin_quota: p.spin_quota,
        imported_group: p.imported_group,
        status: "active",
      }));
      await db.from("campaign_participants").insert(rowsToInsert);
    }
  }

  return { ...newCampaign, cloneMode };
}

export async function importCampaignParticipants({ db, campaignId, rows = [], importMode = "voucher" }) {
  const campaign = await getCampaign({ db, id: campaignId });
  const parsedRows = parseCustomerImportRows(rows);

  const validRows = parsedRows.filter((r) => r.valid);
  const invalidRows = parsedRows.filter((r) => !r.valid);

  if (invalidRows.length > 0 && validRows.length === 0) {
    return {
      success: false,
      totalRows: rows.length,
      importedCount: 0,
      invalidCount: invalidRows.length,
      errors: invalidRows.map((r) => `Dòng ${r.rowNumber}: ${r.error}`),
    };
  }

  // Fetch campaign rewards for denomination matching if voucher mode
  const { data: rewards } = await db.from("reward_catalog").select("id,code_prefix,title,value,description,wheel_label,active").eq("active", true);

  let importedCount = 0;
  const errors = invalidRows.map((r) => `Dòng ${r.rowNumber}: ${r.error}`);

  for (const row of validRows) {
    try {
      // 1. Find or create customer
      const custId = `customer-${row.phone}`;
      await db.from("customers").upsert({
        id: custId,
        phone: row.phone,
        name: row.name,
        sex: "other",
        job: "other",
        total_spins: importMode === "quota" ? row.voucherCount : 5,
        deleted_at: null,
      });

      // 2. Upsert campaign_participants
      await db.from("campaign_participants").upsert({
        campaign_id: campaign.id,
        customer_id: custId,
        spin_quota: importMode === "quota" ? row.voucherCount : 0,
        imported_group: row.note || null,
        status: "active",
      }, { onConflict: "campaign_id,customer_id" });

      // 3. Create pre-assigned customer_rewards if voucher mode
      if (importMode === "voucher" && row.denominations.length > 0) {
        const assignments = row.denominations.map((denom) => {
          const reward = matchDenominationToReward(denom, rewards || []);
          return {
            customer_id: custId,
            code: `${reward.code_prefix}_${Date.now().toString(36).toUpperCase()}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
            title: reward.title,
            value: Number(reward.value),
            description: reward.description || "",
            wheel_label: reward.wheel_label,
            result: ["star", "star", "star"],
          };
        });

        await db.from("customer_rewards").insert(assignments);
      }

      importedCount++;
    } catch (err) {
      errors.push(`Dòng ${row.rowNumber} (${row.name}): ${err.message}`);
    }
  }

  return {
    success: errors.length === 0,
    totalRows: rows.length,
    importedCount,
    invalidCount: errors.length,
    errors,
  };
}

export async function listCampaignParticipants({ db, campaignId, page = 1, limit = 20, search = "" }) {
  let query = db
    .from("campaign_participants")
    .select("id,campaign_id,customer_id,status,spin_quota,imported_group,created_at,customers(name,phone)", { count: "exact" })
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });

  const start = (page - 1) * limit;
  query = query.range(start, start + limit - 1);

  const { data: rows, count, error } = await query;
  if (error) throw error;

  const items = (rows || []).map((row) => ({
    id: row.id,
    campaignId: row.campaign_id,
    customerId: row.customer_id,
    customerName: row.customers?.name || row.customer_id,
    customerPhone: row.customers?.phone || "",
    status: row.status,
    spinQuota: row.spin_quota,
    importedGroup: row.imported_group || "",
    createdAt: row.created_at,
  }));

  return {
    items,
    page,
    limit,
    total: count || 0,
    hasMore: start + items.length < (count || 0),
  };
}
