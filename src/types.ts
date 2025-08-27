import { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { CookieJar } from 'tough-cookie';

/**
 * Browser selection options
 */
export interface BrowserOptions {
  browser?: 'chrome' | 'firefox';
  mobile?: boolean;
  desktop?: boolean;
  platform?: 'windows' | 'linux' | 'darwin' | 'android' | 'ios';
  custom?: string;
}

/**
 * CloudScraper interface
 */
export interface ICloudScraper {
  get(url: string, config?: CloudScraperRequestConfig): Promise<AxiosResponse>;
  post(url: string, data?: any, config?: CloudScraperRequestConfig): Promise<AxiosResponse>;
  put(url: string, data?: any, config?: CloudScraperRequestConfig): Promise<AxiosResponse>;
  patch(url: string, data?: any, config?: CloudScraperRequestConfig): Promise<AxiosResponse>;
  delete(url: string, config?: CloudScraperRequestConfig): Promise<AxiosResponse>;
  head(url: string, config?: CloudScraperRequestConfig): Promise<AxiosResponse>;
  options(url: string, config?: CloudScraperRequestConfig): Promise<AxiosResponse>;
  request(method: string, url: string, config?: CloudScraperRequestConfig): Promise<AxiosResponse>;
  
  // Additional methods for test compatibility
  solveChallenge(response: AxiosResponse): Promise<AxiosResponse>;
  getCookies(): Record<string, string>;
}

/**
 * Proxy rotation options
 */
export interface ProxyOptions {
  rotationStrategy?: 'sequential' | 'random' | 'smart';
  banTime?: number;
}

/**
 * Stealth mode options
 */
export interface StealthOptions {
  minDelay?: number;
  maxDelay?: number;
  humanLikeDelays?: boolean;
  randomizeHeaders?: boolean;
  browserQuirks?: boolean;
}

/**
 * Captcha provider options
 */
export interface CaptchaOptions {
  provider: string;
  apiKey?: string;
  clientKey?: string;
  username?: string;
  password?: string;
  noProxy?: boolean;
  maxtimeout?: number;
  proxy?: string;
  [key: string]: any;
}

/**
 * CloudScraper constructor options
 */
export interface CloudScraperOptions {
  // Challenge handling options
  disableCloudflareV1?: boolean;
  disableCloudflareV2?: boolean;
  disableCloudflareV3?: boolean;
  disableTurnstile?: boolean;
  delay?: number;
  captcha?: CaptchaOptions;
  doubleDown?: boolean;
  interpreter?: string;
  
  // Added for compatibility with tests
  challengesToSolve?: number;
  userAgent?: string;
  cookies?: Record<string, string>;
  
  // Proxy options expanded for tests
  proxy?: {
    host: string;
    port: number;
    auth?: {
      username: string;
      password: string;
    };
  };
  proxies?: Array<{
    host: string;
    port: number;
    auth?: {
      username: string;
      password: string;
    };
  }>;
  proxyRotation?: 'round-robin' | 'random' | 'sticky-session';
  
  // Stealth-related options for tests
  stealth?: boolean;

  // Request hooks
  requestPreHook?: (scraper: any, method: string, url: string, config: AxiosRequestConfig) => [string, string, AxiosRequestConfig];
  requestPostHook?: (scraper: any, response: AxiosResponse) => AxiosResponse;

  // TLS/SSL options
  cipherSuite?: string | string[];
  ecdhCurve?: string;
  
  // Compression options
  allowBrotli?: boolean;

  // User agent handling
  browser?: BrowserOptions | string;

  // Challenge solving depth
  solveDepth?: number;

  // Session health monitoring
  sessionRefreshInterval?: number;
  autoRefreshOn403?: boolean;
  max403Retries?: number;

  // Request throttling
  minRequestInterval?: number;
  maxConcurrentRequests?: number;
  rotateTlsCiphers?: boolean;

  // Proxy management
  rotatingProxies?: string[] | Record<string, string>;
  proxyOptions?: ProxyOptions;

  // Stealth mode
  enableStealth?: boolean;
  stealthOptions?: StealthOptions;

  // Request options
  timeout?: number;

  // Debug mode
  debug?: boolean;
}

/**
 * JavaScript Interpreter interface
 */
export interface JavaScriptInterpreter {
  solveChallenge(body: string, domain: string): Promise<string>;
}

/**
 * Captcha Solver interface
 */
export interface CaptchaSolver {
  solveCaptcha(
    captchaType: string,
    url: string,
    siteKey: string,
    options: CaptchaOptions
  ): Promise<string>;
}

/**
 * Challenge response data
 */
export interface ChallengeResponse {
  url: string;
  data: Record<string, string>;
}

// ICloudScraper is already defined above

/**
 * Extended AxiosRequestConfig with CloudScraper specific options
 */
export interface CloudScraperRequestConfig extends Omit<AxiosRequestConfig, 'proxy'> {
  jar?: CookieJar;
  captcha?: CaptchaOptions;
  browser?: BrowserOptions;
  proxy?: Record<string, string> | AxiosRequestConfig['proxy'];
  data?: any;
  method?: string;
  headers?: Record<string, string>;
}

/**
 * Function to create a CloudScraper instance
 */
export type CreateScraper = (options?: CloudScraperOptions) => ICloudScraper;

/**
 * Function to get tokens from a URL
 */
export type GetTokens = (
  url: string,
  options?: CloudScraperOptions
) => Promise<[Record<string, string>, string]>;

/**
 * Function to get a cookie string from a URL
 */
export type GetCookieString = (
  url: string,
  options?: CloudScraperOptions
) => Promise<[string, string]>;
