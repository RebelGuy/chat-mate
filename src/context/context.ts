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

export type Branded<T, BrandingEnum> = T & { brand: BrandingEnum }

export enum _BuiltContextBrand { }
export type BuiltContext = Branded<ContextProvider, _BuiltContextBrand>

export class ContextProvider {
  private built: boolean
  private builder: ServiceBuilder<any>

  constructor (baseDependencies: any) {
    this.built = false
    this.builder = new ServiceBuilder(baseDependencies)
  }

  public static create (): ContextProvider {
    return new ContextProvider({})
  }

  // use the current context as a parent content. note that this will create a
  // new context, leaving the old one unaffected.
  public asParent (): this extends BuiltContext ? ContextProvider : never {
    // it is utterly amazing that this works!! (even with the any typing)
    if (this.isBuiltContext()) {
      return new ContextProvider(this.builder.clone().dependencies) as any
    }
    throw new Error(`Cannot use this context as a parent because it hasn't been built yet`)
  }

  // add the given class to the context. note that its dependencies can only depend on classes
  // that are already part of the context (will throw otherwise).
  public withClass<Ctor extends new (dep: any) => any> (classObject: Ctor): this extends BuiltContext ? never : ContextProvider {
    // todo: this should just extend the types, but not do any instantiation...
    this.builder = this.builder.withClass(classObject)
    return this.returnMutableContext()
  }

  public withObject<T extends Injectable> (name: string, object: T): this extends BuiltContext ? never : ContextProvider {
    this.assertMutable()
    this.builder = this.builder.withObject(nameInjectable(object, name))
    return this.returnMutableContext()
  }

  public withProperty<T extends string | boolean | number | null> (name: string, prop: T): this extends BuiltContext ? never : ContextProvider {
    this.assertMutable()
    this.builder = this.builder.withProperty(name, prop)
    return this.returnMutableContext()
  }

  public build (): BuiltContext {
    this.built = true
    return this as any as BuiltContext
  }

  public isBuiltContext (): this is BuiltContext {
    return this.built
  }

  // retrieve the instance of the given class.
  // throws if the class is not instantiated
  // tslint:disable-next-line:ban-types
  public getInstance<C = any> (serviceClass: Function): C {
    return this.builder.getDependencies().resolve<C>(serviceClass.name)
  }

  private assertMutable () {
    if (this.built) {
      throw new Error('Cannot change a context once it has been built')
    }
  }

  private returnMutableContext (): this extends BuiltContext ? never : ContextProvider {
    if (this.isBuiltContext()) {
      throw new Error('This should not happen')
    } else {
      return this as any
    }
  }
}

// every service class is expected to have a constructor that takes one argument of this type.
export class Dependencies {
  readonly dependencies

  constructor (dependencies: any) {
    this.dependencies = dependencies
  }

  // throws if the name doesn't exist. For classes, use the `class.name` API
  public resolve<C = any> (name: string): C {
    if (!Object.keys(this.dependencies).includes(name)) {
      throw new Error(`Could not resolve dependency '${name}'`)
    }

    return this.dependencies[name]
  }
}

// add the given context provider to the request
export function setContextProvider (req: Express.Request, context: BuiltContext) {
  if (Object.getOwnPropertySymbols(req).includes(CONTEXT_SYMBOL)) {
    throw new Error('A context has already been set on the Request object')
  }

  Object.defineProperty(req, CONTEXT_SYMBOL, { value: context, writable: false })
  return req
}

// retrieve the context provider with the given name from the request. throws if it doesn't exist
export function getContextProvider (req: Express.Request): BuiltContext {
  if (!Object.getOwnPropertySymbols(req).includes(CONTEXT_SYMBOL)) {
    throw new Error('A context could not be found on the Request object')
  }

  return (req as any)[CONTEXT_SYMBOL] as BuiltContext
}

// used internally for connecting classes
class ServiceBuilder<D> {
  public readonly dependencies: D

  constructor (dependencies: D) {
    this.dependencies = dependencies
  }

  public clone () {
    return new ServiceBuilder(this.dependencies)
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

  public withProperty<T extends string | number | boolean | null> (name: string, prop: T) {
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
