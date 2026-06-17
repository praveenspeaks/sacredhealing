// Set env vars here — jest.config.js is evaluated before any test module is loaded
if (process.env.DATABASE_TEST_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_TEST_URL;
}
process.env.ADMIN_PASSWORD    = 'test-admin-secret';
process.env.PORT              = '3099';
process.env.STRIPE_SECRET_KEY = '';

module.exports = {
  testEnvironment: 'node',
  testTimeout: 30000,
  forceExit: true,
  verbose: true,
};
