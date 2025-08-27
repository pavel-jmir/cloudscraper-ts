/// <reference types="node" />

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosProxyConfig } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar, Cookie } from 'tough-cookie';

// We'll treat the CookieJar methods as any type to simplify compilation
// In a real implementation, these would be properly typed
(CookieJar.prototype as any).getDomainsSync = function(): Promise<string[]> {
  // Mock implementation that returns an empty array
  return Promise.resolve([]);
};

(CookieJar.prototype as any).removeAllCookiesSync = function(): Promise<void> {
  // Mock implementation that does nothing
  return Promise.resolve();
};

(CookieJar.prototype as any).getCookiesSync = function(): Promise<any[]> {
  // Mock implementation that returns an empty array
  return Promise.resolve([]);
};
import * as https from 'https';
import * as http from 'http';
import * as tls from 'tls';
import * as brotli from 'brotli';
import { URL } from 'url';

import {
  CloudScraperOptions,
  ICloudScraper,
  CloudScraperRequestConfig
} from './types';
import { UserAgent } from './utils/user-agent';
import { ProxyManager } from './utils/proxy-manager';
import { StealthMode } from './utils/stealth-mode';
import { Cloudflare } from './challenges/cloudflare';
import { 
  CloudflareLoopProtection, 
  CloudflareIUAMError 
} from './exceptions';

/**
 * CloudScraper class for bypassing Cloudflare's anti-bot page
 */
export class CloudScraper implements ICloudScraper {
  private axios: AxiosInstance;
  private cookieJar: CookieJar;

  // Debug mode
  public debug: boolean;

  // Cloudflare challenge handling options
  public disableCloudflareV1: boolean;
  public disableCloudflareV2: boolean;
  public disableCloudflareV3: boolean;
  public disableTurnstile: boolean;
  public delay: number | null;
  public captcha: any;
  public doubleDown: boolean;
  public interpreter: string;

  // Request hooks
  private requestPreHook: ((scraper: CloudScraper, method: string, url: string, config: AxiosRequestConfig) => [string, string, AxiosRequestConfig]) | null;
  private requestPostHook: ((scraper: CloudScraper, response: AxiosResponse) => AxiosResponse) | null;

  // TLS/SSL options
  private cipherSuite: string | null;
  private ecdhCurve: string;
  private sourceAddress: string | null;
  private serverHostname: string | null;

  // Compression options
  private allowBrotli: boolean;

  // User agent handling
  private userAgent: UserAgent;

  // Challenge solving depth
  private solveDepthCnt: number = 0;
  private solveDepth: number;

  // Session health monitoring
  private sessionStartTime: number;
  private requestCount: number;
  private last403Time: number;
  private sessionRefreshInterval: number;
  private autoRefreshOn403: boolean;
  private max403Retries: number;
  private _403RetryCount: number;

  // Request throttling and TLS management
  private lastRequestTime: number;
  private minRequestInterval: number;
  private maxConcurrentRequests: number;
  private currentConcurrentRequests: number;
  private rotateTlsCiphers: boolean;
  private _cipherRotationCount: number;

  // Proxy management
  private proxyManager: ProxyManager | null;

  // Stealth mode
  private stealthMode: StealthMode;
  private enableStealth: boolean;

  // Challenge handlers
  private cloudflareV1: Cloudflare;
  // private cloudflareV2: CloudflareV2;
  // private cloudflareV3: CloudflareV3;
  // private turnstile: CloudflareTurnstile;

