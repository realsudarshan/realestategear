# MLS Service Test Suite

Comprehensive test suite for the MLS Connector Framework covering all business logic, integrations, and edge cases.

## 📁 Test Structure

```
tests/
├── unit/                           # Unit tests for individual components
│   ├── connectors/
│   │   ├── base/                  # Base connector tests
│   │   │   └── MLSConnector.test.js
│   │   ├── auth/                  # Authentication tests
│   │   │   └── AuthenticationManager.test.js
│   │   ├── utils/                 # Utility component tests
│   │   │   ├── RateLimiter.test.js
│   │   │   └── ConnectionPool.test.js
│   │   └── MLSConnectorFactory.test.js
├── integration/                    # Integration tests
│   └── connectors/
│       └── ConnectorManager.integration.test.js
├── utils/                         # Test utilities (fixtures, helpers)
└── test-runner.js                 # Custom test runner with reporting
```

## 🧪 Test Coverage

### Unit Tests (172 tests)
- **MLSConnector Base Class**: 22 tests covering abstract interface, health monitoring, statistics
- **AuthenticationManager**: 24 tests covering OAuth, Basic Auth, API keys, token refresh
- **RateLimiter**: 31 tests covering token bucket, sliding window, rate limiting algorithms
- **ConnectionPool**: 35 tests covering connection management, load balancing, health checks
- **MLSConnectorFactory**: 60 tests covering provider registration, connector creation, integration

### Integration Tests (49 tests)
- **ConnectorManager**: 49 tests covering end-to-end sync operations, error handling, monitoring

## 🚀 Running Tests

### Quick Commands
```bash
# Run all tests
npm test

# Run specific test categories
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only
npm run test:coverage       # With coverage report

# Run custom test runner
npm run test:runner         # Interactive test runner
npm run test:all           # Comprehensive test suite
```

### Custom Test Runner
```bash
# Run all tests with detailed reporting
node tests/test-runner.js all

# Run specific test types
node tests/test-runner.js unit
node tests/test-runner.js integration
node tests/test-runner.js coverage

# Quick test run (no coverage)
node tests/test-runner.js quick
```

## 📊 Test Categories

### 🏗️ Core Framework Tests
- **Abstract Base Class**: Interface compliance, event emission, error handling
- **Connector Implementations**: RETS, REST, Feed connector logic (mocked external dependencies)
- **Factory Pattern**: Provider registration, connector creation, validation

### 🔐 Authentication & Security Tests
- **Multi-method Authentication**: OAuth 2.0, Basic Auth, API Keys, Session-based
- **Token Management**: Automatic refresh, expiration handling, credential storage
- **Error Scenarios**: Invalid credentials, network failures, token revocation

### ⚡ Performance & Reliability Tests
- **Rate Limiting**: Token bucket, sliding window, exponential backoff algorithms
- **Connection Pooling**: Load balancing strategies, circuit breaker patterns, health monitoring
- **Retry Logic**: Exponential backoff, failure handling, circuit breaker integration

### 🔄 Integration & Orchestration Tests
- **End-to-end Sync Operations**: Incremental sync, full sync, error aggregation
- **Provider Management**: Registration, health monitoring, failover scenarios
- **Data Processing**: Listing transformation, error handling, statistics tracking

## 🎯 Test Philosophy

### Mocking Strategy
- **External Dependencies**: All external services (MLS APIs, databases, Redis) are mocked
- **Network Calls**: HTTP requests mocked using Jest mocks and axios mocking
- **Timing Operations**: Selective use of fake timers for timing-sensitive tests
- **Database Operations**: Mocked to focus on business logic rather than data persistence

### Coverage Goals
- **Business Logic**: 100% coverage of core business logic and error paths
- **Integration Points**: Comprehensive testing of component interactions
- **Edge Cases**: Timeout scenarios, connection failures, malformed responses
- **Performance**: Load testing through connection pool stress tests

