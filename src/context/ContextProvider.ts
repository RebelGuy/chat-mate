// make sure we don't accidentally override non-context-related properties when assigning the context to an object
const CONTEXT_SYMBOL = Symbol('context')
const NAME_SYMBOL = Symbol('propertyName')

export type Injectable = {}

type NamedInjectable<T extends Injectable> = T & { readonly [NAME_SYMBOL]: string }

// note that the original object is not modified, but a new object is constructed.
function nameInjectable<T extends Injectable> (obj: T, name: string) {
  if (isNamedInjectable(obj)) {
    throw new Error(`Injectable of type ${typeof obj} cannot be named '${name}' because it already has the name '${getName(obj)}'`)
  }

  const copy = { ...obj }
  Object.defineProperty(copy, NAME_SYMBOL, { value: name, writable: false })
  return copy as NamedInjectable<T>
}

function getName<T extends Injectable> (obj: NamedInjectable<T>): string {
  return obj[NAME_SYMBOL]
}

function isNamedInjectable<T extends Injectable> (maybeNamed: T | NamedInjectable<T>): maybeNamed is NamedInjectable<T> {
  return Object.getOwnPropertySymbols(maybeNamed).includes(NAME_SYMBOL)
}

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

  public withObject<T extends Injectable> (name: string, object: T) {
    this.builder = this.builder.withObject(nameInjectable(object, name))
    return this
  }

  public withProperty<T extends string | boolean | number> (name: string, prop: T) {
    this.builder = this.builder.withProperty(name, prop)
    return this
  }

  // todo: there should then be a buildClasses method which does all of the instantiation

  // retrieve the instance of the given class name (use the `Class.name` API to get a class' name).
  // throws if the class is not instantiated
  public getInstance<C = any> (serviceClass: Function): C {
    return this.builder.getDependencies().resolve<C>(serviceClass.name)
  }
}

// every service class is expected to have a constructor that takes one argument of this type.
export class Dependencies {
  readonly dependencies

  constructor (dependencies: any) {
    this.dependencies = dependencies
  }

  // throws if the name doesn't exist
  public resolve<C = any> (name: string): C {
    if (!Object.keys(this.dependencies).includes(name)) {
      throw new Error(`Could not resolve dependency '${name}''`)
    }

    return this.dependencies[name]
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
    const instance = new classObject(this.getDependencies())
    const newDependencies = this.extendDependencies(classObject.name, instance)
    return new ServiceBuilder(newDependencies)
  }

  public withObject<T extends Injectable> (object: NamedInjectable<T>) {
    // i'm wondering why didn't we just pass in the name into this function?
    const newDependencies = this.extendDependencies(getName(object), object)
    return new ServiceBuilder(newDependencies)
  }

  public withProperty<T extends string | number | boolean> (name: string, prop: T) {
    const newDependencies = this.extendDependencies(name, prop)
    return new ServiceBuilder(newDependencies)
  }

  public getDependencies (): Dependencies {
    return new Dependencies(this.dependencies)
  }

  private extendDependencies (name: string, value: any) {
    if (Object.keys(this.dependencies).includes(name)) {
      throw new Error(`Cannot add dependency with name ${name} because it already exists`)
    }

    return {
      ...this.dependencies,
      [name]: value
    }
  }
}