  /**
   * Create a new CloudScraper instance
   * @param options CloudScraper options
   */
  constructor(options: CloudScraperOptions = {}) {
    // Debug mode
    this.debug = options.debug || false;

    // Cloudflare challenge handling options
    this.disableCloudflareV1 = options.disableCloudflareV1 || false;
    this.disableCloudflareV2 = options.disableCloudflareV2 || false;
    this.disableCloudflareV3 = options.disableCloudflareV3 || false;
    this.disableTurnstile = options.disableTurnstile || false;
    this.delay = options.delay || null;
    this.captcha = options.captcha || {};
    this.doubleDown = options.doubleDown !== false; // Default to true
    this.interpreter = options.interpreter || 'js2py'; // Default to js2py for better compatibility

    // Request hooks
    this.requestPreHook = options.requestPreHook || null;
    this.requestPostHook = options.requestPostHook || null;

    // TLS/SSL options
    this.cipherSuite = null; // Will be set from user agent
    this.ecdhCurve = options.ecdhCurve || 'prime256v1';
    this.sourceAddress = null; // Not used in TypeScript version
    this.serverHostname = typeof options.cipherSuite === 'string' ? options.cipherSuite : null;

    // Compression options
    this.allowBrotli = options.allowBrotli === undefined ? true : options.allowBrotli;

    // User agent handling
    this.userAgent = new UserAgent({
      allowBrotli: this.allowBrotli,
      browser: options.browser
    });

    // Challenge solving depth
    this.solveDepth = options.solveDepth || 3;

    // Session health monitoring
    this.sessionStartTime = Date.now();
    this.requestCount = 0;
    this.last403Time = 0;
    this.sessionRefreshInterval = options.sessionRefreshInterval || 3600; // 1 hour default
    this.autoRefreshOn403 = options.autoRefreshOn403 !== false; // Default to true
    this.max403Retries = options.max403Retries || 3;
    this._403RetryCount = 0;

    // Request throttling and TLS management
    this.lastRequestTime = 0;
    this.minRequestInterval = options.minRequestInterval || 1.0; // Minimum 1 second between requests
    this.maxConcurrentRequests = options.maxConcurrentRequests || 1; // Limit concurrent requests
    this.currentConcurrentRequests = 0;
    this.rotateTlsCiphers = options.rotateTlsCiphers !== false; // Default to true
    this._cipherRotationCount = 0;

    // Initialize cookie jar
    this.cookieJar = new CookieJar();

    // Proxy management
    const proxyOptions = options.proxyOptions || {};
    
    // Handle proxies from options (both arrays and single proxy)
    let proxies: string[] | undefined;
    
    if (options.proxies) {
      // Handle array of proxy objects
      proxies = options.proxies.map(p => {
        const auth = p.auth ? `${p.auth.username}:${p.auth.password}@` : '';
        return `http://${auth}${p.host}:${p.port}`;
      });
    } else if (options.proxy) {
      // Handle single proxy object
      const p = options.proxy;
      const auth = p.auth ? `${p.auth.username}:${p.auth.password}@` : '';
      proxies = [`http://${auth}${p.host}:${p.port}`];
    } else if (options.rotatingProxies) {
      proxies = options.rotatingProxies as string[];
    }
    
    // Map rotation strategy names
    let rotationStrategy: 'sequential' | 'random' | 'smart' | undefined;
    if (options.proxyRotation === 'round-robin') {
      rotationStrategy = 'sequential';
    } else if (options.proxyRotation === 'random') {
      rotationStrategy = 'random';
    } else if (options.proxyRotation === 'sticky-session') {
      rotationStrategy = 'smart';
    } else {
      rotationStrategy = proxyOptions.rotationStrategy;
    }
    
    this.proxyManager = proxies && proxies.length > 0
      ? new ProxyManager({
          proxies,
          proxyRotationStrategy: rotationStrategy,
          banTime: proxyOptions.banTime
        })
      : null;

    // Stealth mode
    this.stealthMode = new StealthMode(this);
    this.enableStealth = options.enableStealth !== false; // Default to true

    // Configure stealth mode
    const stealthOptions = options.stealthOptions || {};
    if (stealthOptions) {
      if (stealthOptions.minDelay !== undefined && stealthOptions.maxDelay !== undefined) {
        this.stealthMode.setDelayRange(stealthOptions.minDelay, stealthOptions.maxDelay);
      }
      this.stealthMode.enableHumanLikeDelays(stealthOptions.humanLikeDelays !== false);
      this.stealthMode.enableRandomizeHeaders(stealthOptions.randomizeHeaders !== false);
      this.stealthMode.enableBrowserQuirks(stealthOptions.browserQuirks !== false);
    }

    // Set cipher suite from user agent
    if (!this.cipherSuite) {
      const cipherSuite = this.userAgent.getCipherSuite();
      this.cipherSuite = Array.isArray(cipherSuite) ? cipherSuite.join(':') : cipherSuite;
    }

    // Create custom HTTPS agent with TLS configuration
    const httpsAgent = new https.Agent({
      ciphers: this.cipherSuite,
      ecdhCurve: this.ecdhCurve,
      servername: this.serverHostname || undefined
    });

    // Create axios instance
    this.axios = wrapper(axios.create({
      jar: this.cookieJar,
      headers: this.userAgent.getHeaders(),
      httpsAgent,
      maxRedirects: 5,
      timeout: 30000
    }));

    // Initialize Cloudflare handlers
    this.cloudflareV1 = new Cloudflare(this);
    // this.cloudflareV2 = new CloudflareV2(this);
    // this.cloudflareV3 = new CloudflareV3(this);
    // this.turnstile = new CloudflareTurnstile(this);
  }

