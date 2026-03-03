# GWT Testing Quick Reference

## Quick Start

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run specific feature tests
npm run test:auth
npm run test:listings
npm run test:coupons
npm run test:subscriptions
npm run test:users

# Watch mode (auto-rerun on changes)
npm run test:watch

# Coverage report
npm run test:coverage
```

## Test Template

```typescript
import { createTestApp } from '../setup/test-app';
import { given, when, then, testData, type TestContext } from '../utils/gwt-helpers';

describe('Feature API - GWT Tests', () => {
  let context: TestContext;

  beforeEach(() => {
    const app = createTestApp();
    context = given.appIsRunning(app);
  });

  describe('POST /api/endpoint', () => {
    it('should do something when conditions are met', async () => {
      // Given: Setup preconditions
      const data = testData.validListing();
      context = given.userIsAuthenticated(context, 'token', 'user-id');

      // When: Execute action
      context = await when.post(context, '/api/endpoint', data);

      // Then: Assert results
      then.statusCodeIs(context, 201);
      then.responseIsSuccessful(context);
      then.responseHasField(context, 'id');
    });
  });
});
```

## Common Patterns

### Authentication Tests

```typescript
// Without auth
const unauthContext = given.appIsRunning(context.app);
const result = await when.post(unauthContext, '/api/endpoint', data);
expect([401, 403]).toContain(result.statusCode);

// With auth
context = given.userIsAuthenticated(context, token, userId);
context = await when.post(context, '/api/endpoint', data);
then.statusCodeIs(context, 201);
```

### CRUD Operations

```typescript
// Create
context = await when.post(context, '/api/items', item);
then.responseHasField(context, 'id');

// Read
context = await when.get(context, '/api/items/123');
then.statusCodeIs(context, 200);

// Update
context = await when.patch(context, '/api/items/123', updates);
then.responseHasField(context, 'id');

// Delete
context = await when.delete(context, '/api/items/123');
then.statusCodeIs(context, 204);
```

### Response Validation

```typescript
// Check status
then.statusCodeIs(context, 200);

// Check success flag
then.responseIsSuccessful(context);

// Check error
then.responseHasError(context, 'Expected error message');

// Check field exists
then.responseHasField(context, 'fieldName');

// Check field value
then.responseHasField(context, 'fieldName', expectedValue);

// Check array
then.responseIsNonEmptyArray(context);
then.responseArrayLength(context, 5);

// Check object matches
then.responseMatches(context, {
  id: 'expected-id',
  status: 'active',
});
```

### Test Data

```typescript
testData.validPhone(); // '+919876543210'
testData.validOTP(); // '123456'
testData.validEmail(); // 'test{timestamp}@example.com'
testData.validName(); // 'Test User {timestamp}'
testData.validListing(); // Complete listing object
testData.validCoupon(); // Complete coupon object
testData.validSubscription(); // Complete subscription object
```

## GWT Helper Reference

### Given (Setup)

| Helper                                              | Purpose                      |
| --------------------------------------------------- | ---------------------------- |
| `given.appIsRunning(app)`                           | Create test context with app |
| `given.userIsAuthenticated(context, token, userId)` | Add auth to context          |
| `given.userExists(context, userData)`               | Add user data to context     |
| `given.listingExists(context, listing)`             | Add listing to context       |
| `given.dataExists(context, key, data)`              | Add custom data to context   |

### When (Actions)

| Helper                                | Purpose             |
| ------------------------------------- | ------------------- |
| `when.post(context, endpoint, body)`  | Make POST request   |
| `when.get(context, endpoint)`         | Make GET request    |
| `when.patch(context, endpoint, body)` | Make PATCH request  |
| `when.delete(context, endpoint)`      | Make DELETE request |
| `when.put(context, endpoint, body)`   | Make PUT request    |

### Then (Assertions)

| Helper                                         | Purpose                       |
| ---------------------------------------------- | ----------------------------- |
| `then.statusCodeIs(context, code)`             | Check HTTP status code        |
| `then.responseIsSuccessful(context)`           | Check success flag true       |
| `then.responseHasError(context)`               | Check error exists            |
| `then.responseHasField(context, field)`        | Check field exists            |
| `then.responseHasField(context, field, value)` | Check field value             |
| `then.responseMatches(context, obj)`           | Check response matches object |
| `then.responseIsEmptyArray(context)`           | Check empty array             |
| `then.responseIsNonEmptyArray(context)`        | Check non-empty array         |
| `then.responseArrayLength(context, len)`       | Check array length            |
| `then.errorIsThrown(context)`                  | Check error thrown            |
| `then.assert(condition, msg)`                  | Custom assertion              |

## Common Test Scenarios

### Test Happy Path (Success Case)

```typescript
it('should create listing successfully', async () => {
  const listingData = testData.validListing();
  context = await when.post(context, '/api/listings', listingData);

  then.statusCodeIs(context, 201);
  then.responseIsSuccessful(context);
  then.responseHasField(context, 'id');
  expect(context.response?.title).toBe(listingData.title);
});
```

### Test Error Case (Validation Failure)

```typescript
it('should reject invalid listing', async () => {
  const invalidData = { title: 'Missing category' };
  context = await when.post(context, '/api/listings', invalidData);

  then.statusCodeIs(context, 400);
  then.responseHasError(context, 'category is required');
});
```

### Test Authentication (Access Control)

```typescript
it('should require authentication', async () => {
  const unauthContext = given.appIsRunning(context.app);
  const result = await when.post(unauthContext, '/api/listings', data);

  expect([401, 403]).toContain(result.statusCode);
});
```

### Test Authorization (Permission Check)

```typescript
it('should prevent user from updating others listing', async () => {
  const otherUserContext = given.userIsAuthenticated(context, 'other-token', 'other-user-id');

  const result = await when.patch(otherUserContext, '/api/listings/other-users-listing', {
    title: 'Hacked!',
  });

  then.statusCodeIs(result, 403);
});
```

### Test Filtering and Search

```typescript
it('should filter listings by category', async () => {
  context = await when.get(context, '/api/listings?category=Electronics');

  then.statusCodeIs(context, 200);
  then.responseIsNonEmptyArray(context);

  const listings = context.response;
  listings.forEach((item: any) => {
    expect(item.category).toBe('Electronics');
  });
});
```

### Test Pagination

```typescript
it('should support pagination', async () => {
  context = await when.get(context, '/api/listings?page=1&limit=10');

  then.statusCodeIs(context, 200);
  then.responseArrayLength(context, 10);
});
```

## Running Tests by Pattern

```bash
# Run all tests
npm test

