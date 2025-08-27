import { UserAgent } from '../src/utils/user-agent';
import { ProxyManager } from '../src/utils/proxy-manager';
import { StealthMode } from '../src/utils/stealth-mode';

describe('UserAgent', () => {
  describe('constructor', () => {
    it('should create an instance with default settings', () => {
      const ua = new UserAgent();
      expect(ua).toBeInstanceOf(UserAgent);
    });

    it('should create an instance with custom browser', () => {
      const ua = new UserAgent('chrome');
      expect(ua).toBeInstanceOf(UserAgent);
      expect(ua.getBrowser()).toBe('chrome');
    });

    it('should create an instance with mobile setting', () => {
      const ua = new UserAgent('chrome', true);
      expect(ua).toBeInstanceOf(UserAgent);
      expect(ua.isMobile()).toBe(true);
    });
  });

  describe('getHeader', () => {
    it('should return a valid user agent string', () => {
      const ua = new UserAgent('chrome');
      const header = ua.getHeader();
      expect(typeof header).toBe('string');
      expect(header).toMatch(/Mozilla|Chrome|Firefox/);
    });

    it('should return a valid mobile user agent string when mobile is true', () => {
      const ua = new UserAgent('chrome', true);
      const header = ua.getHeader();
      expect(typeof header).toBe('string');
      expect(header).toMatch(/Mobile|Android|iPhone/);
    });
  });

  describe('getBrowserData', () => {
    it('should return browser data for chrome', () => {
      const ua = new UserAgent('chrome');
      const data = ua.getBrowserData();
      expect(data).toBeDefined();
      expect(data.name).toBe('chrome');
    });

    it('should return browser data for firefox', () => {
      const ua = new UserAgent('firefox');
      const data = ua.getBrowserData();
      expect(data).toBeDefined();
      expect(data.name).toBe('firefox');
    });

    it('should return default browser data for unknown browser', () => {
      const ua = new UserAgent('unknown' as any);
      const data = ua.getBrowserData();
      expect(data).toBeDefined();
      // Should default to chrome
      expect(data.name).toBe('chrome');
    });
  });
});

describe('ProxyManager', () => {
  const singleProxy = { host: 'proxy.example.com', port: 8080 };
  const multipleProxies = [
    { host: 'proxy1.example.com', port: 8080 },
    { host: 'proxy2.example.com', port: 8080 },
    { host: 'proxy3.example.com', port: 8080 }
  ];

  describe('constructor', () => {
    it('should create an instance with no proxy', () => {
      const proxyManager = new ProxyManager();
      expect(proxyManager).toBeInstanceOf(ProxyManager);
      expect(proxyManager.getCurrentProxy()).toBeNull();
    });

    it('should create an instance with a single proxy', () => {
      const proxyManager = new ProxyManager(singleProxy);
      expect(proxyManager).toBeInstanceOf(ProxyManager);
      expect(proxyManager.getCurrentProxy()).toEqual(singleProxy);
    });

    it('should create an instance with multiple proxies', () => {
      const proxyManager = new ProxyManager(multipleProxies);
      expect(proxyManager).toBeInstanceOf(ProxyManager);
      expect(proxyManager.getCurrentProxy()).toEqual(multipleProxies[0]);
    });
  });

  describe('getNextProxy', () => {
    it('should return null when no proxies are available', () => {
      const proxyManager = new ProxyManager();
      expect(proxyManager.getNextProxy()).toBeNull();
    });

    it('should return the same proxy when only one is available', () => {
      const proxyManager = new ProxyManager(singleProxy);
      expect(proxyManager.getNextProxy()).toEqual(singleProxy);
      expect(proxyManager.getNextProxy()).toEqual(singleProxy);
    });

    it('should rotate proxies in round-robin fashion', () => {
      const proxyManager = new ProxyManager(multipleProxies, 'round-robin');
      expect(proxyManager.getNextProxy()).toEqual(multipleProxies[0]);
      expect(proxyManager.getNextProxy()).toEqual(multipleProxies[1]);
      expect(proxyManager.getNextProxy()).toEqual(multipleProxies[2]);
      expect(proxyManager.getNextProxy()).toEqual(multipleProxies[0]);
    });

    it('should select proxies randomly', () => {
      const proxyManager = new ProxyManager(multipleProxies, 'random');
      const proxy1 = proxyManager.getNextProxy();
      expect(multipleProxies).toContain(proxy1);
      
      // Due to randomness, we can't assert exact proxy selection
    });
  });

  describe('reportProxySuccess/Failure', () => {
    it('should mark a proxy as successful', () => {
      const proxyManager = new ProxyManager(multipleProxies);
      proxyManager.reportProxySuccess(multipleProxies[0]);
      // Success just updates internal state, no direct observable changes
      expect(proxyManager.getCurrentProxy()).toBeDefined();
    });

    it('should mark a proxy as failed and rotate to next one', () => {
      const proxyManager = new ProxyManager(multipleProxies);
      const firstProxy = proxyManager.getCurrentProxy();
      proxyManager.reportProxyFailure(firstProxy);
      const nextProxy = proxyManager.getCurrentProxy();
      expect(nextProxy).not.toEqual(firstProxy);
    });
  });
});

describe('StealthMode', () => {
  describe('constructor', () => {
    it('should create an instance with default settings', () => {
      const stealth = new StealthMode();
      expect(stealth).toBeInstanceOf(StealthMode);
    });

    it('should create an instance with custom options', () => {
      const options = {
        delayBetweenRequests: [100, 500],
        randomizeUserAgent: true,
        randomizeFingerprint: true
      };
      const stealth = new StealthMode(options);
      expect(stealth).toBeInstanceOf(StealthMode);
    });
  });

  describe('applyStealthHeaders', () => {
    it('should add stealth headers to request config', () => {
      const stealth = new StealthMode();
      const config = { headers: {} };
      const result = stealth.applyStealthHeaders(config);
      
      expect(result).toHaveProperty('headers');
      expect(Object.keys(result.headers).length).toBeGreaterThan(0);
    });
  });

  describe('getRandomDelay', () => {
    it('should return a random delay within the specified range', () => {
      const min = 100;
      const max = 500;
      const stealth = new StealthMode({ delayBetweenRequests: [min, max] });
      const delay = stealth.getRandomDelay();
      
      expect(delay).toBeGreaterThanOrEqual(min);
      expect(delay).toBeLessThanOrEqual(max);
    });
  });
});
