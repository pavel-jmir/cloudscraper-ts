// Main module export file
import { createScraper, getTokens, getCookieString, session, CloudScraper } from './index';
export { createScraper, getTokens, getCookieString, session, CloudScraper };

// Export create as an alias for createScraper
export const create = createScraper;

// Export types
export * from './types';

// Export exceptions
export * from './exceptions';

// Export utils
export { UserAgent } from './utils/user-agent';
export { ProxyManager } from './utils/proxy-manager';
export { StealthMode } from './utils/stealth-mode';

// Version
export const version = '1.0.0';
