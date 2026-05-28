// Runs before any test module is loaded — safe to set env vars here
if (process.env.DATABASE_TEST_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_TEST_URL;
}
process.env.ADMIN_PASSWORD  = 'test-admin-secret';
process.env.PORT             = '3099';
process.env.STRIPE_SECRET_KEY = ''; // Disable Stripe in tests