### Test Data
- **Realistic Scenarios**: Tests use realistic MLS provider configurations and data
- **Error Conditions**: Comprehensive error scenario testing
- **Boundary Conditions**: Rate limits, connection limits, timeout boundaries

## 🛡️ Quality Assurance

### Test Reliability
- **Deterministic**: Tests avoid random data and timing dependencies
- **Isolated**: Each test runs independently with proper setup/teardown
- **Fast**: Unit tests complete in <1s, integration tests in <10s
- **Stable**: No flaky tests due to timing or external dependencies

### Continuous Integration
- **Pre-commit Hooks**: Run unit tests before commits
- **CI Pipeline**: Full test suite runs on all pull requests
- **Coverage Reports**: Automated coverage reporting and enforcement
- **Performance Benchmarks**: Performance regression detection

## 📋 Test Scenarios Covered

### Authentication Flow Tests
- ✅ OAuth 2.0 Client Credentials flow
- ✅ OAuth token refresh and expiration handling
- ✅ Basic Authentication encoding
- ✅ API Key header management
- ✅ Session-based authentication with cookies
- ✅ Multi-provider credential management

### Rate Limiting Tests
- ✅ Token bucket algorithm with burst allowance
- ✅ Fixed window rate limiting
- ✅ Sliding window rate limiting
- ✅ Exponential backoff on rate limit violations
- ✅ Per-provider rate limit configuration
- ✅ Request queuing and priority handling

### Connection Management Tests
- ✅ Connection pool initialization and scaling
- ✅ Load balancing (round-robin, least-connections, health-based)
- ✅ Circuit breaker pattern implementation
- ✅ Connection health monitoring and recovery
- ✅ Graceful connection lifecycle management
- ✅ Pool maintenance and cleanup operations

### Sync Operation Tests
- ✅ Incremental sync with timestamp-based filtering
- ✅ Full sync with data consistency checks
- ✅ Multi-provider parallel processing
- ✅ Error aggregation and retry logic
- ✅ Data transformation and validation
- ✅ Performance monitoring and statistics

### Error Handling Tests
- ✅ Network connectivity failures
- ✅ Authentication timeout and retry
- ✅ Rate limit violation responses
- ✅ Malformed API responses
- ✅ Database connection errors
- ✅ Partial failure scenarios

## 🚀 Next Steps

### Planned Enhancements
- **E2E Tests**: End-to-end tests with real MLS provider sandboxes
- **Load Tests**: Performance testing under high concurrency
- **Chaos Engineering**: Fault injection and resilience testing
- **Visual Testing**: UI component testing for admin interfaces

### Coverage Improvements
- **Specific Connector Tests**: Dedicated tests for RETS, REST, and Feed connectors
- **Field Mapping Tests**: Data transformation and validation testing
- **Media Processing Tests**: Image and document handling testing

## 💡 Testing Tips

### Running Specific Tests
```bash
# Test a specific file
npm test -- tests/unit/connectors/base/MLSConnector.test.js

# Test with pattern matching
npm test -- --testNamePattern="should authenticate"

# Test with increased timeout
npm test -- --testTimeout=30000

# Test with coverage
npm test -- --coverage tests/unit/connectors/auth/
```

### Debugging Tests
```bash
# Run tests in watch mode
npm run test:watch

# Debug specific test
node --inspect-brk node_modules/.bin/jest tests/unit/specific.test.js

# Verbose output
npm test -- --verbose
```

### Writing New Tests
1. **Follow Naming Convention**: `ComponentName.test.js` for unit, `Feature.integration.test.js` for integration
2. **Use Descriptive Names**: Test names should clearly describe the scenario being tested
3. **Mock External Dependencies**: Always mock external services and databases
4. **Test Error Paths**: Include tests for failure scenarios and edge cases
5. **Update Test Runner**: Add new test files to the custom test runner if needed

---

🎯 **Goal**: Maintain >95% test coverage while ensuring production-ready reliability for the MLS Connector Framework.