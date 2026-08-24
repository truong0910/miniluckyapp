-- Development-only fixture data. Never apply this file to production.
-- Apply after the numbered migrations when a local/test project needs sample
-- customers for manual preview-mode checks.

insert into public.customers (id, phone, name, sex, job, total_spins)
values
  ('KH001', '0934252139', 'CONG TY DAI TRUONG THANH', 'other', 'other', 5),
  ('KH002', '0900000002', 'TRAN THI B', 'female', 'other', 2),
  ('KH003', '0327925082', 'KHACH HANG 0327925082', 'other', 'other', 15)
on conflict (id) do update
set phone = excluded.phone,
    name = excluded.name,
    sex = excluded.sex,
    job = excluded.job,
    total_spins = excluded.total_spins,
    deleted_at = null;

insert into public.customer_rewards (customer_id, code, title, value, description, result)
values
  ('KH001', 'DTT_VOUCHER_5M_01', 'Voucher 5.000.000d', 5000000, 'Voucher mua hang tri gia 5.000.000d', '["red_envelope","red_envelope","red_envelope"]'),
  ('KH001', 'DTT_VOUCHER_5M_02', 'Voucher 5.000.000d', 5000000, 'Voucher mua hang tri gia 5.000.000d', '["red_envelope","red_envelope","red_envelope"]'),
  ('KH001', 'DTT_VOUCHER_3M_03', 'Voucher 3.000.000d', 3000000, 'Voucher mua hang tri gia 3.000.000d', '["star","star","star"]'),
  ('KH002', 'VOUCHER_100K_01', 'Voucher 100.000d', 100000, 'Voucher mua hang tri gia 100.000d', '["bell","bell","bell"]'),
  ('KH003', 'KH003_VOUCHER_5M_01', 'Voucher 5.000.000d', 5000000, 'Voucher mua hang tri gia 5.000.000d', '["red_envelope","red_envelope","red_envelope"]'),
  ('KH003', 'KH003_VOUCHER_5M_02', 'Voucher 5.000.000d', 5000000, 'Voucher mua hang tri gia 5.000.000d', '["red_envelope","red_envelope","red_envelope"]'),
  ('KH003', 'KH003_VOUCHER_4M_03', 'Voucher 4.000.000d', 4000000, 'Voucher mua hang tri gia 4.000.000d', '["star","star","star"]'),
  ('KH003', 'KH003_VOUCHER_3M_04', 'Voucher 3.000.000d', 3000000, 'Voucher mua hang tri gia 3.000.000d', '["star","star","star"]'),
  ('KH003', 'KH003_VOUCHER_2M_05', 'Voucher 2.000.000d', 2000000, 'Voucher mua hang tri gia 2.000.000d', '["bell","bell","bell"]')
on conflict (customer_id, code) do nothing;
