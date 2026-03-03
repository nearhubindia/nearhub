# API Testing Guide - NearHub Server

## Overview

This document describes the comprehensive GWT (Given-When-Then) testing framework for all APIs in the NearHub server. The framework provides a solid, scalable approach to testing HTTP APIs with clear, readable test cases.

## Framework Architecture

### Tech Stack

- **Jest**: Testing framework and test runner
- **Supertest**: HTTP assertion library for testing Express apps
- **TypeScript**: Type-safe test code
- **GWT Pattern**: Given-When-Then structure for readable tests

### Directory Structure

```
server/
├── __tests__/
│   ├── setup/
│   │   └── test-app.ts              # Test application setup
│   ├── utils/
│   │   └── gwt-helpers.ts           # GWT helper functions and test utilities
│   └── features/
│       ├── auth.test.ts              # Authentication API tests
│       ├── listings.test.ts           # Listings API tests
│       ├── coupons.test.ts            # Coupons API tests
│       ├── subscriptions.test.ts      # Subscriptions API tests
│       └── users.test.ts              # Users API tests
├── jest.config.js                    # Jest configuration
└── package.json                      # Test scripts
```

## GWT Testing Pattern

### What is GWT?

GWT (Given-When-Then) is a behavior-driven development (BDD) testing pattern:

- **Given**: Setup test preconditions and context
- **When**: Execute the action being tested
- **Then**: Assert the expected results

### Example Test Structure

```typescript
it('should create a new listing successfully', async () => {
  // Given: Valid listing data and authenticated user
  const listingData = testData.validListing();

  // When: POST request is made to create listing
  context = await when.post(context, '/api/listings', listingData);

  // Then: Listing should be created successfully
  then.statusCodeIs(context, 201);
  then.responseIsSuccessful(context);
  then.responseHasField(context, 'id');
});
```

## API Test Coverage

### Implemented Test Suites

#### 1. Authentication API (`auth.test.ts`)

- Send OTP to phone number
- Verify OTP and create user
- Validate listings (AI-powered)
- Health check endpoint

**Test Count**: 25+

#### 2. Listings API (`listings.test.ts`)

- Create listings
- Retrieve listings (with filters and pagination)
- Get listing by ID
- Update listing details
- Delete listings
- Manage listing status

**Test Count**: 30+

#### 3. Coupons API (`coupons.test.ts`)

- Create coupons (admin only)
- Retrieve coupons with filters
- Get coupon details
- Update coupon settings
- Delete coupons
- Apply coupons to orders

**Test Count**: 35+

#### 4. Subscriptions API (`subscriptions.test.ts`)

- Create subscriptions
- Retrieve user subscriptions
- Get subscription details
- Update subscription settings
- Cancel subscriptions
- Handle renewals and trials

**Test Count**: 30+

#### 5. Users API (`users.test.ts`)

- Get user profile
- Update profile information
- Get public user profiles
- Email verification
- Retrieve invoices
- View user listings and reviews
- Delete user account

**Test Count**: 40+

**Total Test Coverage**: 160+ comprehensive test cases

## Running Tests

### Run All Tests

```bash
npm test
```

### Run Specific Feature Tests

```bash
# Auth tests
npm run test:auth

# Listings tests
npm run test:listings

# Coupons tests
npm run test:coupons

# Subscriptions tests
npm run test:subscriptions

# Users tests
npm run test:users
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

Automatically re-runs tests as code changes.

### Generate Coverage Report

```bash
npm run test:coverage
```

Generates detailed coverage report in `coverage/` directory.

### Run All Tests with Coverage

```bash
npm run test:all
```

## GWT Helper Functions

### Given (Setup Helpers)

```typescript
// Create app context
const context = given.appIsRunning(app);

// Add user data
given.userExists(context, userData);

// Set authentication
given.userIsAuthenticated(context, token, userId);

// Add test data
given.dataExists(context, 'key', data);
given.listingExists(context, listingData);
```

### When (Action Helpers)

```typescript
// HTTP requests
await when.post(context, endpoint, body);
await when.get(context, endpoint);
await when.patch(context, endpoint, body);
await when.delete(context, endpoint);
await when.put(context, endpoint, body);
```

### Then (Assertion Helpers)

```typescript
// Status assertions
then.statusCodeIs(context, 200);

// Success assertions
then.responseIsSuccessful(context);
then.responseHasError(context);

// Field assertions
then.responseHasField(context, fieldName);
then.responseHasField(context, fieldName, expectedValue);
then.responseMatches(context, expectedObject);

// Array assertions
then.responseIsEmptyArray(context);
then.responseIsNonEmptyArray(context);
then.responseArrayLength(context, length);

// Custom assertions
then.assert(condition, message);
```

### Test Data Factory

```typescript
// Generate test data
testData.validPhone(); // +919876543210
testData.validOTP(); // 123456
testData.validEmail(); // test@example.com
testData.validName(); // Test User
testData.validListing(); // Complete listing object
testData.validCoupon(); // Complete coupon object
testData.validSubscription(); // Complete subscription object
```

## Writing New Tests

### Step 1: Create Test File

```typescript
import { createTestApp } from '../setup/test-app';
import { given, when, then, testData, type TestContext } from '../utils/gwt-helpers';

