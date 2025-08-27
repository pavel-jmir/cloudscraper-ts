// tests/jest.d.ts - Custom typings for Jest tests

declare namespace jest {
  interface Matchers<R> {
    toBeValidCloudScraperResponse(): R;
    toBeInstanceOf(constructor: any): R;
    toBe(expected: any): R;
    toBeDefined(): R;
    toMatch(pattern: RegExp | string): R;
  }
  
  interface ExpectExtendMap {
    [name: string]: (received: any, ...args: any[]) => { pass: boolean; message(): string };
  }
  
  interface MockedFunction<T extends (...args: any[]) => any> {
    mockImplementation: (fn: (...args: any[]) => any) => MockedFunction<T>;
    mockResolvedValue: (value: any) => MockedFunction<T>;
    mockRejectedValue: (value: any) => MockedFunction<T>;
    mockResolvedValueOnce: (value: any) => MockedFunction<T>;
    mockRejectedValueOnce: (value: any) => MockedFunction<T>;
    mockReturnValue: (value: any) => MockedFunction<T>;
    mockReturnValueOnce: (value: any) => MockedFunction<T>;
    mock: {
      calls: any[][];
      instances: any[];
      contexts: any[];
      results: any[];
    };
  }
  
  type Mocked<T> = {
    [P in keyof T]: T[P] extends (...args: any[]) => any
      ? MockedFunction<T[P]>
      : T[P];
  };
  
  function fn<T extends (...args: any[]) => any>(
    implementation?: (...args: Parameters<T>) => ReturnType<T>
  ): MockedFunction<T>;
  
  function mock(path: string, options?: any): typeof jest;
  function resetAllMocks(): void;
  function clearAllMocks(): void;
  function restoreAllMocks(): void;
}

declare namespace jest {
  export const expect: {
    extend(matchers: ExpectExtendMap): void;
  };
}

declare function describe(name: string, fn: () => void): void;
declare function describe(name: string, fn: (done: jest.DoneCallback) => void): void;
declare function describe(name: string, timeout: number, fn: () => void): void;
declare function describe(name: string, timeout: number, fn: (done: jest.DoneCallback) => void): void;

declare function beforeEach(fn: () => void | Promise<void>): void;
declare function beforeEach(timeout: number, fn: () => void | Promise<void>): void;
declare function beforeEach(fn: (done: jest.DoneCallback) => void): void;
declare function beforeEach(timeout: number, fn: (done: jest.DoneCallback) => void): void;

declare function afterEach(fn: () => void | Promise<void>): void;
declare function afterEach(timeout: number, fn: () => void | Promise<void>): void;
declare function afterEach(fn: (done: jest.DoneCallback) => void): void;
declare function afterEach(timeout: number, fn: (done: jest.DoneCallback) => void): void;

declare function beforeAll(fn: () => void | Promise<void>): void;
declare function beforeAll(timeout: number, fn: () => void | Promise<void>): void;
declare function beforeAll(fn: (done: jest.DoneCallback) => void): void;
declare function beforeAll(timeout: number, fn: (done: jest.DoneCallback) => void): void;

declare function afterAll(fn: () => void | Promise<void>): void;
declare function afterAll(timeout: number, fn: () => void | Promise<void>): void;
declare function afterAll(fn: (done: jest.DoneCallback) => void): void;
declare function afterAll(timeout: number, fn: (done: jest.DoneCallback) => void): void;

declare function it(name: string, fn?: () => void | Promise<void>): void;
declare function it(name: string, timeout: number, fn?: () => void | Promise<void>): void;
declare function it(name: string, fn?: (done: jest.DoneCallback) => void): void;
declare function it(name: string, timeout: number, fn?: (done: jest.DoneCallback) => void): void;

declare function expect(actual: any): jest.Matchers<void> & jest.Matchers<Promise<void>>;
