# ZBS winner messages

The backend uses ZBS to send an approved Zalo message template when a participant wins. The API key is kept on the backend; neither web nor Mini App sends directly to ZBS.

Set these values in the Admin site's **System Settings** or in `backend/.env`:

```env
ZBS_API_KEY=your_zbs_api_key
ZBS_TEMPLATE_ID=approved_template_id
ZBS_API_BASE_URL=https://zbs.wifim.vn/api
```

Apply the Supabase migrations so a winning spin writes a `zbs` row to `public.deliveries` in the same transaction as its award. Then run the sender process:

```bash
cd backend
npm run worker:delivery
```

The API and worker read saved values from Supabase System Settings, with `backend/.env` as fallback. The worker reads phone and award details from Supabase and sends the template through ZBS. It retries transient failures up to the configured attempt limit. Check delivery and award status in the admin site; failed items can be resent there.

The approved template must include the fields expected by the sender:

```text
customer_name
voucher_name
voucher_code
voucher_value
expiry_date
campaign_name
start_date
end_date
applicable_products
discount_rate
```

If ZBS is not configured, the spin and award are still recorded. The participant sees that delivery is unavailable, and the backend does not expose the ZBS credentials.
