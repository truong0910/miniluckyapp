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

export function extractGroupAndVoucherNote(rawText = "") {
  const text = String(rawText || "").trim();
  if (!text) return { groupName: "", note: "" };

  const parts = text.split(/[,;\n+]+/).map((s) => s.trim()).filter(Boolean);
  const groupParts = [];
  const noteParts = [];

  for (const part of parts) {
    const denominations = parseDenominationsFromNote(part);
    if (denominations.length > 0) {
      noteParts.push(part);
    } else {
      groupParts.push(part);
    }
  }

  return {
    groupName: groupParts.join(", "),
    note: noteParts.join(", "),
  };
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
  const normPhone = normalizePhone(row.phone);
  const { data: existing, error: lookupError } = await db
    .from("customers")
    .select("id")
    .eq("phone", normPhone)
    .is("deleted_at", null)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing?.id) return existing.id;

  const custId = `customer-${normPhone}`;
  const { error } = await db.from("customers").insert({
    id: custId,
    phone: normPhone,
    name: row.name,
    sex: "other",
    job: "other",
    total_spins: row.voucherCount || 1,
    deleted_at: null,
  });
  if (error) {
    if (error.code === "23505" || String(error.message).includes("customers_phone_key") || String(error.message).includes("unique constraint")) {
      const { data: fallback } = await db
        .from("customers")
        .select("id")
        .eq("phone", normPhone)
        .maybeSingle();
      if (fallback?.id) return fallback.id;
    }
    throw error;
  }
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

export async function checkImportCampaignParticipants({ db, campaignId, rows = [], importMode = "voucher" }) {
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

  if (errors.length > 0) {
    return {
      success: false,
      totalRows: rows.length,
      newCount: 0,
      duplicateCount: 0,
      duplicateRows: [],
      newRows: [],
      errors,
    };
  }

  // 1. Extract all normalized phones from valid file rows
  const filePhones = validRows.map((r) => normalizePhone(r.phone)).filter(Boolean);

  // 2. Fetch ALL matching customers from global customers table
  const globalPhoneMap = new Map();
  if (filePhones.length > 0) {
    const { data: globalCustRows } = await db
      .from("customers")
      .select("id, name, phone")
      .in("phone", filePhones);

    for (const c of globalCustRows || []) {
      if (c.phone) {
        globalPhoneMap.set(normalizePhone(c.phone), c);
      }
    }
  }

  // 3. Fetch existing participants in THIS campaign
  const { data: participantRows } = await db
    .from("campaign_participants")
    .select("id, customer_id, spin_quota, imported_group, note")
    .eq("campaign_id", campaignId);

  const participantMap = new Map();
  const existingCampaignCustomerIds = [];
  for (const p of participantRows || []) {
    participantMap.set(p.customer_id, p);
    existingCampaignCustomerIds.push(p.customer_id);
  }

  // 4. Fetch existing pre-assigned rewards for existing customers in THIS campaign
  const existingRewardsMap = new Map();
  if (existingCampaignCustomerIds.length > 0) {
    const { data: rewardRows } = await db
      .from("customer_rewards")
      .select("customer_id, title, value")
      .eq("campaign_id", campaignId)
      .in("customer_id", existingCampaignCustomerIds);

    for (const r of rewardRows || []) {
      const list = existingRewardsMap.get(r.customer_id) || [];
      list.push(`${r.title} (${Number(r.value || 0).toLocaleString("vi-VN")}đ)`);
      existingRewardsMap.set(r.customer_id, list);
    }
  }

  const duplicateRows = [];
  const newRows = [];
  const seenPhonesInFile = new Set();

  for (const row of validRows) {
    const normalizedPhone = normalizePhone(row.phone);
    const existingCust = globalPhoneMap.get(normalizedPhone);
    const existingParticipant = existingCust ? participantMap.get(existingCust.id) : null;
    const isFileDuplicate = seenPhonesInFile.has(normalizedPhone);

    if (existingCust || isFileDuplicate) {
      const custId = existingCust?.id;
      const currentRewards = custId ? (existingRewardsMap.get(custId) || []) : [];
      const dbName = existingCust?.name || "";
      const excelName = row.name || "";
      const isDifferentName = Boolean(dbName && excelName && dbName.trim().toLowerCase() !== excelName.trim().toLowerCase());

      duplicateRows.push({
        rowNumber: row.rowNumber,
        phone: row.phone,
        normalizedPhone,
        name: excelName,
        existingName: dbName || excelName,
        isDifferentName,
        inCampaign: Boolean(existingParticipant),
        note: row.note || "",
        voucherCount: row.voucherCount || 1,
        denominations: row.denominations || [],
        existingSpinQuota: existingParticipant?.spin_quota || 0,
        existingRewards: currentRewards,
        action: "skip",
      });
    } else {
      newRows.push({
        rowNumber: row.rowNumber,
        phone: row.phone,
        normalizedPhone,
        name: row.name,
        note: row.note || "",
        voucherCount: row.voucherCount || 1,
        denominations: row.denominations || [],
      });
      seenPhonesInFile.add(normalizedPhone);
    }
  }

  return {
    success: true,
    totalRows: rows.length,
    newCount: newRows.length,
    duplicateCount: duplicateRows.length,
    duplicateRows,
    newRows,
    errors: [],
  };
}

