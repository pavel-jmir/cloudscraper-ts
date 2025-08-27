/**
 * Exceptions for the CloudScraper library
 */

/**
 * Base error class for CloudScraper
 */
export class CloudScraperError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CloudScraperError';
    Object.setPrototypeOf(this, CloudScraperError.prototype);
  }
}

/**
 * Error when CloudScraper gets stuck in a loop
 */
export class CloudflareLoopProtection extends CloudScraperError {
  constructor(message: string) {
    super(message);
    this.name = 'CloudflareLoopProtection';
    Object.setPrototypeOf(this, CloudflareLoopProtection.prototype);
  }
}

/**
 * Error when CloudScraper fails to solve the IUAM challenge
 */
export class CloudflareIUAMError extends CloudScraperError {
  constructor(message: string) {
    super(message);
    this.name = 'CloudflareIUAMError';
    Object.setPrototypeOf(this, CloudflareIUAMError.prototype);
  }
}

/**
 * Error when CloudScraper fails to solve a challenge
 */
export class CloudflareSolveError extends CloudScraperError {
  constructor(message: string) {
    super(message);
    this.name = 'CloudflareSolveError';
    Object.setPrototypeOf(this, CloudflareSolveError.prototype);
  }
}

/**
 * Error when CloudScraper encounters a Cloudflare challenge it can't handle
 */
export class CloudflareChallengeError extends CloudScraperError {
  constructor(message: string) {
    super(message);
    this.name = 'CloudflareChallengeError';
    Object.setPrototypeOf(this, CloudflareChallengeError.prototype);
  }
}

/**
 * Error when CloudScraper fails to solve a captcha
 */
export class CloudflareCaptchaError extends CloudScraperError {
  constructor(message: string) {
    super(message);
    this.name = 'CloudflareCaptchaError';
    Object.setPrototypeOf(this, CloudflareCaptchaError.prototype);
  }
}

/**
 * Error when CloudScraper doesn't have a captcha provider
 */
export class CloudflareCaptchaProvider extends CloudScraperError {
  constructor(message: string) {
    super(message);
    this.name = 'CloudflareCaptchaProvider';
    Object.setPrototypeOf(this, CloudflareCaptchaProvider.prototype);
  }
}

/**
 * Error when CloudScraper encounters a Cloudflare 1020 error
 */
export class CloudflareCode1020 extends CloudScraperError {
  constructor(message: string) {
    super(message);
    this.name = 'CloudflareCode1020';
    Object.setPrototypeOf(this, CloudflareCode1020.prototype);
  }
}

/**
 * Error when CloudScraper encounters a Turnstile challenge it can't handle
 */
export class CloudflareTurnstileError extends CloudScraperError {
  constructor(message: string) {
    super(message);
    this.name = 'CloudflareTurnstileError';
    Object.setPrototypeOf(this, CloudflareTurnstileError.prototype);
  }
}

/**
 * Error when CloudScraper fails to handle a v3 challenge
 */
export class CloudflareV3Error extends CloudScraperError {
  constructor(message: string) {
    super(message);
    this.name = 'CloudflareV3Error';
    Object.setPrototypeOf(this, CloudflareV3Error.prototype);
  }
}

/**
 * General Cloudflare error for compatibility with tests
 */
export class CloudflareError extends CloudScraperError {
  constructor(message: string) {
    super(message);
    this.name = 'CloudflareError';
    Object.setPrototypeOf(this, CloudflareError.prototype);
  }
}
