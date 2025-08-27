/**
 * JavaScript interpreter interface
 */
export interface JavaScriptInterpreter {
  solveChallenge(body: string, domain: string): Promise<string>;
}

/**
 * Factory for creating JavaScript interpreters
 */
export class JavaScriptInterpreterFactory {
  /**
   * Create a JavaScript interpreter
   * @param interpreterName Name of the interpreter to create
   * @returns JavaScript interpreter
   */
  public static async createInterpreter(interpreterName: string = 'native'): Promise<JavaScriptInterpreter> {
    switch (interpreterName.toLowerCase()) {
      case 'js2py':
        return await import('./js2py-interpreter').then(m => new m.Js2PyInterpreter());
      case 'nodejs':
        return await import('./nodejs-interpreter').then(m => new m.NodeJsInterpreter());
      case 'v8':
        return await import('./v8-interpreter').then(m => new m.V8Interpreter());
      case 'chakracore':
        return await import('./chakracore-interpreter').then(m => new m.ChakraCoreInterpreter());
      case 'native':
      default:
        return await import('./native-interpreter').then(m => new m.NativeInterpreter());
    }
  }
}
