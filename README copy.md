# cloudscraper-ts

A TypeScript port of the [cloudscraper](https://github.com/VeNoMouS/cloudscraper) Python library for bypassing Cloudflare's anti-bot page (I'm Under Attack Mode, or IUAM).

## Features

- Bypass Cloudflare's anti-bot page automatically
- Support for multiple Cloudflare challenge types:
  - v1 JavaScript challenges
  - v2 JavaScript challenges
  - v3 JavaScript VM challenges
  - Turnstile challenges
- Captcha solving support via third-party services
- Stealth mode to avoid detection
- Proxy rotation capability
- Browser emulation
- Session health monitoring
- TLS customization

## Installation

```bash
npm install cloudscraper-ts
```

## Basic Usage

```typescript
import { createScraper } from 'cloudscraper-ts';

async function main() {
  const scraper = createScraper();
  
  try {
    const response = await scraper.get('https://example.com');
    console.log(response.data);
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
```

## Advanced Usage

### With Custom Options

```typescript
import { createScraper } from 'cloudscraper-ts';

async function main() {
  const scraper = createScraper({
    browser: {
      browser: 'chrome',
      platform: 'windows',
      mobile: false
    },
    enableStealth: true,
    stealthOptions: {
      minDelay: 2.0,
      maxDelay: 6.0,
      humanLikeDelays: true,
      randomizeHeaders: true,
      browserQuirks: true
    },
    debug: true
  });
  
  try {
    const response = await scraper.get('https://example.com');
    console.log(response.data);
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
```

### With Proxy Rotation

```typescript
import { createScraper } from 'cloudscraper-ts';

async function main() {
  const proxies = [
    'http://user:pass@proxy1.example.com:8080',
    'http://user:pass@proxy2.example.com:8080',
    'http://user:pass@proxy3.example.com:8080'
  ];
  
  const scraper = createScraper({
    rotatingProxies: proxies,
    proxyOptions: {
      rotationStrategy: 'smart',
      banTime: 300
    }
  });
  
  try {
    const response = await scraper.get('https://example.com');
    console.log(response.data);
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
```

### With CAPTCHA Solving

```typescript
import { createScraper } from 'cloudscraper-ts';

async function main() {
  const scraper = createScraper({
    captcha: {
      provider: '2captcha',
      apiKey: 'your_2captcha_api_key'
    }
  });
  
  try {
    const response = await scraper.get('https://example.com');
    console.log(response.data);
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
```

## API Reference

### `createScraper(options?)`

Creates a new CloudScraper instance with the specified options.

#### Options

- `browser`: Browser emulation settings
  - `browser`: 'chrome' | 'firefox'
  - `platform`: 'windows' | 'mac' | 'linux' | 'android' | 'ios'
  - `mobile`: boolean
  - `custom`: string (custom user agent)
- `rotatingProxies`: Array of proxy URLs
- `proxyOptions`: Proxy configuration
  - `rotationStrategy`: 'sequential' | 'random' | 'smart'
  - `banTime`: number (seconds)
- `enableStealth`: boolean (default: true)
- `stealthOptions`: Stealth mode configuration
  - `minDelay`: number
  - `maxDelay`: number
  - `humanLikeDelays`: boolean
  - `randomizeHeaders`: boolean
  - `browserQuirks`: boolean
- `captcha`: CAPTCHA solving configuration
  - `provider`: string
  - `apiKey`: string
- `debug`: boolean (default: false)
- `delay`: number (delay for challenge solving)
- `disableCloudflareV1`: boolean (default: false)
- `disableCloudflareV2`: boolean (default: false)
- `disableCloudflareV3`: boolean (default: false)
- `disableTurnstile`: boolean (default: false)
- `sessionRefreshInterval`: number (seconds)
- `autoRefreshOn403`: boolean (default: true)
- `max403Retries`: number (default: 3)

### Methods

The CloudScraper instance provides the same API as Axios:

- `get(url, config?)`
- `post(url, data?, config?)`
- `put(url, data?, config?)`
- `delete(url, config?)`
- `head(url, config?)`
- `options(url, config?)`
- `patch(url, data?, config?)`

### Utility Functions

- `getTokens(url, options?)`: Gets Cloudflare tokens for a URL
- `getCookieString(url, options?)`: Gets Cloudflare cookies as a string

## License

MIT