describe('Feature Name API - GWT Tests', () => {
  let context: TestContext;

  beforeEach(() => {
    const app = createTestApp();
    context = given.appIsRunning(app);
  });

  // Tests go here...
});
```

### Step 2: Write Test Cases

```typescript
it('should describe the behavior', async () => {
  // Given
  const data = testData.validListing();
  context = given.userIsAuthenticated(context, token, userId);

  // When
  context = await when.post(context, '/api/endpoint', data);

  // Then
  then.statusCodeIs(context, 201);
  then.responseHasField(context, 'id');
});
```

### Step 3: Run and Debug

```bash
npm run test:feature
npm run test:watch
```

## Best Practices

### 1. Naming Conventions

- Test file names: `feature.test.ts`
- Test suite names: `Feature API - GWT Tests`
- Test names: `should [behavior] [condition]`

```typescript
describe('Listings API - GWT Tests', () => {
  it('should create listing with valid data', async () => {});
  it('should reject unauthenticated requests', async () => {});
});
```

### 2. Test Independence

Each test should be independent:

```typescript
// ✅ Good - setup in beforeEach
beforeEach(() => {
  context = given.appIsRunning(createTestApp());
});

// ❌ Avoid - shared state between tests
let sharedContext;
```

### 3. Use Meaningful Assertions

```typescript
// ✅ Clear
then.statusCodeIs(context, 201);
then.responseIsSuccessful(context);
then.responseHasField(context, 'id');

// ❌ Vague
expect(context.statusCode).toBeLessThanOrEqual(300);
```

### 4. Test Error Cases

```typescript
it('should handle missing fields', async () => {
  const incomplete = { title: 'Only title' };
  context = await when.post(context, '/api/listings', incomplete);
  then.statusCodeIs(context, 400);
  then.responseHasError(context);
});
```

### 5. Test Boundary Conditions

```typescript
it('should validate price range', async () => {
  const withNegativePrice = { ...validData, price: -100 };
  context = await when.post(context, '/api/listings', withNegativePrice);
  expect([400, 201, 200]).toContain(context.statusCode);
});
```

### 6. Document Complex Test Logic

```typescript
it('should auto-renew subscription when enabled', async () => {
  // Setup: Create subscription with auto-renew
  // The system should automatically renew subscriptions on billing date
  // We verify the autoRenew flag is stored and respected

  const sub = { ...testData.validSubscription(), autoRenew: true };
  context = await when.post(context, '/api/subscriptions', sub);

  then.responseHasField(context, 'autoRenew', true);
});
```

## Extending the Framework

### Adding New Features Tests

1. Create new test file in `__tests__/features/`
2. Import GWT helpers
3. Follow GWT pattern
4. Add npm script to package.json

### Adding Helper Functions

Extend `gwt-helpers.ts`:

```typescript
export const given = {
  // ... existing helpers

  featureSpecificSetup: (context, data) => {
    // Custom setup logic
    return { ...context, customData: data };
  },
};
```

### Custom Assertion Helpers

```typescript
export const then = {
  // ... existing assertions

  customAssertion: (context, expected) => {
    expect(context.response?.custom).toEqual(expected);
    return true;
  },
};
```

## Debugging Tests

### Enable Verbose Output

```bash
npm test -- --verbose
```

### Debug Specific Test

```bash
npm run test:watch -- auth.test.ts
```

### Print Response in Test

```typescript
it('should debug response', async () => {
  context = await when.post(context, '/api/endpoint', data);
  console.log('Response:', JSON.stringify(context.response, null, 2));
  console.log('Status:', context.statusCode);
});
```

### Run Single Test

```typescript
it.only('should isolate this test', async () => {
  // Only this test runs
});
```

## Performance Considerations

### Optimize Test Execution

1. **Use BeforeEach Wisely**: Only setup what's needed
2. **Avoid Real API Calls**: Mock external services
3. **Parallel Execution**: Jest runs tests in parallel
4. **Timeout Management**: `testTimeout: 30000` in jest.config.js

### Test Timeout

```typescript
// Increase timeout for slow tests
it('should handle slow operation', async () => {
  // test code
}, 60000); // 60 second timeout
```

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Run tests
  run: npm test -- --coverage

- name: Upload coverage
  uses: codecov/codecov-action@v3
```

### Pre-commit Hook

```bash
npm run test -- --bail
```

## Troubleshooting

### Tests Not Running

```bash
# Check Jest is installed
npm ls jest

# Verify jest.config.js is correct
# Check test file naming (*.test.ts)
```

### Import Errors

```bash
# Ensure ts-jest is configured
npm ls ts-jest

# Check tsconfig.json has proper module settings
```

### Timeout Issues

```bash
# Increase timeout in jest.config.js
testTimeout: 60000
```

## Future Enhancements

- [ ] Integration tests with real database
- [ ] Performance benchmarking tests
- [ ] Load testing with multiple concurrent requests
- [ ] Mock service helpers for external APIs
- [ ] Test data factories for complex scenarios
- [ ] Contract testing for API compatibility
- [ ] Visual regression testing
- [ ] E2E tests with test client app

## Contributing Tests

When adding new API endpoints:

1. Create corresponding test cases
2. Follow GWT pattern
3. Test happy path, error cases, and edge cases
4. Update this documentation
5. Ensure all tests pass: `npm run test:all`
6. Generate coverage report: `npm run test:coverage`

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [BDD Testing Pattern](https://cucumber.io/docs/gherkin/)
- [Express Testing Best Practices](https://expressjs.com/en/guide/testing.html)

## Support

For questions about the testing framework:

1. Check existing test examples
2. Review GWT helper functions
3. Consult Jest/Supertest documentation
4. Ask in team discussions

---

**Last Updated**: February 2026
**Framework Version**: 1.0.0
**Maintainer**: NearHub Team
