// Jest setup file for global test configuration

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  'postgresql://moltarena:dev_password_change_in_prod@localhost:5432/moltarena_test?connection_limit=20&pool_timeout=10&connect_timeout=5';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.BCRYPT_ROUNDS = '12'; // Use production value for testing

// Set test timeout
jest.setTimeout(10000); // 10 seconds default timeout

// Global test setup
beforeAll(async () => {
  // Any global setup can go here
});

// Global test teardown
afterAll(async () => {
  // Any global cleanup can go here
});
