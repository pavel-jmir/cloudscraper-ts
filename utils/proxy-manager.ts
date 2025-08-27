import { ProxyOptions } from '../types';

/**
 * Proxy manager class for handling proxy rotation
 */
export class ProxyManager {
  private proxies: string[];
  private rotationStrategy: 'sequential' | 'random' | 'smart';
  private banTime: number;
  private currentIndex: number = 0;
  private bannedProxies: Map<string, number> = new Map();
  private proxyStats: Map<string, { successes: number; failures: number }> = new Map();
  private currentProxy: Record<string, string> | null = null;

  /**
   * Create a new ProxyManager instance
   * @param proxiesOrOptions Single proxy, array of proxies, or proxy options
   * @param rotationStrategy Proxy rotation strategy
   * @param banTime Ban time in seconds
   */
  constructor(
    proxiesOrOptions?: 
      string | string[] | Record<string, string> | null | 
      { proxies: string[] | Record<string, string> | null | undefined; proxyRotationStrategy?: 'sequential' | 'random' | 'smart'; banTime?: number; },
    rotationStrategy?: 'sequential' | 'random' | 'smart',
    banTime?: number
  ) {
    // Handle different constructor forms
    let proxies;
    let proxyRotationStrategy = rotationStrategy;
    let proxyBanTime = banTime;
    
    if (!proxiesOrOptions) {
      // No proxies
      proxies = [];
    } else if (typeof proxiesOrOptions === 'string') {
      // Single proxy string
      proxies = [proxiesOrOptions];
    } else if (Array.isArray(proxiesOrOptions)) {
      // Array of proxies
      proxies = proxiesOrOptions;
    } else if (typeof proxiesOrOptions === 'object' && 'proxies' in proxiesOrOptions) {
      // Options object with proxies property
      proxies = proxiesOrOptions.proxies;
      if (!proxyRotationStrategy && proxiesOrOptions.proxyRotationStrategy) {
        proxyRotationStrategy = proxiesOrOptions.proxyRotationStrategy as 'sequential' | 'random' | 'smart';
      }
      if (!proxyBanTime && proxiesOrOptions.banTime) {
        proxyBanTime = Number(proxiesOrOptions.banTime);
      }
    } else if (typeof proxiesOrOptions === 'object') {
      // Record<string, string> proxies
      proxies = proxiesOrOptions;
    }
    
    // Convert object of proxies to array
    if (proxies && typeof proxies === 'object' && !Array.isArray(proxies)) {
      this.proxies = Object.values(proxies);
    } else {
      this.proxies = (proxies as string[]) || [];
    }

    this.rotationStrategy = proxyRotationStrategy || 'sequential';
    this.banTime = proxyBanTime || 300; // Default 5 minutes

    // Initialize stats for each proxy
    for (const proxy of this.proxies) {
      this.proxyStats.set(proxy, { successes: 0, failures: 0 });
    }
  }

  /**
   * Get the next proxy based on the selected rotation strategy
   * @returns Proxy URL or undefined if no proxies are available
   */
  public getProxy(): Record<string, string> | undefined {
    if (this.proxies.length === 0) {
      return undefined;
    }

    // Clean up expired banned proxies
    this.cleanupBannedProxies();

    // Filter out banned proxies
    const availableProxies = this.proxies.filter(p => !this.bannedProxies.has(p));
    
    if (availableProxies.length === 0) {
      return undefined;
    }

    let selectedProxy: string;

    switch (this.rotationStrategy) {
      case 'random':
        selectedProxy = this.getRandomProxy(availableProxies);
        break;
      case 'smart':
        selectedProxy = this.getSmartProxy(availableProxies);
        break;
      case 'sequential':
      default:
        selectedProxy = this.getSequentialProxy(availableProxies);
        break;
    }

    this.currentProxy = this.proxyToConfig(selectedProxy);
    return this.currentProxy;
  }
  
  /**
   * Get the current proxy configuration
   * @returns Current proxy configuration or null if no proxy is in use
   */
  public getCurrentProxy(): Record<string, string> | null {
    return this.currentProxy;
  }

