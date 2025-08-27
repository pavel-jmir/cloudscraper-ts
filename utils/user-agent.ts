import * as fs from 'fs';
import * as path from 'path';
import { BrowserOptions } from '../types';

/**
 * User Agent manager class
 */
export class UserAgent {
  private headers: Record<string, string>;
  private cipherSuite: string[] = [];
  private browser?: string;
  private platform?: string;
  private mobile: boolean = true;
  private desktop: boolean = true;
  private custom?: string;
  private allowBrotli: boolean = false;
  private browsersData: any;

  /**
   * Create a new UserAgent instance
   * @param options Options for the UserAgent or browser string
   * @param isMobile Whether to use a mobile user agent
   */
  constructor(
    options: { allowBrotli?: boolean; browser?: BrowserOptions | string } | string = {},
    isMobile: boolean = false
  ) {
    // Support for constructor(browser, isMobile) signature from tests
    if (typeof options === 'string') {
      this.browser = options;
      this.mobile = isMobile;
      this.allowBrotli = false;
    } else {
      this.allowBrotli = options.allowBrotli || false;
      
      if (typeof options.browser === 'string') {
        this.browser = options.browser;
      } else if (options.browser && typeof options.browser === 'object') {
        this.browser = options.browser.browser;
        this.platform = options.browser.platform;
        this.mobile = options.browser.mobile !== false;
        this.desktop = options.browser.desktop !== false;
        this.custom = options.browser.custom;
      }
    }
    
    this.headers = {
      'User-Agent': '',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': this.allowBrotli ? 'gzip, deflate, br' : 'gzip, deflate',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Cache-Control': 'max-age=0'
    };

    this.loadBrowserData();
    this.loadUserAgent();
  }
  
  /**
   * Load browser data from JSON file
   */
  private loadBrowserData(): void {
    this.browsersData = this.readBrowserData();
  }

    /**
   * Read browser data from JSON file
   * @returns Browser data
   */
  private readBrowserData(): Record<string, any> {
    try {
      // Use import.meta.url or process.cwd() if available
      const currentDir = typeof process !== 'undefined' ? 
        process.cwd() : 
        '.';
      
      // Try to find browsers.json in several locations
      const possiblePaths = [
        path.join(currentDir, 'data', 'browsers.json'),
        path.join(currentDir, 'src', 'data', 'browsers.json'),
        path.join(currentDir, 'cloudscraper-ts', 'data', 'browsers.json'),
        path.join(currentDir, 'cloudscraper-ts', 'src', 'data', 'browsers.json')
      ];

      for (const filePath of possiblePaths) {
        if (fs.existsSync(filePath)) {
          return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
      }
      
      // Return default empty browsers data if no file found
      return {};
    } catch (error) {
      console.error('Error reading browser data:', error);
      return {};
    }
  }

  /**
   * Get user agent string
   */
  public getUserAgent(): string {
    return this.headers['User-Agent'];
  }

  /**
   * Get headers
   */
  public getHeaders(): Record<string, string> {
    return this.headers;
  }
  
  /**
   * Get header (for test compatibility)
   */
  public getHeader(): string {
    return this.getUserAgent();
  }

  /**
   * Get cipher suite
   */
  public getCipherSuite(): string[] {
    return this.cipherSuite;
  }
  
  /**
   * Get current browser
   */
  public getBrowser(): string {
    return this.browser || 'chrome';
  }
  
  /**
   * Get browser data
   */
  public getBrowserData(): any {
    return {
      name: this.getBrowser(),
      version: '90.0',
      platform: this.platform || 'windows',
      mobile: this.isMobile()
    };
  }
  
  /**
   * Check if current user agent is mobile
   */
  public isMobile(): boolean {
    const ua = this.getUserAgent().toLowerCase();
    return ua.includes('mobile') || ua.includes('android') || ua.includes('iphone');
  }

  /**
   * Load a user agent based on the configured options
   */
  public loadUserAgent(): void {
    if (this.custom) {
      // Use custom user agent if provided
      this.headers['User-Agent'] = this.custom;
      
      // Try to find matching browser settings for the custom UA
      const browserTypes = this.browsersData.browsers || {};
      for (const browserType in browserTypes) {
        for (const platformType in browserTypes[browserType]) {
          for (const userAgent of browserTypes[browserType][platformType]) {
            if (userAgent === this.custom) {
              this.cipherSuite = this.browsersData.cipherSuite?.[browserType] || [];
              return;
            }
          }
        }
      }
      
      // If no match found, use default cipher suite
      this.cipherSuite = this.getDefaultCipherSuite();
      return;
    }

    // Get available browsers
    const availableBrowsers = Object.keys(this.browsersData.browsers || {});
    
    // Select browser type
    let browserType = this.browser && availableBrowsers.includes(this.browser)
      ? this.browser 
      : this.getRandomItem(availableBrowsers);

    // Get available platforms for the selected browser
    const availablePlatforms = Object.keys(this.browsersData.browsers[browserType] || {});
    
    // Filter platforms based on mobile/desktop preference
    const filteredPlatforms = availablePlatforms.filter(platform => {
      const isMobilePlatform = ['android', 'ios'].includes(platform);
      return (isMobilePlatform && this.mobile) || (!isMobilePlatform && this.desktop);
    });
    
    // Select platform
    let platformType = this.platform && filteredPlatforms.includes(this.platform)
      ? this.platform
      : this.getRandomItem(filteredPlatforms);
    
    // If no suitable platform found, use any available platform
    if (!platformType && availablePlatforms.length > 0) {
      platformType = this.getRandomItem(availablePlatforms);
    }
    
    // Select user agent
    const userAgents = this.browsersData.browsers[browserType]?.[platformType] || [];
    if (userAgents.length > 0) {
      this.headers['User-Agent'] = this.getRandomItem(userAgents);
      this.cipherSuite = this.browsersData.cipherSuite?.[browserType] || this.getDefaultCipherSuite();
    } else {
      // If no user agents available, use fallback
      this.headers['User-Agent'] = this.getFallbackUserAgent();
      this.cipherSuite = this.getDefaultCipherSuite();
    }
  }

  /**
   * Get a random item from an array
   * @param items Array of items
   * @returns Random item
   */
  private getRandomItem<T>(items: T[]): T {
    return items[Math.floor(Math.random() * items.length)];
  }

  /**
   * Get a fallback user agent if no appropriate one is found
   */
  private getFallbackUserAgent(): string {
    const fallbackUserAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:88.0) Gecko/20100101 Firefox/88.0'
    ];
    
