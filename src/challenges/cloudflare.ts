import axios, { AxiosResponse } from 'axios';
import { URL } from 'url';
import { ChallengeResponse } from '../types';
import { JavaScriptInterpreterFactory } from '../interpreters';
import { CloudflareIUAMError, CloudflareSolveError, CloudflareCode1020, CloudflareChallengeError } from '../exceptions';

/**
 * Cloudflare v1 challenge handler
 */
export class Cloudflare {
  private scraper: any;

  /**
   * Create a new Cloudflare challenge handler
   * @param scraper The CloudScraper instance
   */
  constructor(scraper: any) {
    this.scraper = scraper;
  }

  /**
   * Unescape HTML entities
   * @param htmlText HTML text with entities
   * @returns Unescaped text
   */
  public static unescape(htmlText: string): string {
    return htmlText
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&amp;/g, '&');
  }

  /**
   * Check if the response contains a Cloudflare IUAM challenge
   * @param resp Response object
   * @returns Whether the response contains a challenge
   */
  public static isIUAMChallenge(resp: AxiosResponse): boolean {
    try {
      const responseData = typeof resp.data === 'string' ? resp.data : resp.data.toString();
      return (
        resp.headers['server']?.startsWith('cloudflare') &&
        [429, 503].includes(resp.status) &&
        !!responseData.match(/\/cdn-cgi\/images\/trace\/jsch\//) &&
        !!responseData.match(/<form .*?="challenge-form" action="\/\S+__cf_chl_f_tk=/)
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if the response contains a new Cloudflare IUAM challenge
   * @param resp Response object
   * @returns Whether the response contains a new challenge
   */
  public isNewIUAMChallenge(resp: AxiosResponse): boolean {
    try {
      return (
        Cloudflare.isIUAMChallenge(resp) &&
        !!resp.data.toString().match(/cpo\.src\s*=\s*['"]\/cdn-cgi\/challenge-platform\/\S+orchestrate\/jsch\/v1/)
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if the response contains a new Cloudflare captcha challenge
   * @param resp Response object
   * @returns Whether the response contains a new captcha challenge
   */
  public isNewCaptchaChallenge(resp: AxiosResponse): boolean {
    try {
      return (
        Cloudflare.isCaptchaChallenge(resp) &&
        !!resp.data.toString().match(/cpo\.src\s*=\s*['"]\/cdn-cgi\/challenge-platform\/\S+orchestrate\/(captcha|managed)\/v1/)
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if the response contains a Cloudflare captcha challenge
   * @param resp Response object
   * @returns Whether the response contains a captcha challenge
   */
  public static isCaptchaChallenge(resp: AxiosResponse): boolean {
    try {
      const responseData = typeof resp.data === 'string' ? resp.data : resp.data.toString();
      return (
        resp.headers['server']?.startsWith('cloudflare') &&
        resp.status === 403 &&
        !!responseData.match(/\/cdn-cgi\/images\/trace\/(captcha|managed)\//) &&
        !!responseData.match(/<form .*?="challenge-form" action="\/\S+__cf_chl_f_tk=/)
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if the response contains a Cloudflare 1020 error
   * @param resp Response object
   * @returns Whether the response contains a 1020 error
   */
  public static isFirewallBlocked(resp: AxiosResponse): boolean {
    try {
      const responseData = typeof resp.data === 'string' ? resp.data : resp.data.toString();
      return (
        resp.headers['server']?.startsWith('cloudflare') &&
        resp.status === 403 &&
        !!responseData.match(/<span class="cf-error-code">1020<\/span>/)
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if the response contains any Cloudflare challenge
   * @param resp Response object
   * @returns Whether the response contains a challenge
   */
  public isChallengeRequest(resp: AxiosResponse): boolean {
    if (Cloudflare.isFirewallBlocked(resp)) {
      throw new CloudflareCode1020('Cloudflare has blocked this request (Code 1020 Detected).');
    }

    if (this.isNewCaptchaChallenge(resp)) {
      throw new CloudflareChallengeError(
        'Detected a Cloudflare version 2 Captcha challenge, This feature is not available in the opensource (free) version.'
      );
    }

    if (this.isNewIUAMChallenge(resp)) {
      throw new CloudflareChallengeError(
        'Detected a Cloudflare version 2 challenge, This feature is not available in the opensource (free) version.'
      );
    }

    if (Cloudflare.isCaptchaChallenge(resp) || Cloudflare.isIUAMChallenge(resp)) {
      if (this.scraper.debug) {
        console.log('Detected a Cloudflare version 1 challenge.');
      }
      return true;
    }

    return false;
  }

  /**
   * Solve the IUAM challenge
   * @param body Challenge page HTML
   * @param url URL of the page
   * @param interpreter Interpreter name
   * @returns Challenge response data
   */
  public async iuamChallengeResponse(body: string, url: string, interpreter: string): Promise<ChallengeResponse> {
    try {
      // Extract form data from the challenge page
      // Create regex with 's' flag as a RegExp constructor to support TypeScript
      const formRegex = new RegExp(
        '<form (.*?="challenge-form" action="(.*?__cf_chl_f_tk=\\S+)"(.*?)</form>)',
        's'
      );
      const formMatch = body.match(formRegex);

      if (!formMatch || formMatch.length < 3) {
        throw new CloudflareIUAMError(
          "Cloudflare IUAM detected, unfortunately we can't extract the parameters correctly."
        );
      }

      const form = formMatch[1];
      const challengeUUID = formMatch[2];

      // Extract form input fields
      const payload: Record<string, string> = {};
      
      // Use standard regex without escaping backslashes in strings
      const inputRegex = /<input\s(.*?)\/?>|<input(.*?)>/g;
      let inputMatch;
      
      while ((inputMatch = inputRegex.exec(form)) !== null) {
        const input = inputMatch[1] || inputMatch[2];
        if (!input) continue;
        
        const nameMatch = input.match(/name="([^"]+)"/);
        const valueMatch = input.match(/value="([^"]+)"/);
        
        if (nameMatch && valueMatch && ['r', 'jschl_vc', 'pass'].includes(nameMatch[1])) {
          payload[nameMatch[1]] = valueMatch[1];
        }
      }

      // Parse the URL
      const parsedUrl = new URL(url);

      // Solve the JavaScript challenge
      try {
        const jsInterpreter = await JavaScriptInterpreterFactory.createInterpreter(interpreter);
        payload['jschl_answer'] = await jsInterpreter.solveChallenge(body, parsedUrl.hostname);
      } catch (error) {
        throw new CloudflareIUAMError(
          `Unable to parse Cloudflare anti-bots page: ${(error as Error).message}`
        );
      }

      // Return the challenge response
      return {
        url: `${parsedUrl.protocol}//${parsedUrl.hostname}${Cloudflare.unescape(challengeUUID)}`,
        data: payload
      };
    } catch (error) {
      if (error instanceof CloudflareIUAMError) {
        throw error;
      }
      throw new CloudflareIUAMError(`Failed to solve IUAM challenge: ${(error as Error).message}`);
    }
  }

  /**
   * Handle the challenge response
   * @param resp Response object
   * @param config Request configuration
   * @returns Response object
   */
  public async challengeResponse(resp: AxiosResponse, config: any = {}): Promise<AxiosResponse> {
    if (Cloudflare.isCaptchaChallenge(resp)) {
      // Double down on the request as some websites are only checking
      // if cfuid is populated before issuing Captcha
      if (this.scraper.doubleDown) {
        const method = resp.config?.method || 'GET';
        const url = resp.config?.url || '';
        const doubleDownResp = await this.scraper.request(method, url, config);
        
        if (!Cloudflare.isCaptchaChallenge(doubleDownResp)) {
          return doubleDownResp;
        }
      }

      // Check if captcha provider is configured
      if (!this.scraper.captcha || typeof this.scraper.captcha !== 'object' || !this.scraper.captcha.provider) {
        throw new Error(
          "Cloudflare Captcha detected, unfortunately you haven't loaded an anti Captcha provider "
          + "correctly via the 'captcha' parameter."
        );
      }

      // If provider is return_response, return the response without doing anything
      if (this.scraper.captcha.provider === 'return_response') {
        return resp;
      }

      // TODO: Implement captcha challenge handling
      throw new Error('Captcha challenge handling not implemented yet');
    } else {
      // Handle IUAM challenge
      
      // Apply delay if needed
      if (!this.scraper.delay) {
        try {
          const responseData = typeof resp.data === 'string' ? resp.data : resp.data.toString();
          const delayMatch = responseData.match(/submit\(\);\r?\n\s*},\s*([0-9]+)/);
          if (delayMatch && delayMatch[1]) {
            const delay = parseFloat(delayMatch[1]) / 1000;
            if (!isNaN(delay)) {
              this.scraper.delay = delay;
            }
          }
        } catch (error) {
          throw new CloudflareIUAMError(
            "Cloudflare IUAM possibility malformed, issue extracting delay value."
          );
        }
      }

      // Wait for the specified delay
      await new Promise(resolve => setTimeout(resolve, this.scraper.delay * 1000));

      // Solve the challenge
      const responseData = typeof resp.data === 'string' ? resp.data : resp.data.toString();
      const urlString = resp.config.url?.toString() || '';
      const submitUrl = await this.iuamChallengeResponse(
        responseData,
        urlString,
        this.scraper.interpreter
      );

      // Submit the challenge response
      if (submitUrl) {
        // Prepare the request
        const urlString = resp.config.url?.toString() || '';
        const parsedUrl = new URL(urlString);
        
        const challengeConfig = {
          ...config,
          method: 'POST',
          url: submitUrl.url,
          data: submitUrl.data,
          headers: {
            ...config.headers,
            'Origin': `${parsedUrl.protocol}//${parsedUrl.hostname}`,
            'Referer': resp.config.url
          },
          maxRedirects: 0,
          validateStatus: (status: number) => true
        };

        // Send the challenge response
        const challengeResponse = await this.scraper.request(
          'POST',
          submitUrl.url,
          challengeConfig
        );

        if (challengeResponse.status === 400) {
          throw new CloudflareSolveError(
            'Invalid challenge answer detected, Cloudflare broken?'
          );
        }

        // Handle redirect or direct response
        if (!challengeResponse.headers.location) {
          return challengeResponse;
        } else {
          // Handle redirect
          const redirectConfig = {
            ...config,
            headers: {
              ...config.headers,
              'Referer': challengeResponse.config.url
            }
          };

          // Build the redirect URL
          const redirectLocation = challengeResponse.headers.location.startsWith('http')
            ? challengeResponse.headers.location
            : new URL(challengeResponse.headers.location, submitUrl.url).toString();

          // Follow the redirect
          return await this.scraper.request(
            resp.config.method,
            redirectLocation,
            redirectConfig
          );
        }
      }

      // If we can't solve the challenge, re-request the original URL
      return await this.scraper.request(resp.config.method, resp.config.url, config);
    }
  }
}
