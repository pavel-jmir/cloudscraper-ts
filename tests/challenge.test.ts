import { CloudScraper } from '../src/main';
import * as fs from 'fs';
import * as path from 'path';

// Helper function to load HTML fixtures
function loadFixture(filename: string): string {
  const fixturePath = path.join(__dirname, 'fixtures', filename);
  return fs.readFileSync(fixturePath, 'utf8');
}

// Test various Cloudflare challenge scenarios
async function testChallenges() {
  // Create a CloudScraper instance for testing
  const scraper = new CloudScraper({
    browser: 'chrome',
    stealth: true,
    debug: true,
    challengesToSolve: 5
  });

  // Test functions for different challenge types
  async function testJsChallenge() {
    console.log('\n=== Testing JS Challenge ===');
    try {
      // We'll mock the response with a fixture
      const htmlContent = loadFixture('js_challenge_11_12_2019.html');
      
      // This would normally be a real response, but for test purposes
      // we're simulating the challenge detection and solving workflow
      const response = {
        config: { url: 'https://example.com' },
        status: 503,
        statusText: 'Service Unavailable',
        headers: {
          'server': 'cloudflare',
          'content-type': 'text/html'
        },
        data: htmlContent
      };
      
      const solved = await scraper.solveChallenge(response);
      
      console.log('JS Challenge Solution:', solved ? 'Success' : 'Failed');
      console.log('Challenge Data:', JSON.stringify(solved.data || {}, null, 2));
    } catch (error: any) {
      console.error('JS Challenge Error:', error.message);
    }
  }

  async function testCaptchaChallenge() {
    console.log('\n=== Testing CAPTCHA Challenge ===');
    try {
      // Load reCAPTCHA challenge HTML fixture
      const htmlContent = loadFixture('reCaptcha_challenge_12_12_2019.html');
      
      // Create a CloudScraper instance with CAPTCHA provider
      const captchaScraper = new CloudScraper({
        browser: 'chrome',
        stealth: true,
        captcha: {
          provider: '2captcha',
          apiKey: 'test_api_key',
          pollingInterval: 1000
        }
      });
      
      // Test solving the CAPTCHA challenge
      const response = {
        config: { url: 'https://example.com' },
        status: 403,
        statusText: 'Forbidden',
        headers: {
          'server': 'cloudflare',
          'content-type': 'text/html'
        },
        data: htmlContent
      };
      
      const solved = await captchaScraper.solveChallenge(response);
      
      console.log('CAPTCHA Challenge Solution:', solved ? 'Success' : 'Failed');
      console.log('Challenge Data:', JSON.stringify(solved.data || {}, null, 2));
    } catch (error: any) {
      console.error('CAPTCHA Challenge Error:', error.message);
    }
  }

  async function testTurnstileChallenge() {
    console.log('\n=== Testing Turnstile Challenge ===');
    try {
      // For a Turnstile challenge (when fixture is available)
      // This is a placeholder as turnstile fixture may not be available
      const htmlContent = `<html><body>
        <form id="challenge-form" action="/turnstile/verify" method="post">
          <script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script>
          <div class="cf-turnstile" data-sitekey="0x4AAAAAAAABCDEFGHIJKLMNOPQRSTUVWXYZ"></div>
          <input type="hidden" name="r" value="abc123">
          <noscript>Please enable JavaScript.</noscript>
        </form>
      </body></html>`;
      
      const turnstileScraper = new CloudScraper({
        browser: 'chrome',
        captcha: {
          provider: 'capsolver',
          apiKey: 'test_api_key'
        }
      });
      
      const response = {
        config: { url: 'https://example.com' },
        status: 403,
        statusText: 'Forbidden',
        headers: {
          'server': 'cloudflare',
          'content-type': 'text/html'
        },
        data: htmlContent
      };
      
      const solved = await turnstileScraper.solveChallenge(response);
      
      console.log('Turnstile Challenge Solution:', solved ? 'Success' : 'Failed');
      console.log('Challenge Data:', JSON.stringify(solved.data || {}, null, 2));
    } catch (error: any) {
      console.error('Turnstile Challenge Error:', error.message);
    }
  }

  // Run all challenge tests
  await testJsChallenge();
  await testCaptchaChallenge();
  await testTurnstileChallenge();
}

// Run integration tests with actual websites
async function runIntegrationTests() {
  console.log('\n===== Running Integration Tests =====');
  
  const scraper = new CloudScraper({
    browser: 'chrome',
    stealth: true,
    debug: true,
    timeout: 30000,  // Increase timeout for integration tests
    challengesToSolve: 3
  });

  try {
    // Try to access a site that may have Cloudflare protection
    // Note: Replace this with a known test site that uses Cloudflare
    const response = await scraper.get('https://example.org');
    
    console.log('Integration Test Status:', response.status);
    console.log('Integration Test Headers:', response.headers);
    console.log('Integration Test Success:', response.status >= 200 && response.status < 400);
    
    // Check for Cloudflare cookies
    const cookies = scraper.getCookies();
    console.log('Cloudflare Cookies Present:', 
      Object.keys(cookies).some(key => key.includes('cf_') || key.includes('__cf')));
      
  } catch (error: any) {
    console.error('Integration Test Error:', error.message);
  }
}

// Run the tests
async function runAllTests() {
  console.log('===== CloudScraper Challenge Tests =====');
  await testChallenges();
  
  console.log('\n===== CloudScraper Integration Tests =====');
  await runIntegrationTests();
}

// Execute all tests
runAllTests().then(() => console.log('\nAll tests completed'));