  /**
   * Report a successful proxy use
   * @param proxy Proxy configuration
   */
  public reportSuccess(proxy: Record<string, string>): void {
    const proxyUrl = this.configToProxyUrl(proxy);
    if (!proxyUrl) return;

    const stats = this.proxyStats.get(proxyUrl);
    if (stats) {
      stats.successes++;
      this.proxyStats.set(proxyUrl, stats);
    }
  }

  /**
   * Report a proxy failure and ban it temporarily
   * @param proxy Proxy configuration
   */
  public reportFailure(proxy: Record<string, string>): void {
    const proxyUrl = this.configToProxyUrl(proxy);
    if (!proxyUrl) return;

    // Ban the proxy
    this.bannedProxies.set(proxyUrl, Date.now() + this.banTime * 1000);

    // Update stats
    const stats = this.proxyStats.get(proxyUrl);
    if (stats) {
      stats.failures++;
      this.proxyStats.set(proxyUrl, stats);
    }
  }

  /**
   * Clean up expired banned proxies
   */
  private cleanupBannedProxies(): void {
    const now = Date.now();
    for (const [proxy, expiry] of this.bannedProxies.entries()) {
      if (expiry < now) {
        this.bannedProxies.delete(proxy);
      }
    }
  }

  /**
   * Get a sequential proxy
   * @param availableProxies List of available proxies
   * @returns Proxy URL
   */
  private getSequentialProxy(availableProxies: string[]): string {
    if (this.currentIndex >= availableProxies.length) {
      this.currentIndex = 0;
    }
    return availableProxies[this.currentIndex++];
  }

  /**
   * Get a random proxy
   * @param availableProxies List of available proxies
   * @returns Proxy URL
   */
  private getRandomProxy(availableProxies: string[]): string {
    const index = Math.floor(Math.random() * availableProxies.length);
    return availableProxies[index];
  }

  /**
   * Get a smart proxy based on success/failure history
   * @param availableProxies List of available proxies
   * @returns Proxy URL
   */
  private getSmartProxy(availableProxies: string[]): string {
    // Calculate scores for each proxy
    const proxyScores: [string, number][] = availableProxies.map(proxy => {
      const stats = this.proxyStats.get(proxy) || { successes: 0, failures: 0 };
      
      // Simple score calculation: success ratio with a small epsilon to avoid division by zero
      const total = stats.successes + stats.failures;
      const successRatio = total > 0 ? stats.successes / total : 0.5;
      
      // Add some exploration factor for proxies with fewer attempts
      const explorationFactor = 1 / (1 + total);
      const score = successRatio * 0.8 + explorationFactor * 0.2;
      
      return [proxy, score];
    });

    // Sort by score (higher is better)
    proxyScores.sort((a, b) => b[1] - a[1]);

    // Select the proxy with the highest score (or random from top 3 to avoid always using the same)
    const topN = Math.min(3, proxyScores.length);
    const selectedIndex = Math.floor(Math.random() * topN);
    
    return proxyScores[selectedIndex][0];
  }

  /**
   * Convert a proxy URL to a proxy configuration object
   * @param proxyUrl Proxy URL
   * @returns Proxy configuration
   */
  private proxyToConfig(proxyUrl: string): Record<string, string> {
    try {
      const url = new URL(proxyUrl);
      const protocol = url.protocol.replace(':', '');
      
      return {
        [protocol]: proxyUrl
      };
    } catch (error) {
      // If the proxy URL is invalid, try to guess the protocol
      if (proxyUrl.startsWith('http://')) {
        return { http: proxyUrl };
      } else if (proxyUrl.startsWith('https://')) {
        return { https: proxyUrl };
      } else {
        // Default to HTTP if no protocol is specified
        return { http: `http://${proxyUrl}` };
      }
    }
  }

  /**
   * Convert a proxy configuration object to a proxy URL
   * @param proxy Proxy configuration
   * @returns Proxy URL or undefined
   */
  private configToProxyUrl(proxy: Record<string, string>): string | undefined {
    for (const protocol of ['http', 'https', 'socks', 'socks5']) {
      if (proxy[protocol]) {
        return proxy[protocol];
      }
    }
    return undefined;
  }
}