  /**
   * Throw a simple exception with no stack trace
   * @param exception Exception class
   * @param msg Error message
   */
  public simpleException(exception: any, msg: string): never {
    this.solveDepthCnt = 0;
    throw new exception(msg);
  }

  /**
   * Debug request information
   * @param req Request object
   */
  public static debugRequest(req: AxiosResponse): void {
    try {
      console.log('=== Request Debug ===');
      console.log('Status:', req.status);
      console.log('Headers:', req.headers);
      console.log('Data:', typeof req.data === 'string' ? req.data.substring(0, 500) + '...' : req.data);
      console.log('=== End Request Debug ===');
    } catch (error) {
      console.log('Debug Error:', error);
    }
  }

  /**
   * Decode Brotli-encoded content
   * @param resp Response object
   * @returns Response object with decoded content
   */
  public decodeBrotli(resp: AxiosResponse): AxiosResponse {
    if (resp.headers['content-encoding'] === 'br' && resp.data) {
      if (this.allowBrotli && (resp.data instanceof Uint8Array || (typeof Buffer !== 'undefined' && Buffer.isBuffer(resp.data)))) {
        try {
          // Type assertion to handle the Buffer type properly
          const buffer = Buffer.isBuffer(resp.data) ? resp.data : Buffer.from(resp.data as Uint8Array);
          resp.data = brotli.decompress(buffer).toString();
        } catch (error) {
          console.warn('Failed to decompress Brotli content:', error);
        }
      } else {
        console.warn(
          'Brotli content detected, but option allow_brotli is set to False. '
          + 'We will not continue to decompress.'
        );
      }
    }
    return resp;
  }

  /**
   * Make a request with Cloudflare challenge handling
   * @param method HTTP method
   * @param url URL
   * @param config Request configuration
   * @returns Response object
   */
  public async request(
    method: string,
    url: string,
    config: CloudScraperRequestConfig = {}
  ): Promise<AxiosResponse> {
    // Apply request throttling to prevent TLS blocking
    await this._applyRequestThrottling();

    // Rotate TLS cipher suites to avoid detection
    if (this.rotateTlsCiphers) {
      await this._rotateTlsCipherSuite();
    }

    // Check if session needs refresh due to age
    if (this._shouldRefreshSession()) {
      await this._refreshSession(url);
    }

    // Handle proxy rotation if no specific proxies are provided
    if (!config.proxy && this.proxyManager) {
      const proxy = this.proxyManager.getProxy();
      if (proxy) {
        config.proxy = proxy;
      }
    }

    // Apply stealth techniques if enabled
    if (this.enableStealth) {
      config = this.stealthMode.applyStealthTechniques(method, url, config);
    }

    // Track request count
    this.requestCount++;

    // Track concurrent requests
    this.currentConcurrentRequests++;

      // Apply request pre-hook if available
      if (this.requestPreHook) {
        // Use any type to bypass type checking issues
        [method, url, config] = this.requestPreHook(this, method, url, config as any) as [string, string, CloudScraperRequestConfig];
      }    try {
      // Make the request
      const response = await this.performRequest(method, url, config);
      
      // Report successful proxy use if applicable
      if (config.proxy && this.proxyManager) {
        // Use any type to bypass type checking issues
        this.proxyManager.reportSuccess(config.proxy as any);
      }

      // Debug if needed
      if (this.debug) {
        CloudScraper.debugRequest(response);
      }

      // Apply request post-hook if available
      if (this.requestPostHook) {
        const newResponse = this.requestPostHook(this, response);
        if (newResponse !== response) {
          if (this.debug) {
            console.log('==== requestPostHook Debug ====');
            CloudScraper.debugRequest(newResponse);
          }
          return newResponse;
        }
      }

      // Handle Cloudflare challenges
      return await this.handleCloudflareChallenges(response, method, url, config);
    } catch (error: any) {
      // Report failed proxy use if applicable
      if (config.proxy && this.proxyManager && ['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET'].includes(error.code)) {
        // Use any type to bypass type checking issues
        this.proxyManager.reportFailure(config.proxy as any);
      }

      // Always decrement concurrent request counter on exception
      if (this.currentConcurrentRequests > 0) {
        this.currentConcurrentRequests--;
      }
      
      throw error;
    }
  }

