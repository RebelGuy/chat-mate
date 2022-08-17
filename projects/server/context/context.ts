import ContextClass from '@rebel/server/context/ContextClass'
import Factory from '@rebel/server/factories/Factory'
import { Branded, GenericObject } from '@rebel/server/types'
import { reverse } from '@rebel/server/util/arrays'

// make sure we don't accidentally override non-context-related properties when assigning the context to an object
const CONTEXT_SYMBOL = Symbol('context')

export type Injectable = GenericObject

export enum _BuiltContextBrand { }
export type BuiltContext<TClasses, TObjects, TProperties> = Branded<ContextProvider<TClasses, TObjects, TProperties>, _BuiltContextBrand>

export class ContextProvider<TClasses extends StoredClass<any, any>, TObjects extends StoredObject<any, any>, TProperties extends StoredProperty<any, any>> {
  private readonly built: boolean
  private readonly builder: ServiceBuilder<TClasses, TObjects, TProperties>
  private isDisposed: boolean

  private constructor (baseBuilder: ServiceBuilder<TClasses, TObjects, TProperties> | null, built: boolean) {
    this.built = built
    this.builder = new ServiceBuilder(baseBuilder)
    this.isDisposed = false
  }

  public static create (): ContextProvider<GenericObject, GenericObject, GenericObject> {
    return new ContextProvider(null, false)
  }

  /** Use the current context as a parent context. Note that this will create a new context, leaving the old one unaffected.
   * Calling `initialise` or `dispose` will only be delegated the new partial context, not the parent. */
  public asParent (): this extends BuiltContext<TClasses, TObjects, TProperties> ? ContextProvider<TClasses, TObjects, TProperties> : never {
    // it is utterly amazing that this works!! (even with the any typing)
    if (this.isBuiltContext()) {
      return new ContextProvider(this.builder.isolateServices(), false) as this extends BuiltContext<TClasses, TObjects, TProperties> ? ContextProvider<TClasses, TObjects, TProperties> : never
    }
    throw new Error(`Cannot use this context as a parent because it hasn't been built yet`)
  }

  // add the given class to the context. note that its dependencies can only depend on classes
  // that are already part of the context (will throw otherwise).
  public withClass<Name extends UniqueName<Name, TClasses, TObjects, TProperties>, ClassType extends ContextClass> (name: Name, ctor: new (dep: Dependencies<TClasses & TObjects & TProperties>) => ClassType) {
    this.assertMutable()
    // todo: this should just extend the types, but not do any instantiation...
    return this.extendAndReturnMutableContext(() => this.builder.withClass(name, ctor))
  }

  // add the given helper class to the context. it should not have ANY dependencies
  public withHelpers<Name extends UniqueName<Name, TClasses, TObjects, TProperties>, HelperClassType extends ContextClass> (name: Name, ctor: new () => HelperClassType) {
    this.assertMutable()
    return this.extendAndReturnMutableContext(() => this.builder.withClass(name, ctor))
  }

  // add the given factory class to the context. it should not have ANY dependencies
  public withFactory<Name extends UniqueName<Name, TClasses, TObjects, TProperties>, FactoryClassType extends Factory<any>> (name: Name, ctor: new () => FactoryClassType) {
    this.assertMutable()
    return this.extendAndReturnMutableContext(() => this.builder.withClass(name, ctor))
  }

  public withObject<Name extends UniqueName<Name, TClasses, TObjects, TProperties>, T extends Injectable> (name: Name, object: T) {
    this.assertMutable()
    return this.extendAndReturnMutableContext(() => this.builder.withObject(name, object))
  }

  public withProperty<Name extends UniqueName<Name, TClasses, TObjects, TProperties>, T extends string | boolean | number | null> (name: Name, prop: T) {
    this.assertMutable()
    return this.extendAndReturnMutableContext(() => this.builder.withProperty(name, prop))
  }

  public build (): BuiltContext<TClasses, TObjects, TProperties> {
    return new ContextProvider(this.builder, true) as any as BuiltContext<TClasses, TObjects, TProperties>
  }

  public isBuiltContext (): this is BuiltContext<TClasses, TObjects, TProperties> {
    return this.built
  }

  // retrieve the instance of the given class.
  // throws if the class is not instantiated
  // tslint:disable-next-line:ban-types
  public getClassInstance<ClassName extends keyof TClasses & string> (name: ClassName): TClasses[ClassName] {
    if (this.isDisposed) {
      throw new Error('Cannot use the context because it has been disposed')
    }
    return this.builder.getDependencies().resolve(name)
  }

  /** Calls and awaits the `initialise` method of all dependencies that implement it, in forward order, one by one. */
  public async initialise () {
    if (this.isBuiltContext()) {
      await this.builder.initialise()
      await this.builder.notifyReady()
    } else {
      throw new Error(`Cannot initialise a context that hasn't been built yet`)
    }
  }

  /** Calls and awaits the `dispose` method of all dependencies that implement it, in reverse order, one by one. */
  public async dispose () {
    if (this.isBuiltContext()) {
      await this.builder.dispose()
      this.isDisposed = true
    } else {
      throw new Error(`Cannot dispose a context that hasn't been built yet`)
    }
  }

  private assertMutable () {
    if (this.built) {
      throw new Error('Cannot change a context once it has been built')
    }
  }

