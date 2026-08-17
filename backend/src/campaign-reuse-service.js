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
    const name = String(row["Tên KH"] || row["Tên Khách Hàng"] || row["Tên khách hàng"] || row.name || "").trim();
    const phoneRaw = String(row["SĐT"] || row["Số điện thoại"] || row["SDT"] || row.phone || "").trim();
    const voucherCountRaw =
      row["Số voucher tặng"] ??
      row["Số vocher tặng"] ??
      row["Số voucher"] ??
      row["Số vocher"] ??
      row["Số lượng voucher"] ??
      row["Số lượng vocher"] ??
      row["Số lượng"] ??
      row.voucherCount ??
      row.voucher_count ??
      undefined;

    const note = String(row["Ghi chú"] || row["Ghi chu"] || row.note || "").trim();

    if (!name) {
      return { valid: false, rowNumber: idx + 1, error: "Tên KH không được để trống" };
    }

    const phone = normalizePhone(phoneRaw);
    if (!isValidVietnamesePhone(phone)) {
      return { valid: false, rowNumber: idx + 1, name, error: "Số điện thoại không hợp lệ" };
    }

    const denominations = parseDenominationsFromNote(note);
    let voucherCount = voucherCountRaw !== undefined ? Math.max(0, parseInt(String(voucherCountRaw), 10) || 0) : 0;

    if (voucherCount === 0 && denominations.length > 0) {
      voucherCount = denominations.length;
    }

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
    throw publicError(`Chưa có giải thưởng giá trị ${value.toLocaleString("vi-VN")}đ trong tab 'Giải thưởng' — vui lòng vào tab Giải thưởng tạo phần quà giá trị ${value.toLocaleString("vi-VN")}đ trước khi tiếp tục`);
  }
  return match;
}

export function validateVoucherImportRows(parsedRows = [], rewards = []) {
  const validRows = [];
  const errors = [];

  for (const row of parsedRows) {
    if (!row.valid) {
      errors.push(`Dòng ${row.rowNumber}: ${row.error}`);
      continue;
    }
    if (row.voucherCount <= 0 || row.denominations.length !== row.voucherCount) {
      errors.push(`Dòng ${row.rowNumber}: Cần ghi đúng số mệnh giá trong cột Ghi chú`);
      continue;
    }
    try {
      row.denominations.forEach((denomination) => matchDenominationToReward(denomination, rewards));
      validRows.push(row);
    } catch (error) {
      errors.push(`Dòng ${row.rowNumber}: ${error.message}`);
    }
  }

  return { validRows, errors };
}

async function findOrCreateCustomer({ db, row, importMode }) {
  const { data: existing, error: lookupError } = await db
    .from("customers")
    .select("id")
    .eq("phone", row.phone)
    .is("deleted_at", null)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing?.id) return existing.id;

  const custId = `customer-${row.phone}`;
  const { error } = await db.from("customers").insert({
    id: custId,
    phone: row.phone,
    name: row.name,
    sex: "other",
    job: "other",
    total_spins: importMode === "quota" ? row.voucherCount : 5,
    deleted_at: null,
  });
  if (error) throw error;
  return custId;
}

export async function cloneCampaign({ db, sourceCampaignId, newCode, newName, cloneMode = "config_only" }) {
  const source = await getCampaign({ db, id: sourceCampaignId });
  const newCampaign = await createCampaign({ db, input: { code: newCode, name: newName, timezone: source.timezone } });

  // Clone rules and spin configs if present
  const { data: rules } = await db.from("campaign_rules").select("*").eq("campaign_id", sourceCampaignId);
  if (rules && rules.length > 0) {
    for (const rule of rules) {
      const { data: newRule } = await db
        .from("campaign_rules")
        .insert({
          campaign_id: newCampaign.id,
          name: `${rule.name} (Cloned)`,
          code: `${rule.code}_CLONED_${Date.now().toString(36).toUpperCase()}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
          scope: rule.scope,
          priority: rule.priority,
          active: rule.active,
          allow_unlisted: rule.allow_unlisted,
          oa_required: rule.oa_required,
          allow_refollow: rule.allow_refollow,
          max_total_wins: rule.max_total_wins,
        })
        .select("id")
        .single();

      if (newRule?.id) {
        const { data: configs } = await db.from("rule_spin_configs").select("*").eq("rule_id", rule.id);
        for (const cfg of configs || []) {
          const { data: newCfg } = await db
            .from("rule_spin_configs")
            .insert({
              rule_id: newRule.id,
              spin_number: cfg.spin_number,
              spin_count: cfg.spin_count,
              win_rate: cfg.win_rate,
              max_wins: cfg.max_wins,
              special_conditions: cfg.special_conditions,
            })
            .select("id")
            .single();

          if (newCfg?.id) {
            const { data: spinRewards } = await db.from("rule_spin_rewards").select("*").eq("spin_config_id", cfg.id);
            for (const rw of spinRewards || []) {
              await db.from("rule_spin_rewards").insert({
                spin_config_id: newCfg.id,
                reward_id: rw.reward_id,
                probability: rw.probability,
                quantity: rw.quantity,
                remaining_quantity: rw.quantity,
              });
            }
          }
        }
      }
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

  let validRows = parsedRows.filter((r) => r.valid);
  let errors = parsedRows.filter((r) => !r.valid).map((r) => `Dòng ${r.rowNumber}: ${r.error}`);
  let rewards = [];

  if (importMode === "voucher") {
    const { data: rewardRows, error: rewardsError } = await db
      .from("reward_catalog")
      .select("id,code_prefix,title,value,description,wheel_label,active")
      .eq("active", true);
    if (rewardsError) throw rewardsError;
    rewards = rewardRows || [];

    const validated = validateVoucherImportRows(parsedRows, rewards);
    validRows = validated.validRows;
    errors = validated.errors;
  }

  // Never partially assign an import: the Admin must correct every row first.
  if (errors.length > 0) {
    return { success: false, totalRows: rows.length, importedCount: 0, invalidCount: errors.length, errors };
  }

  let importedCount = 0;

  for (const row of validRows) {
    try {
      // 1. Find or create customer
      const custId = await findOrCreateCustomer({ db, row, importMode });

      // 2. Upsert campaign_participants
      await db.from("campaign_participants").upsert({
        campaign_id: campaign.id,
        customer_id: custId,
        spin_quota: importMode === "quota" ? Math.max(1, row.voucherCount || 1) : (row.voucherCount || 0),
        imported_group: row.note || null,
        status: "active",
      }, { onConflict: "campaign_id,customer_id" });

      // 3. Create pre-assigned customer_rewards if voucher mode
      if (importMode === "voucher") {
        const assignments = row.denominations.map((denom) => {
          const reward = matchDenominationToReward(denom, rewards || []);
          return {
            campaign_id: campaign.id,
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
  const cleanSearch = String(search || "").trim();
  const selectClause = cleanSearch
    ? "id,campaign_id,customer_id,status,spin_quota,imported_group,created_at,customers!inner(name,phone)"
    : "id,campaign_id,customer_id,status,spin_quota,imported_group,created_at,customers(name,phone)";

  let query = db
    .from("campaign_participants")
    .select(selectClause, { count: "exact" })
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });

  if (cleanSearch) {
    query = query.or(`customer_id.ilike.%${cleanSearch}%,customers.name.ilike.%${cleanSearch}%,customers.phone.ilike.%${cleanSearch}%`);
  }

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
