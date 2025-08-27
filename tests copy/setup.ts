// tests/setup.ts
import { CloudScraper } from '../src/main';

// Mock axios for testing
jest.mock('axios', () => {
  return {
    __esModule: true,
    default: {
      create: jest.fn(() => ({
        request: jest.fn(),
        defaults: {
          headers: {
            common: {}
          }
        }
      }))
    }
  };
});

// Disable console.log during tests unless DEBUG is enabled
// Use typeof check to avoid TypeScript errors
if (typeof process !== 'undefined' && !process.env.DEBUG) {
  // @ts-ignore - Allow global console override
  global.console.log = jest.fn();
}

// Add global test helpers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidCloudScraperResponse(): R;
    }
  }
}

// Make sure Jest is defined
if (typeof expect === 'undefined') {
  console.warn('Jest globals not available, skipping custom matcher setup');
} else {
  // Custom matcher for CloudScraper responses
  (expect as any).extend({
  toBeValidCloudScraperResponse(received) {
    const pass = 
      received && 
      typeof received === 'object' &&
      'status' in received &&
      'statusText' in received &&
      'headers' in received &&
      'data' in received;
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid CloudScraper response`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid CloudScraper response`,
        pass: false
      };
    }
  }
  });
}
