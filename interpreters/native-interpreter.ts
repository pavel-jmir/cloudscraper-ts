import { JavaScriptInterpreter } from './index';

/**
 * Native JavaScript interpreter using built-in V8 engine
 */
export class NativeInterpreter implements JavaScriptInterpreter {
  /**
   * Solve a Cloudflare challenge
   * @param body Challenge page HTML
   * @param domain Domain of the website
   * @returns Solved challenge answer
   */
  public async solveChallenge(body: string, domain: string): Promise<string> {
    try {
      // Extract the challenge from the body
      const jsChallenge = this.extractChallenge(body);
      
      if (!jsChallenge) {
        throw new Error('Could not extract challenge from page');
      }
      
      // Prepare the JavaScript context
      const jsChallengeCode = this.prepareJavaScriptContext(jsChallenge, domain);
      
      // Execute the challenge in a safe context
      const answer = await this.executeJavaScript(jsChallengeCode);
      
      return answer;
    } catch (error) {
      throw new Error(`Failed to solve challenge: ${(error as Error).message}`);
    }
  }

  /**
   * Extract the challenge JavaScript from the page
   * @param body Challenge page HTML
   * @returns Challenge JavaScript code
   */
  private extractChallenge(body: string): string | null {
    try {
      // Find the challenge script
      const challengeRegex = /setTimeout\(function\(\){\s+(var s,t,o,p,b,r,e,a,k,i,n,g,f.+?\r?\n[\s\S]+?a\.value =.+?)\r?\n/i;
      const match = body.match(challengeRegex);
      
      if (!match) {
        return null;
      }
      
      return match[1];
    } catch (error) {
      console.error('Error extracting challenge:', error);
      return null;
    }
  }

  /**
   * Prepare the JavaScript context for execution
   * @param challenge Challenge JavaScript code
   * @param domain Domain of the website
   * @returns Full JavaScript code to execute
   */
  private prepareJavaScriptContext(challenge: string, domain: string): string {
    // Create a safe environment to execute the challenge
    let code = `
      // Mock browser environment
      var window = {};
      var document = {
        createElement: function() { 
          return { firstChild: { href: 'http://${domain}/' } }; 
        },
        getElementById: function() {
          return { value: '' };
        }
      };
      
      // Challenge code
      ${challenge}
      
      // Return the answer
      document.getElementById('jschl-answer').value;
    `;
    
    // Clean the code
    code = code.replace(/a\.value = (.+?) \+ .+?;/i, 'a.value = $1;');
    
    return code;
  }

  /**
   * Execute JavaScript code and return the result
   * @param code JavaScript code to execute
   * @returns Result of the execution
   */
  private async executeJavaScript(code: string): Promise<string> {
    try {
      // Create a safe Function
      const fn = new Function(code);
      
      // Execute the function in an isolated context
      const result = fn();
      
      return result ? result.toString() : '';
    } catch (error) {
      console.error('Error executing JavaScript:', error);
      throw error;
    }
  }
}