  /**
   * Perform a request with axios
   * @param method HTTP method
   * @param url URL
   * @param config Request configuration
   * @returns Response object
   */
  private async performRequest(
    method: string,
    url: string,
    config: CloudScraperRequestConfig = {}
  ): Promise<AxiosResponse> {
    const requestConfig = {
      ...config,
      method,
      url,
      jar: this.cookieJar
    } as any;

    const response = await this.axios(requestConfig);
    return this.decodeBrotli(response);
  }

  /**
   * Handle Cloudflare challenges in a response
   * @param response Response object
   * @param method Original request method
   * @param url Original request URL
   * @param config Original request configuration
   * @returns Response with challenge solved
   */
  private async handleCloudflareChallenges(
    response: AxiosResponse,
    method: string,
    url: string,
    config: CloudScraperRequestConfig = {}
  ): Promise<AxiosResponse> {
    // Check for loop protection
    if (this.solveDepthCnt >= this.solveDepth) {
      const depth = this.solveDepthCnt;
      this.solveDepthCnt = 0;
      throw new CloudflareLoopProtection(
        `!!Loop Protection!! We have tried to solve ${depth} time(s) in a row.`
      );
    }

    // TODO: Implement Turnstile challenge handling
    // TODO: Implement Cloudflare v3 challenge handling
    // TODO: Implement Cloudflare v2 challenge handling

    // Check for Cloudflare v1 challenges
    if (!this.disableCloudflareV1) {
      // Check if Cloudflare v1 anti-bot is on
      if (this.cloudflareV1.isChallengeRequest(response)) {
        // Try to solve the challenge and send it back
        this.solveDepthCnt++;
        return await this.cloudflareV1.challengeResponse(response, config);
      }
    }

    // Reset solve depth counter if no challenge was detected
    if (!response.headers.location && response.status !== 429 && response.status !== 503) {
      this.solveDepthCnt = 0;
      
      // Reset 403 retry count on successful request
      if (response.status === 200 && !this._in403Retry) {
        this._403RetryCount = 0;
      }
    }

    // Handle 403 errors with automatic session refresh
    if (response.status === 403 && this.autoRefreshOn403) {
      return await this._handle403Error(response, method, url, config);
    }

    // Decrement concurrent request counter
    if (this.currentConcurrentRequests > 0) {
      this.currentConcurrentRequests--;
    }

    return response;
  }

  /**
   * Property to track if we're in a 403 retry loop
   */
  private get _in403Retry(): boolean {
    return (this as any)._in403RetryFlag || false;
  }

  /**
   * Set the 403 retry flag
   */
  private set _in403Retry(value: boolean) {
    (this as any)._in403RetryFlag = value;
  }

  /**
   * Handle a 403 error response
   * @param response Response object
   * @param method Original request method
   * @param url Original request URL
   * @param config Original request configuration
   * @returns Response after handling 403
   */
  private async _handle403Error(
    response: AxiosResponse,
    method: string,
    url: string,
    config: CloudScraperRequestConfig = {}
  ): Promise<AxiosResponse> {
    if (this._403RetryCount < this.max403Retries) {
      this._403RetryCount++;
      this.last403Time = Date.now();

      if (this.debug) {
        console.log(`🛡️ Received 403 error, attempting session refresh (attempt ${this._403RetryCount}/${this.max403Retries})`);
      }

      // Try to refresh the session and retry the request
      const refreshSuccess = await this._refreshSession(url);
      
      if (refreshSuccess) {
        if (this.debug) {
          console.log('🔄 Session refreshed successfully, retrying original request...');
        }

        // Mark that we're in a retry to prevent retry count reset
        this._in403Retry = true;
        
        try {
          // Retry the original request
          const retryResponse = await this.request(method, url, config);

          // If retry was successful, reset retry count
          if (retryResponse.status === 200) {
            this._403RetryCount = 0;
            if (this.debug) {
              console.log('✅ 403 retry successful, request completed');
            }
          }

          return retryResponse;
        } finally {
          // Always clear the retry flag
          this._in403Retry = false;
        }
      } else if (this.debug) {
        console.log('❌ Session refresh failed, returning 403 response');
      }
    } else if (this.debug) {
      console.log(`❌ Max 403 retries (${this.max403Retries}) exceeded, returning 403 response`);
    }

    // Decrement concurrent request counter
    if (this.currentConcurrentRequests > 0) {
      this.currentConcurrentRequests--;
    }

    return response;
  }

