/** Contains virtual methods that will be called by the context provider. */
export default abstract class ContextClass {
  /** Called and awaited in order after the current context (without parent) has been instantiated. */
  public initialise (): Promise<void> | void { /* do nothing by default */ }

  /** Called and awaited in order after all `initialise()` methods have been called. */
  public onReady (): Promise<void> | void { /* do nothing by default */ }

  /** Called and await in reverse order when the current context (without parent) is to be disposed. */
  public dispose (): Promise<void> | void { /* do nothing by default */ }
}