export async function importCampaignParticipants({
  db,
  campaignId,
  rows = [],
  importMode = "voucher",
  rowActions = {},
  duplicateMode = "skip",
}) {
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

  if (errors.length > 0) {
    return {
      success: false,
      totalRows: rows.length,
      importedCount: 0,
      invalidCount: errors.length,
      duplicateCount: 0,
      skippedCount: 0,
      accumulatedCount: 0,
      duplicatePhones: [],
      infoMessages: [],
      errors,
    };
  }

  // 1. Extract all normalized phones from valid file rows
  const filePhones = validRows.map((r) => normalizePhone(r.phone)).filter(Boolean);

  // 2. Fetch ALL matching customers from global customers table
  const globalPhoneMap = new Map();
  if (filePhones.length > 0) {
    const { data: globalCustRows } = await db
      .from("customers")
      .select("id, name, phone")
      .in("phone", filePhones);

    for (const c of globalCustRows || []) {
      if (c.phone) {
        globalPhoneMap.set(normalizePhone(c.phone), c);
      }
    }
  }

  // 3. Fetch existing participants in THIS campaign
  const { data: participantRows } = await db
    .from("campaign_participants")
    .select("id, customer_id, spin_quota, imported_group")
    .eq("campaign_id", campaignId);

  const participantMap = new Map();
  for (const p of participantRows || []) {
    participantMap.set(p.customer_id, p);
  }

  let importedCount = 0;
  let skippedCount = 0;
  let accumulatedCount = 0;
  const duplicatePhones = [];
  const infoMessages = [];

  for (const row of validRows) {
    try {
      const normalizedPhone = normalizePhone(row.phone);
      const existingCust = globalPhoneMap.get(normalizedPhone);
      const existingParticipant = existingCust ? participantMap.get(existingCust.id) : null;

      if (existingCust) {
        duplicatePhones.push(`${row.name} (${row.phone})`);
        const action = rowActions[normalizedPhone] || rowActions[row.phone] || duplicateMode || "skip";

        if (action === "skip") {
          skippedCount++;
          infoMessages.push(`Dòng ${row.rowNumber} (${row.name} - ${row.phone}): Đã có trong hệ thống ➔ BỎ QUA.`);
          continue;
        }

        if (action === "accumulate") {
          const custId = existingCust.id;
          const currentQuota = Number(existingParticipant?.spin_quota || 0);
          const addQuota = importMode === "quota" ? Math.max(1, row.voucherCount || 1) : (row.voucherCount || 0);
          const newQuota = currentQuota + addQuota;

          await db.from("campaign_participants").upsert({
            campaign_id: campaignId,
            customer_id: custId,
            spin_quota: newQuota,
            imported_group: row.note || existingParticipant?.imported_group || null,
            status: "active",
          }, { onConflict: "campaign_id,customer_id" });

          if (importMode === "voucher" && row.denominations?.length > 0) {
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

          accumulatedCount++;
          infoMessages.push(`Dòng ${row.rowNumber} (${row.name} - ${row.phone}): Đã CỘNG DỒN thêm ${addQuota} lượt quay & voucher.`);
          continue;
        }
      }

      // NEW CUSTOMER (Not duplicate)
      const custId = await findOrCreateCustomer({ db, row, importMode });

      const quota = importMode === "quota" ? Math.max(1, row.voucherCount || 1) : (row.voucherCount || 0);
      await db.from("campaign_participants").upsert({
        campaign_id: campaign.id,
        customer_id: custId,
        spin_quota: quota,
        imported_group: row.note || null,
        status: "active",
      }, { onConflict: "campaign_id,customer_id" });

      if (importMode === "voucher" && row.denominations?.length > 0) {
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

      // Track in local maps for subsequent rows in the same file
      globalPhoneMap.set(normalizedPhone, { id: custId, name: row.name, phone: normalizedPhone });
      participantMap.set(custId, { customer_id: custId, spin_quota: quota });
      importedCount++;
    } catch (err) {
      errors.push(`Dòng ${row.rowNumber} (${row.name}): ${err.message}`);
    }
  }

  return {
    success: errors.length === 0,
    totalRows: rows.length,
    importedCount,
    duplicateCount: duplicatePhones.length,
    skippedCount,
    accumulatedCount,
    duplicatePhones,
    infoMessages,
    invalidCount: errors.length,
    errors,
  };
}

export async function clearCustomerPreassignedRewards({ db, campaignId, customerId }) {
  const { error } = await db
    .from("customer_rewards")
    .delete()
    .eq("campaign_id", campaignId)
    .eq("customer_id", customerId);

  if (error) throw error;
  return { success: true };
}

export async function listCampaignParticipants({ db, campaignId, page = 1, limit = 20, search = "" }) {
  const cleanSearch = String(search || "").trim();
  const selectClause = cleanSearch
    ? "id,campaign_id,customer_id,status,spin_quota,imported_group,note,created_at,customers!inner(name,phone)"
    : "id,campaign_id,customer_id,status,spin_quota,imported_group,note,created_at,customers(name,phone)";

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

  const customerIds = [...new Set((rows || []).map((row) => row.customer_id))];
  const groupsMap = new Map();
  const groupIdsMap = new Map();
  const rewardsMap = new Map();

  if (customerIds.length > 0) {
    const { data: memberRows } = await db
      .from("customer_group_members")
      .select("customer_id, group_id, customer_groups(id, name)")
      .in("customer_id", customerIds);

    for (const m of memberRows || []) {
      const gId = m.group_id;
      const gName = m.customer_groups?.name;
      if (gName) {
        const existingNames = groupsMap.get(m.customer_id) || [];
        if (!existingNames.includes(gName)) existingNames.push(gName);
        groupsMap.set(m.customer_id, existingNames);

        const existingIds = groupIdsMap.get(m.customer_id) || [];
        if (!existingIds.includes(gId)) existingIds.push(gId);
        groupIdsMap.set(m.customer_id, existingIds);
      }
    }

    const { data: rewardRows } = await db
      .from("customer_rewards")
      .select("customer_id, title, value, code")
      .eq("campaign_id", campaignId)
      .in("customer_id", customerIds);

    for (const r of rewardRows || []) {
      const existingList = rewardsMap.get(r.customer_id) || [];
      existingList.push({ title: r.title, value: Number(r.value), code: r.code });
      rewardsMap.set(r.customer_id, existingList);
    }

    const spinsMap = new Map();
    const { data: spinRows } = await db
      .from("spin_events")
      .select("customer_id")
      .eq("campaign_id", campaignId)
      .in("customer_id", customerIds);

    for (const s of spinRows || []) {
      spinsMap.set(s.customer_id, (spinsMap.get(s.customer_id) || 0) + 1);
    }
  }

  const items = (rows || []).map((row) => {
    const assignedGroupNames = groupsMap.get(row.customer_id) || [];
    const assignedGroupIds = groupIdsMap.get(row.customer_id) || [];
    const plannedRewards = rewardsMap.get(row.customer_id) || [];
    const noteText = row.note || row.imported_group || "";
    const spinsUsed = spinsMap.get(row.customer_id) || 0;
    const totalQuota = Number(row.spin_quota || 0);
    const remainingSpins = Math.max(0, totalQuota - spinsUsed);

    return {
      id: row.id,
      campaignId: row.campaign_id,
      customerId: row.customer_id,
      customerName: row.customers?.name || row.customer_id,
      customerPhone: row.customers?.phone || "",
      note: noteText,
      groupId: assignedGroupIds[0] || "",
      assignedGroupIds,
      assignedGroups: assignedGroupNames,
      groupName: assignedGroupNames.join(", ") || "",
      plannedRewards: plannedRewards,
      status: row.status,
      spinQuota: totalQuota,
      spinsUsed,
      remainingSpins,
      registrationSource: row.registration_source || "admin",
      createdAt: row.created_at,
    };
  });

  return {
    items,
    page,
    limit,
    total: count || 0,
    totalPages: Math.ceil((count || 0) / limit),
    hasMore: start + items.length < (count || 0),
  };
}

export async function ensureCampaignParticipant({ db, campaignId, customerId, registrationSource = "zalo_guest" }) {
  if (!campaignId || !customerId) return null;

  const { data: existing, error: findError } = await db
    .from("campaign_participants")
    .select("id,campaign_id,customer_id,status,spin_quota,imported_group,registration_source,created_at")
    .eq("campaign_id", campaignId)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (findError) throw findError;
  if (existing) return existing;

  const { data: campaign, error: cmpError } = await db
    .from("campaigns")
    .select("id,allow_unlisted,unlisted_spin_quota,status")
    .eq("id", campaignId)
    .maybeSingle();

  if (cmpError) throw cmpError;
  if (!campaign) throw publicError("Không tìm thấy sự kiện", 404);

  if (!campaign.allow_unlisted) {
    throw publicError("Khách chưa được đăng ký trong sự kiện này", 403, "P0003");
  }

  const quota = Math.max(0, Number(campaign.unlisted_spin_quota ?? 1));
  const record = {
    campaign_id: campaignId,
    customer_id: customerId,
    status: "active",
    spin_quota: quota,
    registration_source: registrationSource,
  };

  const { data: created, error: insertError } = await db
    .from("campaign_participants")
    .upsert(record, { onConflict: "campaign_id,customer_id" })
    .select("id,campaign_id,customer_id,status,spin_quota,imported_group,registration_source,created_at")
    .single();

  if (insertError) throw insertError;
  return created;
}

export async function getParticipantDetail({ db, campaignId, customerId }) {
  const { data: participant, error: pErr } = await db
    .from("campaign_participants")
    .select("id,campaign_id,customer_id,status,spin_quota,imported_group,registration_source,created_at,customers(name,phone,sex,job)")
    .eq("campaign_id", campaignId)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (pErr) throw pErr;

  const { data: customer } = await db
    .from("customers")
    .select("id,name,phone,sex,job")
    .eq("id", customerId)
    .maybeSingle();

  // Count spins used in this campaign
  const { count: spinsUsed } = await db
    .from("spin_events")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("customer_id", customerId);

  return {
    campaignId,
    customerId,
    customerName: customer?.name || participant?.customers?.name || customerId,
    customerPhone: customer?.phone || participant?.customers?.phone || "",
    sex: customer?.sex || "other",
    job: customer?.job || "other",
    status: participant?.status || "none",
    spinQuota: participant?.spin_quota || 0,
    spinsUsed: spinsUsed || 0,
    spinsRemaining: Math.max(0, (participant?.spin_quota || 0) - (spinsUsed || 0)),
    importedGroup: participant?.imported_group || "",
    note: participant?.note || "",
    registrationSource: participant?.registration_source || "none",
    hasParticipant: Boolean(participant),
  };
}

export async function createManualCampaignParticipant({
  db,
  campaignId,
  name,
  phone,
  spinQuota = 1,
  status = "active",
  groupName = "",
  groupId = null,
  note = "",
  importedGroup = "",
  selectedRewardIds = [],
}) {
  const normalizedPhone = normalizePhone(phone);
  if (!isValidVietnamesePhone(normalizedPhone)) {
    throw publicError("Số điện thoại không hợp lệ", 400);
  }
  const cleanName = String(name || "").trim();
  if (!cleanName) {
    throw publicError("Tên khách hàng là bắt buộc", 400);
  }

  const custId = await findOrCreateCustomer({ db, row: { name: cleanName, phone: normalizedPhone }, importMode: "quota" });
  await db.from("customers").update({ name: cleanName }).eq("id", custId);

  if (groupId) {
    await db.from("customer_group_members").upsert(
      { group_id: groupId, customer_id: custId },
      { onConflict: "group_id,customer_id" }
    );
  }

  const rewardIds = Array.isArray(selectedRewardIds) ? selectedRewardIds.filter(Boolean) : [];
  if (rewardIds.length > 0) {
    const { data: rewardRows } = await db
      .from("reward_catalog")
      .select("id,code_prefix,title,value,description,wheel_label,symbol")
      .in("id", rewardIds);

    if (rewardRows && rewardRows.length > 0) {
      const assignments = rewardRows.map((reward) => ({
        campaign_id: campaignId,
        customer_id: custId,
        code: `${reward.code_prefix}_${Date.now().toString(36).toUpperCase()}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        title: reward.title,
        value: Number(reward.value),
        description: reward.description || "",
        wheel_label: reward.wheel_label,
        result: ["star", "star", "star"],
      }));
      await db.from("customer_rewards").insert(assignments);
    }
  }

  const effectiveQuota = Math.max(Number(spinQuota || 1), rewardIds.length);
  const cleanGroup = String(groupName || importedGroup || "").trim();
  const cleanNote = String(note || "").trim();

  const record = {
    campaign_id: campaignId,
    customer_id: custId,
    spin_quota: effectiveQuota,
    status: status && ["active", "paused", "removed"].includes(status) ? status : "active",
    imported_group: cleanGroup || null,
    note: cleanNote || null,
    registration_source: "admin",
  };

  const { data, error } = await db
    .from("campaign_participants")
    .upsert(record, { onConflict: "campaign_id,customer_id" })
    .select("id,campaign_id,customer_id,status,spin_quota,imported_group,note,registration_source,created_at")
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCampaignParticipant({ db, campaignId, customerId }) {
  const { error } = await db
    .from("campaign_participants")
    .delete()
    .eq("campaign_id", campaignId)
    .eq("customer_id", customerId);

  if (error) throw error;
  return { success: true };
}

export async function updateParticipantQuotaStatus({
  db,
  campaignId,
  customerId,
  status,
  spinQuota,
  name,
  groupName,
  groupId,
  note,
  importedGroup,
  selectedRewardIds,
}) {
  let participant = await ensureCampaignParticipant({ db, campaignId, customerId, registrationSource: "admin" });

  if (name && name.trim()) {
    await db.from("customers").update({ name: name.trim() }).eq("id", customerId);
  }

  if (groupId !== undefined) {
    if (groupId) {
      await db.from("customer_group_members").upsert(
        { group_id: groupId, customer_id: customerId },
        { onConflict: "group_id,customer_id" }
      );
    }
  }

  const patch = {};
  if (status && ["active", "paused", "removed"].includes(status)) patch.status = status;
  if (spinQuota !== undefined) patch.spin_quota = Math.max(0, Number(spinQuota));

  if (Array.isArray(selectedRewardIds)) {
    const rewardIds = selectedRewardIds.filter(Boolean);
    await db
      .from("customer_rewards")
      .delete()
      .eq("campaign_id", campaignId)
      .eq("customer_id", customerId);

    if (rewardIds.length > 0) {
      const { data: rewardRows } = await db
        .from("reward_catalog")
        .select("id,code_prefix,title,value,description,wheel_label")
        .in("id", rewardIds);

      if (rewardRows && rewardRows.length > 0) {
        const assignments = rewardRows.map((reward) => ({
          campaign_id: campaignId,
          customer_id: customerId,
          code: `${reward.code_prefix}_${Date.now().toString(36).toUpperCase()}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
          title: reward.title,
          value: Number(reward.value),
          description: reward.description || "",
          wheel_label: reward.wheel_label,
          result: ["star", "star", "star"],
        }));
        await db.from("customer_rewards").insert(assignments);
      }
    }
    const currentQuota = spinQuota !== undefined ? Number(spinQuota) : Number(participant.spin_quota || 0);
    patch.spin_quota = Math.max(currentQuota, rewardIds.length);
  }

  const cleanGroup = groupName !== undefined ? groupName : importedGroup;
  if (cleanGroup !== undefined) patch.imported_group = String(cleanGroup || "").trim() || null;
  if (note !== undefined) patch.note = String(note || "").trim() || null;

  const { data, error } = await db
    .from("campaign_participants")
    .update(patch)
    .eq("campaign_id", campaignId)
    .eq("customer_id", customerId)
    .select("id,campaign_id,customer_id,status,spin_quota,imported_group,note,registration_source,created_at")
    .single();

  if (error) throw error;
  return data;
}

export async function getParticipantPlannedRewards({ db, campaignId, customerId }) {
  const { data, error } = await db
    .from("customer_rewards")
    .select("id,code,title,value,description,wheel_label,result,created_at")
    .eq("campaign_id", campaignId)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function updateParticipantPlannedRewards({ db, campaignId, customerId, assignments = [] }) {
  // Check if customer has executed any spin in this campaign
  const { count: spinCount } = await db
    .from("spin_events")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("customer_id", customerId);

  if (spinCount > 0) {
    throw publicError("Khách đã quay, không thể sửa voucher cấp sẵn. Vui lòng sử dụng tính năng Cấp quà bổ sung.", 400);
  }

  // Delete current campaign planned rewards
  await db.from("customer_rewards").delete().eq("campaign_id", campaignId).eq("customer_id", customerId);

  if (Array.isArray(assignments) && assignments.length > 0) {
    const records = assignments.map((item) => ({
      campaign_id: campaignId,
      customer_id: customerId,
      code: String(item.code || "").trim(),
      title: String(item.title || "").trim(),
      value: Number(item.value || 0),
      description: String(item.description || ""),
      wheel_label: item.wheelLabel || item.wheel_label || `${Number(item.value || 0).toLocaleString("vi-VN")}đ`,
      result: item.result || ["star", "star", "star"],
    })).filter((item) => item.code && item.value > 0);

    if (records.length > 0) {
      const { error: insErr } = await db.from("customer_rewards").insert(records);
      if (insErr) throw insErr;
    }
  }

  return getParticipantPlannedRewards({ db, campaignId, customerId });
}

export async function issueManualAward({ db, campaignId, customerId, rewardId, code, reason, issuedBy = "admin" }) {
  if (!reason || !reason.trim()) {
    throw publicError("Lý do cấp quà bổ sung là bắt buộc", 400);
  }

  const { data: reward, error: rErr } = await db
    .from("reward_catalog")
    .select("id,code_prefix,title,value,description,wheel_label,symbol")
    .eq("id", rewardId)
    .maybeSingle();

  if (rErr || !reward) throw publicError("Giải thưởng không hợp lệ", 404);

  // Ensure target customer exists in public.customers to satisfy foreign key constraint
  const { data: existingCust } = await db
    .from("customers")
    .select("id,name,phone")
    .eq("id", customerId)
    .maybeSingle();

  if (!existingCust) {
    const validPhone = /^0(3|5|7|8|9)\d{8}$/.test(customerId) ? customerId : "0900000000";
    await db.from("customers").upsert({
      id: customerId,
      name: `Khách hàng ${customerId}`,
      phone: validPhone,
      total_spins: 1,
    });
  }

  const awardCode = String(code || `${reward.code_prefix || "AWD"}-${Date.now()}`).trim();

  // Create a spin_event entry for audit and satisfy spin_event_id constraint
  let spinEventId = null;
  const { data: manualSpinEvent } = await db
    .from("spin_events")
    .insert({
      campaign_id: campaignId,
      customer_id: customerId,
      reward_id: reward.id,
      outcome: "reward",
      created_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();

  if (manualSpinEvent?.id) {
    spinEventId = manualSpinEvent.id;
  }

  const record = {
    campaign_id: campaignId,
    customer_id: customerId,
    spin_event_id: spinEventId,
    reward_id: reward.id,
    status: "issued",
    code: awardCode,
    title_snapshot: reward.title,
    value_snapshot: Math.max(0, Number(reward.value || 0)),
    description_snapshot: reward.description || "",
    result: [reward.symbol || "star", reward.symbol || "star", reward.symbol || "star"],
    issued_at: new Date().toISOString(),
  };

  const { data: created, error: insErr } = await db
    .from("awards")
    .insert(record)
    .select()
    .single();

  if (insErr) {
    if (insErr.code === "23505") {
      throw publicError("Mã Voucher này đã tồn tại trong hệ thống. Vui lòng chọn hoặc tạo mã khác.", 400);
    }
    throw publicError(`Không thể cấp quà bổ sung: ${insErr.message}`, 400);
  }
  return created;
}

