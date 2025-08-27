/**
 * Integration tests for CloudScraper
 * 
 * These tests check the full functionality of the CloudScraper library
 * by making actual HTTP requests and verifying the responses.
 * 
 * Note: Some tests may fail if the test sites change their protection
 * methods or if the network connection is unstable.
 */

import { CloudScraper } from '../src/main';
import axios from 'axios';
import { CloudflareError } from '../src/exceptions';

// Mock axios for controlled testing
jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

describe('CloudScraper Integration Tests', () => {
  let scraper: CloudScraper;

  beforeEach(() => {
    // Reset mocks between tests
    jest.resetAllMocks();
    
    // Create a fresh CloudScraper instance for each test
    scraper = new CloudScraper({
      browser: 'chrome',
      debug: false,
      challengesToSolve: 3,
      timeout: 15000
    });
  });

  describe('HTTP Methods', () => {
    it('should perform a GET request successfully', async () => {
      // Mock successful response
      mockAxios.create.mockImplementation(() => ({
        request: jest.fn().mockResolvedValue({
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'text/html' },
          data: '<html><body>Success</body></html>'
        }),
        defaults: { headers: { common: {} } }
      }) as any);

      const response = await scraper.get('https://example.com');
      
      expect(response).toBeValidCloudScraperResponse();
      expect(response.status).toBe(200);
      expect(response.data).toContain('Success');
    });

    it('should perform a POST request successfully', async () => {
      // Mock successful response
      mockAxios.create.mockImplementation(() => ({
        request: jest.fn().mockResolvedValue({
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' },
          data: JSON.stringify({ success: true })
        }),
        defaults: { headers: { common: {} } }
      }) as any);

      const response = await scraper.post('https://example.com/api', { key: 'value' });
      
      expect(response).toBeValidCloudScraperResponse();
      expect(response.status).toBe(200);
      expect(response.data).toContain('success');
    });

    it('should handle request errors properly', async () => {
      // Mock network error
      mockAxios.create.mockImplementation(() => ({
        request: jest.fn().mockRejectedValue(new Error('Network Error')),
        defaults: { headers: { common: {} } }
      }) as any);

      await expect(scraper.get('https://example.com')).rejects.toThrow('Network Error');
    });
  });

  describe('Cloudflare Challenge Detection', () => {
    it('should detect and handle a Cloudflare challenge', async () => {
      // First request returns a challenge
      const mockRequest = jest.fn()
        .mockResolvedValueOnce({
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 
            'server': 'cloudflare', 
            'content-type': 'text/html' 
          },
          data: '<html><head><title>Just a moment...</title></head><body>Checking your browser...</body></html>'
        })
        .mockResolvedValueOnce({
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'text/html' },
          data: '<html><body>Success after challenge</body></html>'
        });

      mockAxios.create.mockImplementation(() => ({
        request: mockRequest,
        defaults: { headers: { common: {} } }
      }) as any);

      const response = await scraper.get('https://example.com');
      
      expect(mockRequest).toHaveBeenCalledTimes(2);
      expect(response.status).toBe(200);
      expect(response.data).toContain('Success after challenge');
    });

    it('should throw after exceeding challengesToSolve limit', async () => {
      // Mock a challenge that never resolves
      mockAxios.create.mockImplementation(() => ({
        request: jest.fn().mockResolvedValue({
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 
            'server': 'cloudflare', 
            'content-type': 'text/html' 
          },
          data: '<html><head><title>Just a moment...</title></head><body>Checking your browser...</body></html>'
        }),
        defaults: { headers: { common: {} } }
      }) as any);

      const scraper = new CloudScraper({
        browser: 'chrome',
        challengesToSolve: 2
      });

      await expect(scraper.get('https://example.com')).rejects.toThrow(CloudflareError);
    });
  });

  describe('Cookie Management', () => {
    it('should manage cookies across requests', async () => {
      // Mock responses with cookies
      const mockRequest = jest.fn()
        .mockResolvedValueOnce({
          status: 200,
          statusText: 'OK',
          headers: { 
            'set-cookie': ['cookie1=value1; Path=/', 'cookie2=value2; Path=/'] 
          },
          data: '<html><body>First response</body></html>'
        })
        .mockResolvedValueOnce({
          status: 200,
          statusText: 'OK',
          headers: {},
          data: '<html><body>Second response</body></html>'
        });

      mockAxios.create.mockImplementation(() => ({
        request: mockRequest,
        defaults: { headers: { common: {} } }
      }) as any);

      // First request should save cookies
      await scraper.get('https://example.com');
      
      // Second request should send cookies
      await scraper.get('https://example.com');

      expect(mockRequest).toHaveBeenCalledTimes(2);
      
      // Check that the second request sent cookies
      const secondRequestConfig = mockRequest.mock.calls[1][0];
      expect(secondRequestConfig.headers).toBeDefined();
      expect(secondRequestConfig.headers.Cookie).toBeDefined();
    });
  });

  describe('Proxy Handling', () => {
    it('should use the configured proxy', async () => {
      // Mock successful response
      mockAxios.create.mockImplementation(() => ({
        request: jest.fn().mockResolvedValue({
          status: 200,
          statusText: 'OK',
          headers: {},
          data: '<html><body>Success</body></html>'
        }),
        defaults: { headers: { common: {} } }
      }) as any);

      const scraper = new CloudScraper({
        proxy: {
          host: 'proxy.example.com',
          port: 8080
        }
      });

      await scraper.get('https://example.com');

      // Check that the request used the proxy
      const requestConfig = mockAxios.create.mock.calls[0][0];
      expect(requestConfig.proxy).toBeDefined();
      expect(requestConfig.proxy.host).toBe('proxy.example.com');
    });

    it('should rotate proxies on failure', async () => {
      // Mock failure then success
      const mockRequest = jest.fn()
        .mockRejectedValueOnce(new Error('Proxy Connection Error'))
        .mockResolvedValueOnce({
          status: 200,
          statusText: 'OK',
          headers: {},
          data: '<html><body>Success</body></html>'
        });

      mockAxios.create.mockImplementation(() => ({
        request: mockRequest,
        defaults: { headers: { common: {} } }
      }) as any);

      const scraper = new CloudScraper({
        proxies: [
          { host: 'proxy1.example.com', port: 8080 },
          { host: 'proxy2.example.com', port: 8080 }
        ],
        proxyRotation: 'round-robin'
      });

      const response = await scraper.get('https://example.com');
      
      expect(mockRequest).toHaveBeenCalledTimes(2);
      expect(response.status).toBe(200);
    });
  });
});