    return this.getRandomItem(fallbackUserAgents);
  }

  /**
   * Get default cipher suite
   */
  private getDefaultCipherSuite(): string[] {
    return [
      'TLS_AES_128_GCM_SHA256',
      'TLS_AES_256_GCM_SHA384',
      'TLS_CHACHA20_POLY1305_SHA256',
      'ECDHE-ECDSA-AES128-GCM-SHA256',
      'ECDHE-RSA-AES128-GCM-SHA256',
      'ECDHE-ECDSA-AES256-GCM-SHA384',
      'ECDHE-RSA-AES256-GCM-SHA384',
      'ECDHE-ECDSA-CHACHA20-POLY1305',
      'ECDHE-RSA-CHACHA20-POLY1305',
      'ECDHE-RSA-AES128-SHA',
      'ECDHE-RSA-AES256-SHA',
      'AES128-GCM-SHA256',
      'AES256-GCM-SHA384',
      'AES128-SHA',
      'AES256-SHA'
    ];
  }

  /**
   * Embedded browser data as fallback when browsers.json is not available
   */
  private getEmbeddedBrowsersData(): any {
    return {
      browsers: {
        chrome: {
          windows: [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
          ],
          mac: [
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
          ],
          linux: [
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
          ],
          android: [
            "Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.210 Mobile Safari/537.36",
            "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36"
          ]
        },
        firefox: {
          windows: [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:88.0) Gecko/20100101 Firefox/88.0",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0"
          ],
          mac: [
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:88.0) Gecko/20100101 Firefox/88.0",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:89.0) Gecko/20100101 Firefox/89.0"
          ],
          linux: [
            "Mozilla/5.0 (X11; Linux x86_64; rv:88.0) Gecko/20100101 Firefox/88.0",
            "Mozilla/5.0 (X11; Linux x86_64; rv:89.0) Gecko/20100101 Firefox/89.0"
          ],
          android: [
            "Mozilla/5.0 (Android 10; Mobile; rv:88.0) Gecko/88.0 Firefox/88.0",
            "Mozilla/5.0 (Android 11; Mobile; rv:89.0) Gecko/89.0 Firefox/89.0"
          ]
        }
      },
      cipherSuite: {
        chrome: [
          "TLS_AES_128_GCM_SHA256",
          "TLS_AES_256_GCM_SHA384",
          "TLS_CHACHA20_POLY1305_SHA256",
          "ECDHE-ECDSA-AES128-GCM-SHA256",
          "ECDHE-RSA-AES128-GCM-SHA256"
        ],
        firefox: [
          "TLS_AES_128_GCM_SHA256",
          "TLS_CHACHA20_POLY1305_SHA256",
          "TLS_AES_256_GCM_SHA384",
          "ECDHE-ECDSA-AES128-GCM-SHA256",
          "ECDHE-RSA-AES128-GCM-SHA256"
        ]
      }
    };
  }
}
