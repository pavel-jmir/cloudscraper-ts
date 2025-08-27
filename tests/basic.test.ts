import { CloudScraper, create } from '../src/main';

// Example 1: Using the default CloudScraper instance
async function testDefault() {
  try {
    // Basic usage with defaults
    const response = await create().get('https://example.com');
    console.log('Default Request Status:', response.status);
    console.log('Default Response Headers:', response.headers);
    console.log('Default Response Body Length:', response.data.length);
  } catch (error: any) {
    console.error('Default Request Error:', error.message);
  }
}

// Example 2: Using a custom CloudScraper instance
async function testCustom() {
  try {
    // Create a custom instance with options
    const scraper = new CloudScraper({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      browser: 'chrome',
      cookies: {
        sessionCookie: 'value'
      },
      challengesToSolve: 3,
      delay: 5000,
      proxy: {
        host: 'proxy.example.com',
        port: 8080,
        auth: {
          username: 'user',
          password: 'pass'
        }
      },
      stealth: true
    });

    // Make a request with custom headers
    const response = await scraper.get('https://example.com', {
      headers: {
        'Custom-Header': 'Custom-Value'
      }
    });

    console.log('Custom Request Status:', response.status);
    console.log('Custom Response Headers:', response.headers);
    console.log('Custom Response Body Length:', response.data.length);
  } catch (error: any) {
    console.error('Custom Request Error:', error.message);
  }
}

// Example 3: Using proxy rotation
async function testProxyRotation() {
  try {
    const proxies = [
      { host: 'proxy1.example.com', port: 8080 },
      { host: 'proxy2.example.com', port: 8080 },
      { host: 'proxy3.example.com', port: 8080 }
    ];

    const scraper = new CloudScraper({
      proxies: proxies,
      proxyRotation: 'round-robin'
    });

    // Make multiple requests to see proxy rotation
    for (let i = 0; i < 5; i++) {
      const response = await scraper.get(`https://example.com?request=${i}`);
      console.log(`Request ${i} Status:`, response.status);
      console.log(`Request ${i} Proxy:`, scraper.getCurrentProxy());
    }
  } catch (error: any) {
    console.error('Proxy Rotation Error:', error.message);
  }
}

// Example 4: Handling captchas
async function testCaptcha() {
  try {
    const scraper = new CloudScraper({
      captcha: {
        provider: '2captcha',
        apiKey: 'your-2captcha-api-key',
        pollingInterval: 5000
      }
    });

    const response = await scraper.get('https://example.com/with-captcha');
    console.log('Captcha Request Status:', response.status);
  } catch (error: any) {
    console.error('Captcha Request Error:', error.message);
  }
}

// Run all tests
async function runTests() {
  console.log('===== Testing Default CloudScraper =====');
  await testDefault();
  
  console.log('\n===== Testing Custom CloudScraper =====');
  await testCustom();
  
  console.log('\n===== Testing Proxy Rotation =====');
  await testProxyRotation();
  
  console.log('\n===== Testing Captcha Handling =====');
  await testCaptcha();
}

runTests().then(() => console.log('All tests completed'));
