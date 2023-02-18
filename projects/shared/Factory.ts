import ContextClass from '@rebel/shared/context/ContextClass'

type Constructor = new (...args: any[]) => any
type Type = Record<any, any>

/** A generic service class that provides a default implementation of instantiating a class. */
export default abstract class Factory<C extends Constructor | Type> extends ContextClass {
  private readonly class: Constructor | null

  constructor (classObject: C extends Constructor ? C : null) {
    super()
    this.class = classObject
  }

  public create (
    ...args: C extends Constructor
    ? ConstructorParameters<C> // class type
    : any[] // interface/object type
  ): (C extends Constructor
    ? InstanceType<C> // class type
    : C // interface/object type
  ) {
    if (this.class) {
      return new this.class(...args)
    } else {
      throw new Error("Interface/object factories must override the Factory's `create` method")
    }
  }
}