  private extendAndReturnMutableContext<TNewClasses, TNewObjects, TNewProperties> (extender: () => ServiceBuilder<TNewClasses, TNewObjects, TNewProperties>)
    : this extends BuiltContext<TNewClasses, TNewObjects, TNewProperties> ? never : ContextProvider<TNewClasses, TNewObjects, TNewProperties> {
    if (this.isBuiltContext()) {
      throw new Error('This should not happen')
    } else {
      return new ContextProvider(extender(), false) as this extends BuiltContext<TNewClasses, TNewObjects, TNewProperties> ? never : ContextProvider<TNewClasses, TNewObjects, TNewProperties>
    }
  }
}

type DepName = string
type StoredClass<Name extends DepName, ClassType extends ContextClass> = { [key in Name]: ClassType }
type StoredObject<Name extends DepName, Obj extends Injectable> = { [key in Name]: Obj }
type StoredProperty<Name extends DepName, Prop extends string | boolean | number | null> = { [key in Name]: Prop }

// returns `never` if the given name is not unique
type UniqueName<Name, SC extends StoredClass<any, any>, SO extends StoredObject<any, any>, SP extends StoredProperty<any, any>> =  SC[Name] extends never ? SO[Name] extends never ? SP[Name] extends never ? DepName : never : never : never

// every service class is expected to have a constructor that takes one argument of this type.
export class Dependencies<T extends StoredClass<any, any> | StoredObject<any, any> | StoredProperty<any, any>> {
  readonly dependencies: T

  constructor (dependencies: T) {
    this.dependencies = dependencies
  }

  // throws if the name doesn't exist. For classes, use the `class.name` API
  public resolve<Name extends keyof T & DepName> (name: Name): T[Name] {
    if (!Object.keys(this.dependencies).includes(name)) {
      throw new Error(`Could not resolve dependency '${name}'`)
    }

    return this.dependencies[name]
  }
}

// add the given context provider to the request
export function setContextProvider<TClasses extends StoredClass<any, any>, TObjects extends StoredClass<any, any>, TProperties extends StoredClass<any, any>> (req: Express.Request, context: BuiltContext<TClasses, TObjects, TProperties>) {
  if (Object.getOwnPropertySymbols(req).includes(CONTEXT_SYMBOL)) {
    throw new Error('A context has already been set on the Request object')
  }

  Object.defineProperty(req, CONTEXT_SYMBOL, { value: context, writable: false })
  return req
}

// retrieve the context provider with the given name from the request. throws if it doesn't exist
export function getContextProvider<C extends BuiltContext<any, any, any>> (req: Express.Request): C {
  if (!Object.getOwnPropertySymbols(req).includes(CONTEXT_SYMBOL)) {
    throw new Error('A context could not be found on the Request object')
  }

  return (req as any)[CONTEXT_SYMBOL] as C
}

// used internally for connecting classes
class ServiceBuilder<TClasses extends StoredClass<any, any>, TObjects extends StoredObject<any, any>, TProperties extends StoredProperty<any, any>> {
  private dependencies: TClasses & TObjects & TProperties
  private contextClassOrder: (keyof TClasses)[]

  constructor (baseBuilder: ServiceBuilder<TClasses, TObjects, TProperties> | null) {
    this.contextClassOrder = baseBuilder?.contextClassOrder ?? []
    this.dependencies = baseBuilder?.dependencies ?? {} as TClasses & TObjects & TProperties
  }

  public isolateServices () {
    const isolated = new ServiceBuilder(this)
    isolated.contextClassOrder = []
    return isolated
  }

  // instantiate the class using the current dependencies and add the new instance to the dependencies
  public withClass<Name extends DepName, ClassType extends ContextClass> (name: Name, ctor: new (dep: Dependencies<TClasses & TObjects & TProperties>) => ClassType)
    : ServiceBuilder<TClasses & StoredClass<Name, ClassType>, TObjects, TProperties>
  {
    this.assertUniqueDependency(name)

    const newStoredClass = {
      [name]: new ctor(this.getDependencies())
    } as StoredClass<Name, ClassType>

    this.dependencies = {
      ...this.dependencies,
      ...newStoredClass
    }
    this.contextClassOrder.push(name)

    return this
  }

  public withObject<Name extends DepName, ObjType extends Injectable> (name: Name, object: ObjType)
    : ServiceBuilder<TClasses, TObjects & StoredObject<Name, ObjType>, TProperties> {
    this.assertUniqueDependency(name)

    const newStoredObj = {
      [name]: object
    } as StoredObject<Name, ObjType>

    this.dependencies = {
      ...this.dependencies,
      ...newStoredObj
    }

    return this
  }

  public withProperty<Name extends DepName, PropType extends string | number | boolean | null> (name: Name, prop: PropType)
    : ServiceBuilder<TClasses, TObjects, TProperties & StoredProperty<Name, PropType>> {
    this.assertUniqueDependency(name)

    const newStoredProp = {
      [name]: prop
    } as StoredProperty<Name, PropType>

    this.dependencies = {
      ...this.dependencies,
      ...newStoredProp
    }

    return this
  }

  public getDependencies (): Dependencies<TClasses & TObjects & TProperties> {
    return new Dependencies(this.dependencies)
  }

  public async initialise () {
    for (const className of this.contextClassOrder) {
      await (this.dependencies[className] as ContextClass).initialise()
    }
  }

  public async notifyReady () {
    for (const className of this.contextClassOrder) {
      await (this.dependencies[className] as ContextClass).onReady()
    }
  }

  public async dispose () {
    for (const className of reverse(this.contextClassOrder)) {
      await (this.dependencies[className] as ContextClass).dispose()
      Object.defineProperty(this.dependencies, className, { value: null, writable: false })
    }
  }

  private assertUniqueDependency (name: DepName) {
    if (Object.keys(this.dependencies).includes(name)) {
      throw new Error(`Cannot add dependency with name ${name} because it already exists`)
    }
  }
}
