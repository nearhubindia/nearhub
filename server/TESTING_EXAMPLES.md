# Testing Framework Examples & Usage

## Quick Start Examples

### 1. Run All Tests

```bash
$ npm test

> nearhub-server@1.0.0 test
> jest --detectOpenHandles

 PASS  __tests__/features/auth.test.ts (3.5s)
  Authentication API - GWT Tests
    GET /api/health
      ✓ should return health status (15ms)
      ✓ should include timestamp in response (8ms)
    POST /api/auth/send-otp
      ✓ should send OTP successfully with valid phone number (12ms)
      ✓ should return OTP in development environment (10ms)
      ✓ should fail with missing phone number (8ms)
      ...more tests...

 PASS  __tests__/features/listings.test.ts (4.2s)
  Listings API - GWT Tests
    POST /api/listings
      ✓ should create a new listing successfully (18ms)
      ✓ should include listing ID in response (12ms)
      ...more tests...

 PASS  __tests__/features/coupons.test.ts (3.8s)
  Coupons API - GWT Tests
    POST /api/admin/coupons
      ✓ should create coupon with valid data (16ms)
      ...more tests...

 PASS  __tests__/features/subscriptions.test.ts (3.6s)
  Subscriptions API - GWT Tests
    POST /api/subscriptions
      ✓ should create subscription successfully (14ms)
      ...more tests...

 PASS  __tests__/features/users.test.ts (4.1s)
  Users API - GWT Tests
    GET /api/users/profile
      ✓ should retrieve authenticated user profile (12ms)
      ...more tests...

Test Suites: 5 passed, 5 total
Tests:       165 passed, 165 total
Snapshots:   0 total
Time:        19.2s
Ran all test suites.
```

### 2. Run Specific Feature Tests

```bash
$ npm run test:auth

> nearhub-server@1.0.0 test:auth
> jest __tests__/features/auth.test.ts

 PASS  __tests__/features/auth.test.ts

  Authentication API - GWT Tests
    Health Check Tests
      GET /api/health
        ✓ should return health status (12ms)
        ✓ should include timestamp in response (8ms)

    Send OTP Tests
      POST /api/auth/send-otp
        ✓ should send OTP successfully with valid phone number (15ms)
        ✓ should return OTP in development environment (10ms)
        ✓ should fail with missing phone number (9ms)
        ✓ should handle invalid phone format gracefully (11ms)
        ✓ should include sentVia in response (8ms)

    Verify OTP Tests
      POST /api/auth/verify-otp
        ✓ should verify valid OTP and create user (18ms)
        ✓ should handle invalid OTP (12ms)
        ✓ should create user with optional email and gender (14ms)
        ✓ should generate unique user ID (16ms)
        ✓ should set user creation timestamp (10ms)
        ✓ should use default values for optional fields (12ms)

    Validate Listing Tests
      POST /api/validate-listing
        ✓ should validate image listing with all fields (20ms)
        ✓ should validate video listing with duration (22ms)
        ✓ should reject listing without title (8ms)
        ✓ should reject listing without category (8ms)
        ✓ should handle missing description gracefully (11ms)
        ✓ should return detected items in response (19ms)
        ✓ should handle AI service unavailability gracefully (15ms)
        ✓ should validate multiple categories (18ms)
        ✓ should return suggestion when validation fails (16ms)

Test Suites: 1 passed, 1 total
Tests:       25 passed, 25 total
Time:        5.2s
Ran all test suite.
```

### 3. Run Tests in Watch Mode

```bash
$ npm run test:watch

 PASS  __tests__/features/auth.test.ts

Tests:       25 passed, 25 total
Time:        3.2s

Watch Usage
› Press a to run all tests.
› Press f to run only failed tests.
› Press g to run a test suite.
› Press O to open the last test in an editor.
› Press q to quit watch mode.
› Press w to show more watch mode options.

# Watch will auto-rerun tests when files change
```

### 4. Run Tests with Coverage