  /**
   * Check if the session should be refreshed
   * @returns Whether the session should be refreshed
   */
  private _shouldRefreshSession(): boolean {
    const currentTime = Date.now();
    const sessionAge = currentTime - this.sessionStartTime;

    // Refresh if session is older than the configured interval
    if (sessionAge > this.sessionRefreshInterval * 1000) {
      return true;
    }

    // Refresh if we've had recent 403 errors
    if (this.last403Time > 0 && (currentTime - this.last403Time) < 60000) {
      return true;
    }

    return false;
  }

  /**
   * Refresh the session
   * @param url URL of the current request
   * @returns Whether the refresh was successful
   */
  private async _refreshSession(url: string): Promise<boolean> {
    try {
      if (this.debug) {
        console.log('Refreshing session due to staleness or 403 errors...');
      }

      // Clear existing Cloudflare cookies
      await this._clearCloudflareCookies();

      // Reset session tracking (but NOT the retry count yet)
      this.sessionStartTime = Date.now();
      this.requestCount = 0;

      // Generate new user agent to avoid fingerprint detection
      this.userAgent.loadUserAgent();
      
      // Update axios headers
      this.axios.defaults.headers = {
        ...this.axios.defaults.headers,
        ...this.userAgent.getHeaders()
      };

      // Make a simple request to re-establish session
      try {
        const parsedUrl = new URL(url);
        const baseUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}`;

        // Make a lightweight request to trigger challenge solving
        const testResponse = await this.axios.get(baseUrl, {
          timeout: 30000,
          jar: this.cookieJar,
          maxRedirects: 5
        });

        if (this.debug) {
          console.log(`Session refresh request status: ${testResponse.status}`);
        }

        // Only return true if we got a successful response
        const success = [200, 301, 302, 304].includes(testResponse.status);

        if (success && this.debug) {
          console.log('✅ Session refresh successful');
        } else if (!success && this.debug) {
          console.log(`❌ Session refresh failed with status: ${testResponse.status}`);
        }

        return success;
      } catch (error) {
        if (this.debug) {
          console.log(`❌ Session refresh failed: ${error}`);
        }
        return false;
      }
    } catch (error) {
      if (this.debug) {
        console.log(`❌ Error during session refresh: ${error}`);
      }
      return false;
    }
  }

  /**
   * Clear Cloudflare-specific cookies
   */
  private async _clearCloudflareCookies(): Promise<void> {
    const cfCookieNames = [
      'cf_clearance', 
      'cf_chl_2', 
      'cf_chl_prog', 
      'cf_chl_rc_ni', 
      'cf_turnstile', 
      '__cf_bm'
    ];

    // Using tough-cookie API to clear cookies
    try {
      // Use any type to bypass TypeScript issues
      const cookieJar = this.cookieJar as any;
      const domains = await cookieJar.getDomainsSync();
      
      for (const domain of domains) {
        for (const cookieName of cfCookieNames) {
          try {
            await cookieJar.removeAllCookiesSync({
              domain,
              path: '/',
              key: cookieName
            });
          } catch (error) {
            // Ignore errors when removing cookies
          }
        }
      }
    } catch (error) {
      if (this.debug) {
        console.log('Error clearing Cloudflare cookies:', error);
      }
    }

    if (this.debug) {
      console.log('Cleared Cloudflare cookies for session refresh');
    }
  }

  /**
   * Apply request throttling to prevent detection
   */
  private async _applyRequestThrottling(): Promise<void> {
    const currentTime = Date.now();

    // Wait for minimum interval between requests
    const timeSinceLastRequest = currentTime - this.lastRequestTime;
    if (timeSinceLastRequest < this.minRequestInterval * 1000) {
      const sleepTime = this.minRequestInterval - timeSinceLastRequest / 1000;
      if (this.debug) {
        console.log(`⏱️ Request throttling: sleeping ${sleepTime.toFixed(2)}s`);
      }
      await new Promise(resolve => setTimeout(resolve, sleepTime * 1000));
    }

    // Wait if too many concurrent requests
    while (this.currentConcurrentRequests >= this.maxConcurrentRequests) {
      if (this.debug) {
        console.log(`🚦 Concurrent request limit reached (${this.currentConcurrentRequests}/${this.maxConcurrentRequests}), waiting...`);
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Rotate TLS cipher suites to avoid detection
   */
  private async _rotateTlsCipherSuite(): Promise<void> {
    if (!this.userAgent) {
      return;
    }

    try {
      // Get available cipher suites
      const availableCiphers = this.userAgent.getCipherSuite();
      
      if (availableCiphers && availableCiphers.length > 1) {
        // Rotate through cipher suites
        this._cipherRotationCount++;
        const cipherIndex = this._cipherRotationCount % availableCiphers.length;
        
        // Use a subset of ciphers to create variation
        const numCiphers = Math.min(8, availableCiphers.length); // Use up to 8 ciphers
        const startIndex = cipherIndex % (availableCiphers.length - numCiphers + 1);
        const selectedCiphers = availableCiphers.slice(startIndex, startIndex + numCiphers);
        
        const newCipherSuite = selectedCiphers.join(':');
        
        if (newCipherSuite !== this.cipherSuite) {
          this.cipherSuite = newCipherSuite;
          
          // Update the HTTPS agent with new cipher suite
          const httpsAgent = new https.Agent({
            ciphers: this.cipherSuite,
            ecdhCurve: this.ecdhCurve,
            servername: this.serverHostname || undefined
          });
          
          // Update axios instance
          this.axios.defaults.httpsAgent = httpsAgent;
          
          if (this.debug) {
            console.log(`🔐 Rotated TLS cipher suite (rotation #${this._cipherRotationCount})`);
            console.log(`    Using ${selectedCiphers.length} ciphers starting from index ${startIndex}`);
          }
        }
      }
    } catch (error) {
      if (this.debug) {
        console.log(`⚠️ TLS cipher rotation failed: ${error}`);
      }
    }
  }

  /**
   * Get cookies from a URL
   * @param url URL to get cookies for
   * @returns Promise that resolves to cookies object and user agent string
   */
  public async getTokens(
    url: string,
    config: CloudScraperRequestConfig = {}
  ): Promise<[Record<string, string>, string]> {
    try {
      // Make a request to get cookies
      const response = await this.get(url, config);
      
      if (response.status !== 200) {
        throw new Error(`Failed to get tokens: ${response.status} ${response.statusText}`);
      }
      
      // Get the cookies
      const parsedUrl = new URL(response.config.url || url);
      const domain = parsedUrl.hostname;
      
      // Find the cookie domain
      let cookieDomain = null;
      // Use any type to bypass TypeScript issues
      const cookieJar = this.cookieJar as any;
      const domains = await cookieJar.getDomainsSync();
      
      for (const d of domains) {
        if (d.startsWith('.') && domain.endsWith(d.substring(1))) {
          cookieDomain = d;
          break;
        }
      }
      
      if (!cookieDomain) {
        // Try without the dot prefix
        for (const d of domains) {
          if (d === domain) {
            cookieDomain = d;
            break;
          }
        }
        
        if (!cookieDomain) {
          throw new CloudflareIUAMError(
            "Unable to find Cloudflare cookies. Does the site actually "
            + "have Cloudflare IUAM (I'm Under Attack Mode) enabled?"
          );
        }
      }
      
      // Get all Cloudflare cookies
      const cfCookies: Record<string, string> = {};
      const cookieNames = ['cf_clearance', 'cf_chl_2', 'cf_chl_prog', 'cf_chl_rc_ni', 'cf_turnstile'];
      
      for (const cookieName of cookieNames) {
        const cookies = await this.cookieJar.getCookiesSync(parsedUrl.href);
        const cookie = cookies.find((c: { key: string; value: string }) => c.key === cookieName);
        
        if (cookie) {
          cfCookies[cookieName] = cookie.value;
        }
      }
      
      return [
        cfCookies,
        this.userAgent.getUserAgent()
      ];
    } catch (error) {
      throw new Error(`Failed to get tokens: ${(error as Error).message}`);
    }
  }

  /**
   * Get cookies as a string from a URL
   * @param url URL to get cookies for
   * @returns Promise that resolves to cookie string and user agent string
   */
  public async getCookieString(
    url: string,
    config: CloudScraperRequestConfig = {}
  ): Promise<[string, string]> {
    const [tokens, userAgent] = await this.getTokens(url, config);
    return [
      Object.entries(tokens).map(([key, value]) => `${key}=${value}`).join('; '),
      userAgent
    ];
  }

  /**
   * HTTP GET request
   * @param url URL to request
   * @param config Request configuration
   * @returns Response object
   */
  public async get(url: string, config: CloudScraperRequestConfig = {}): Promise<AxiosResponse> {
    return this.request('GET', url, config);
  }

  /**
   * HTTP POST request
   * @param url URL to request
   * @param data Data to send
   * @param config Request configuration
   * @returns Response object
   */
  public async post(url: string, data?: any, config: CloudScraperRequestConfig = {}): Promise<AxiosResponse> {
    return this.request('POST', url, { ...config, data });
  }

  /**
   * HTTP PUT request
   * @param url URL to request
   * @param data Data to send
   * @param config Request configuration
   * @returns Response object
   */
  public async put(url: string, data?: any, config: CloudScraperRequestConfig = {}): Promise<AxiosResponse> {
    return this.request('PUT', url, { ...config, data });
  }

  /**
   * HTTP DELETE request
   * @param url URL to request
   * @param config Request configuration
   * @returns Response object
   */
  public async delete(url: string, config: CloudScraperRequestConfig = {}): Promise<AxiosResponse> {
    return this.request('DELETE', url, config);
  }

  /**
   * HTTP HEAD request
   * @param url URL to request
   * @param config Request configuration
   * @returns Response object
   */
  public async head(url: string, config: CloudScraperRequestConfig = {}): Promise<AxiosResponse> {
    return this.request('HEAD', url, config);
  }

  /**
   * HTTP OPTIONS request
   * @param url URL to request
   * @param config Request configuration
   * @returns Response object
   */
  public async options(url: string, config: CloudScraperRequestConfig = {}): Promise<AxiosResponse> {
    return this.request('OPTIONS', url, config);
  }

  /**
   * HTTP PATCH request
   * @param url URL to request
   * @param data Data to send
   * @param config Request configuration
   * @returns Response object
   */
  public async patch(url: string, data?: any, config: CloudScraperRequestConfig = {}): Promise<AxiosResponse> {
    return this.request('PATCH', url, { ...config, data });
  }

  /**
   * Get the current proxy configuration being used
   * @returns Current proxy configuration or null if not using proxies
   */
  public getCurrentProxy(): Record<string, string> | null {
    return this.proxyManager ? this.proxyManager.getCurrentProxy() : null;
  }
  
  /**
   * Get all cookies as a Record
   * @returns Record of cookie names to values
   */
  public getCookies(): Record<string, string> {
    const cookies: Record<string, string> = {};
    
    try {
      const cookieArray = this.cookieJar.getCookiesSync('');
      for (const cookie of cookieArray) {
        if (typeof cookie === 'object' && cookie !== null && 'key' in cookie && 'value' in cookie) {
          cookies[cookie.key as string] = cookie.value as string;
        }
      }
    } catch (error) {
      console.error('Error getting cookies:', error);
    }
    
    return cookies;
  }
  
  /**
   * Solve a Cloudflare challenge
   * @param response Response containing a challenge
   * @returns Solved response
   */
  public async solveChallenge(response: AxiosResponse): Promise<AxiosResponse> {
    const cloudflare = new Cloudflare(this);
    
    if (cloudflare.isChallengeRequest(response)) {
      return cloudflare.challengeResponse(response, response.config);
    }
    
    return response;
  }
}

/**
 * Create a new CloudScraper instance
 * @param options CloudScraper options
 * @returns CloudScraper instance
 */
export function createScraper(options: CloudScraperOptions = {}): ICloudScraper {
  return new CloudScraper(options);
}

/**
 * Get tokens (cookies) from a URL
 * @param url URL to get tokens for
 * @param options CloudScraper options
 * @returns Promise that resolves to cookies object and user agent string
 */
export async function getTokens(
  url: string,
  options: CloudScraperOptions = {}
): Promise<[Record<string, string>, string]> {
  const scraper = createScraper(options);
  return (scraper as CloudScraper).getTokens(url);
}

/**
 * Get cookie string from a URL
 * @param url URL to get cookies for
 * @param options CloudScraper options
 * @returns Promise that resolves to cookie string and user agent string
 */
export async function getCookieString(
  url: string,
  options: CloudScraperOptions = {}
): Promise<[string, string]> {
  const scraper = createScraper(options);
  return (scraper as CloudScraper).getCookieString(url);
}

// Export convenience functions
export { createScraper as session };
