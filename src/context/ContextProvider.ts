// make sure we don't accidentally override non-context-related properties when assigning the context to an object
const CONTEXT_SYMBOL = Symbol('context')

export class ContextProvider {
  public readonly name: string
  private builder: ServiceBuilder<any>

  constructor (name: string = 'context') {
    this.name = name
    this.builder = new ServiceBuilder({})
  }

  // add the given class to the context. note that its dependencies can only depend on classes
  // that are already part of the context (will throw otherwise).
  public withClass<Ctor extends new (dep: any) => any> (classObject: Ctor) {
    // todo: this should just extend the types, but not do any instantiation...
    this.builder = this.builder.withClass(classObject)
    return this
  }

  // todo: there should then be a buildClasses method which does all of the instantiation

  // retrieve the instance of the given class name (use the `Class.name` API to get a class' name).
  // throws if the class is not instantiated
  public getInstance<C = any> (serviceClass: Function): C {
    return this.builder.getDependencies().getInstance<C>(serviceClass.name)
  }
}

// every service class is expected to have a constructor that takes one argument of this type.
export class Dependencies {
  readonly dependencies

  constructor (dependencies: any) {
    this.dependencies = dependencies
  }

  // throws if the class is not instantiated
  public getInstance<C = any> (name: string): C {
    const instance = this.dependencies[name]
    if (instance == null) {
      throw new Error(`Could not resolve dependency for ${name}`)
    }
    return instance
  }
}

// add the given context provider to the request
export function setContextProvider (req: Express.Request, context: ContextProvider) {
  const contextObj = (req as any)[CONTEXT_SYMBOL]
  if (contextObj == null) {
    (req as any)[CONTEXT_SYMBOL] = { }
  }

  (req as any)[CONTEXT_SYMBOL][context.name] = context
}

// retrieve the context provider with the given name from the request. throws if it doesn't exist
export function getContextProvider (req: Express.Request, name: string = 'context'): ContextProvider {
  const context = (req as any)[CONTEXT_SYMBOL]?.context ?? null as ContextProvider | null
  if (context == null) {
    throw new Error(`Context '${name}' could not be found on the request`)
  }

  return context
}

// used internally for connecting classes
class ServiceBuilder<D> {
  readonly dependencies: D

  constructor (dependencies: D) {
    this.dependencies = dependencies
  }

  // instantiate the class using the current dependencies and add the new instance to the dependencies
  public withClass<Ctor extends new (dep: Dependencies) => any> (classObject: Ctor) {
    const newDependencies = {
      ...this.dependencies,
      [classObject.name]: new classObject (this.getDependencies())
    }
    return new ServiceBuilder(newDependencies)
  }

  public getDependencies (): Dependencies {
    return new Dependencies(this.dependencies)
  }
}