```bash
$ npm run test:coverage

> nearhub-server@1.0.0 test:coverage
> jest --coverage

 PASS  __tests__/features/auth.test.ts
 PASS  __tests__/features/listings.test.ts
 PASS  __tests__/features/coupons.test.ts
 PASS  __tests__/features/subscriptions.test.ts
 PASS  __tests__/features/users.test.ts

----------|---------|----------|---------|---------|-------------------
File      | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
----------|---------|----------|---------|---------|-------------------
All files |   65.2  |   58.4   |   72.1  |   64.8  |
 features |   65.8  |   59.1   |   73.2  |   65.5  |
  auth    |   68.3  |   61.2   |   75.0  |   67.9  |
  coupons |   63.5  |   57.8   |   71.2  |   63.1  |
  listings|   66.1  |   59.5   |   72.8  |   65.6  |
  users   |   67.2  |   60.3   |   74.1  |   66.8  |
  subs    |   62.9  |   58.1  |   70.5  |   62.5  |
----------|---------|----------|---------|---------|-------------------

Test Suites: 5 passed, 5 total
Tests:       165 passed, 165 total
Coverage:    Generated in coverage/lcov-report/index.html
```

## Example Test Scenarios

### Example 1: Testing Success Case

```typescript
// Test: Create listing successfully
it('should create listing successfully', async () => {
  // Given: Valid listing data and authenticated user
  const listingData = {
    title: 'iPhone 15 Pro',
    description: 'Used iPhone in good condition',
    category: 'Electronics',
    price: 50000,
    location: { latitude: 28.6139, longitude: 77.209 },
    images: ['https://example.com/image.jpg'],
  };

  context = given.userIsAuthenticated(context, authToken, userId);

  // When: POST request to create listing
  context = await when.post(context, '/api/listings', listingData);

  // Then: Listing should be created successfully
  then.statusCodeIs(context, 201);
  then.responseIsSuccessful(context);
  then.responseHasField(context, 'id');
  expect(context.response?.title).toBe('iPhone 15 Pro');
  expect(context.response?.category).toBe('Electronics');
});

// ✓ should create listing successfully (18ms)
```

### Example 2: Testing Error Case

```typescript
// Test: Handle missing required fields
it('should reject listing without category', async () => {
  // Given: Incomplete listing data
  const incompleteData = {
    title: 'Product Name',
    // Missing: category, price, etc.
  };

  // When: Invalid listing is submitted
  context = await when.post(context, '/api/listings', incompleteData);

  // Then: Should return validation error
  then.statusCodeIs(context, 400);
  then.responseHasError(context, 'category is required');
});

// ✓ should reject listing without category (8ms)
```

### Example 3: Testing Authentication

```typescript
// Test: Require authentication
it('should require authentication', async () => {
  // Given: NO authentication token
  const unauthContext = given.appIsRunning(context.app);

  // When: Unauthenticated request is made
  const result = await when.post(unauthContext, '/api/listings', listingData);

  // Then: Should return 401 Unauthorized
  expect([401, 403]).toContain(result.statusCode);
});

// ✓ should require authentication (10ms)
```

### Example 4: Testing Authorization

```typescript
// Test: Prevent user from modifying others' resources
it('should prevent user from updating others listing', async () => {
  // Given: Other user's listing and different auth token
  const otherUserContext = given.userIsAuthenticated(context, 'other-user-token', 'other-user-id');

  // When: Try to update another user's listing
  const result = await when.patch(otherUserContext, '/api/listings/other-users-listing-id', {
    title: 'Hacked!',
  });

  // Then: Should return 403 Forbidden
  then.statusCodeIs(result, 403);
});

// ✓ should prevent user from updating others listing (14ms)
```

### Example 5: Testing Data Filtering

```typescript
// Test: Filter listings by category
it('should filter by category', async () => {
  // Given: Multiple listings in database with different categories

  // When: GET request with category filter
  context = await when.get(context, '/api/listings?category=Electronics');

  // Then: Should return only electronics
  then.statusCodeIs(context, 200);
  then.responseIsNonEmptyArray(context);

  context.response.forEach((listing: any) => {
    expect(listing.category).toBe('Electronics');
  });
});

// ✓ should filter by category (24ms)
```

### Example 6: Testing Pagination

```typescript
// Test: Support pagination
it('should support pagination', async () => {
  // Given: Many listings in database

  // When: GET request with pagination params
  context = await when.get(context, '/api/listings?page=1&limit=10');

  // Then: Should return paginated results
  then.statusCodeIs(context, 200);
  then.responseIsNonEmptyArray(context);
  then.responseArrayLength(context, 10);
});

// ✓ should support pagination (18ms)
```

