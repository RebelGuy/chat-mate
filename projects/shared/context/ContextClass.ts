import { NonDisposableClassError } from '@rebel/shared/util/error'

/** Contains virtual methods that will be called by the context provider. */
export default abstract class ContextClass {
  /** Called and awaited in order after the current context (without parent) has been instantiated. */
  public initialise (): Promise<void> | void { /* do nothing by default */ }

  /** Called and awaited in order after all `initialise()` methods have been called. */
  public onReady (): Promise<void> | void { /* do nothing by default */ }

  /** Called and await in reverse order when the current context (without parent) is to be disposed. */
  public dispose (): Promise<void> | void { /* do nothing by default */ }
}

/** If your context class requires state or manages system-critcal operations that must be ongoing and single-threaded, implement this class to reduce unintentional bugs in the future. */
export abstract class SingletonContextClass extends ContextClass {
  public override dispose (): void | Promise<void> {
    throw new NonDisposableClassError()
  }
}