# Run tests matching pattern
npm test -- auth

# Run single test file
npm test -- auth.test.ts

# Run tests with coverage
npm run test:coverage

# Run in watch mode (rerun on change)
npm run test:watch

# Run with verbose output
npm test -- --verbose

# Run only failing tests
npm test -- --onlyChanged

# Run and update snapshots
npm test -- -u
```

## Debugging

```typescript
// Print context to console
console.log('Context:', context);

// Print response
console.log('Response:', JSON.stringify(context.response, null, 2));

// Print status code
console.log('Status:', context.statusCode);

// Debug single test - add .only
it.only('should debug this', async () => {
  // Only this test runs
});

// Skip test - add .skip
it.skip('should skip this', async () => {
  // This test is skipped
});
```

## File Locations

| File                                       | Purpose                    |
| ------------------------------------------ | -------------------------- |
| `jest.config.js`                           | Jest configuration         |
| `__tests__/setup/test-app.ts`              | Test app setup             |
| `__tests__/utils/gwt-helpers.ts`           | GWT helpers                |
| `__tests__/features/auth.test.ts`          | Auth tests                 |
| `__tests__/features/listings.test.ts`      | Listings tests             |
| `__tests__/features/coupons.test.ts`       | Coupons tests              |
| `__tests__/features/subscriptions.test.ts` | Subscriptions tests        |
| `__tests__/features/users.test.ts`         | Users tests                |
| `TESTING_GUIDE.md`                         | Full testing documentation |

## Best Practices

✅ **DO:**

- Use GWT pattern for clarity
- Test happy path AND error cases
- Keep tests independent (no shared state)
- Use meaningful names
- Test authentication/authorization
- Test edge cases and boundaries
- Document complex logic

❌ **DON'T:**

- Share state between tests
- Test implementation details
- Ignore error cases
- Use vague assertions
- Make external API calls
- Test multiple concerns in one test
- Skip authentication tests

## Example Test Suite Structure

```typescript
describe('Feature API - GWT Tests', () => {
  let context: TestContext;

  beforeEach(() => {
    const app = createTestApp();
    context = given.appIsRunning(app);
  });

  // Group related tests
  describe('POST /api/endpoint', () => {
    it('should handle success case', async () => {
      /* ... */
    });
    it('should handle error case', async () => {
      /* ... */
    });
    it('should require authentication', async () => {
      /* ... */
    });
  });

  describe('GET /api/endpoint', () => {
    it('should fetch data', async () => {
      /* ... */
    });
    it('should support filtering', async () => {
      /* ... */
    });
    it('should support pagination', async () => {
      /* ... */
    });
  });

  describe('PATCH /api/endpoint/:id', () => {
    it('should update resource', async () => {
      /* ... */
    });
    it('should validate input', async () => {
      /* ... */
    });
  });

  describe('DELETE /api/endpoint/:id', () => {
    it('should delete resource', async () => {
      /* ... */
    });
    it('should check ownership', async () => {
      /* ... */
    });
  });
});
```

---

**Quick Tip**: Start with existing tests as templates, follow the GWT pattern, and use the helper functions. Your tests will be clear, maintainable, and comprehensive!