## Test Data Examples

### Listing Test Data

```typescript
const listing = testData.validListing();
// Returns:
{
  title: "Test Listing {timestamp}",
  description: "A test listing for testing purposes",
  category: "Electronics",
  price: 999,
  location: {
    latitude: 28.6139,
    longitude: 77.209
  },
  images: ["https://example.com/image1.jpg"]
}
```

### Coupon Test Data

```typescript
const coupon = testData.validCoupon();
// Returns:
{
  code: "TEST{timestamp}",
  discountPercentage: 10,
  maxUsageCount: 100,
  expiresAt: "2026-03-23T12:00:00.000Z" // 30 days from now
}
```

### Subscription Test Data

```typescript
const subscription = testData.validSubscription();
// Returns:
{
  userId: "user_1708524085",
  tierId: "tier_1",
  startDate: "2026-02-21T12:00:00.000Z",
  autoRenew: true
}
```

## Running Specific Tests

### Run Single Test File

```bash
$ npm test -- auth.test.ts
```

### Run Tests Matching Pattern

```bash
$ npm test -- --testNamePattern="should create"
```

### Run Failed Tests Only

```bash
$ npm test -- --onlyChanged
```

### Run with Specific Timeout

```bash
$ npm test -- --testTimeout=60000
```

### Debug Single Test

```typescript
// Add .only to run only this test
it.only('should debug this specific test', async () => {
  // Test code here
});
```

## Output Examples

### Successful Test Run

```
 PASS  __tests__/features/listings.test.ts

  Listings API - GWT Tests
    POST /api/listings
      ✓ should create a new listing successfully (18ms)
      ✓ should include listing ID in response (12ms)
    GET /api/listings
      ✓ should retrieve all listings (24ms)
      ✓ should support pagination (20ms)

Tests:  4 passed, 4 total
```

### Failed Test Run

```
 FAIL  __tests__/features/listings.test.ts

  Listings API - GWT Tests
    POST /api/listings
      ✕ should create a new listing successfully (18ms)

Expected: 201
Received: 500

at then.statusCodeIs (utils/gwt-helpers.ts:95)
at listings.test.ts:45
```

## Common Commands Cheatsheet

```bash
# Run all tests
npm test

# Run specific feature
npm run test:auth
npm run test:listings
npm run test:coupons
npm run test:subscriptions
npm run test:users

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run all with verbose output
npm run test:all

# Run tests matching pattern
npm test -- --testNamePattern="create"

# Run with specific timeout
npm test -- --testTimeout=60000

# Debug mode
node --inspect-brk node_modules/.bin/jest --runInBand

# Update snapshots
npm test -- -u

# Show test file list
npm test -- --listTests
```

## Debugging Tips

### Print Response in Test

```typescript
it('should debug response', async () => {
  context = await when.post(context, '/api/endpoint', data);
  console.log('Status:', context.statusCode);
  console.log('Response:', JSON.stringify(context.response, null, 2));
  console.log('Error:', context.error);
});
```

### Use console.log to Trace Execution

```typescript
it('should trace execution', async () => {
  console.log('Starting test...');
  context = await when.post(context, '/api/endpoint', data);
  console.log('Request completed, status:', context.statusCode);
  then.statusCodeIs(context, 201);
  console.log('Assertion passed!');
});
```

### Run Single Test

```bash
$ npm test -- --testNamePattern="should create listing"
```

## Performance Tips

1. **Close open handles**: `npm test -- --forceExit`
2. **No watch mode in CI**: `npm run test:all`
3. **Parallel execution**: Jest runs by default with `maxWorkers`
4. **Cache tests**: `npm test -- --cache`

## Integration Examples

### GitHub Actions

```yaml
- name: Run tests
  run: npm test -- --coverage --verbose
```

### Pre-commit Hook

```bash
#!/bin/sh
npm test -- --bail
```

### Pre-push Hook

```bash
#!/bin/sh
npm run test:all
```

---

For more information, see:

- **TESTING_GUIDE.md** - Comprehensive guide
- **TESTING_QUICK_REFERENCE.md** - Quick reference
- **TESTING_FRAMEWORK_SETUP.md** - Framework overview
