import ContextClass from '@rebel/server/context/ContextClass'

/** A generic service class that provides a default implementation of instantiating a class. */
export default abstract class Factory<C extends new (...args: any[]) => any> extends ContextClass {
  private readonly class: C

  constructor (classObject: C) {
    super()
    this.class = classObject
  }

  public create (...args: ConstructorParameters<C>): InstanceType<C> {
    return new this.class(...args)
  }
}
