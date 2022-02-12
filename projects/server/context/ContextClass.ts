/** Contains virtual methods that will be called by the context provider. */
export default abstract class ContextClass {
  public initialise (): Promise<void> | void { /* do nothing by default */ }

  public dispose (): Promise<void> | void { /* do nothing by default */ }
}
