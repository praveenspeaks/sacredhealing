# How to Export Your Current Database (for developer only)

Run this command BEFORE creating the zip for the client.
Replace the DATABASE_URL with your actual connection string from .env

```bash
pg_dump \
  --data-only \
  --no-owner \
  --no-acl \
  --column-inserts \
  --disable-triggers \
  -t site_content \
  -t services \
  -t reviews \
  -t faqs \
  -t resources \
  -t slots \
  -t bookings \
  -t bulk_bookings \
  "postgresql://youruser:yourpass@yourhost/yourdb" \
  > data.sql
```

This creates data.sql — include it in the zip you send to the client.

The client runs this file in Neon SQL Editor to restore all data on their fresh database.
