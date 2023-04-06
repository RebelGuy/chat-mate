import ContextClass from '@rebel/shared/context/ContextClass'
import Factory from '@rebel/shared/Factory'
import { Branded, GenericObject, Primitive } from '@rebel/shared/types'
import { reverse } from '@rebel/shared/util/arrays'
import { assertUnreachable } from '@rebel/shared/util/typescript'

// make sure we don't accidentally override non-context-related properties when assigning the context to an object
const CONTEXT_SYMBOL = Symbol('context')

export type Injectable = GenericObject

type VariableResult = Injectable | Primitive | null

export enum _BuiltContextBrand { }
export type BuiltContext<TClasses extends StoredClass<any, any>, TObjects extends StoredObject<any, any>, TProperties extends StoredProperty<any, any>, TVariables extends StoredVariable<any, any>> = Branded<ContextProvider<TClasses, TObjects, TProperties, TVariables>, _BuiltContextBrand>

export type ErrorHandler = (erroredClass: ContextClass, stage: 'initialise' | 'onReady' | 'dispose', e: any) => 'ignore' | 'retry' | 'abort'

export class ContextProvider<TClasses extends StoredClass<any, any>, TObjects extends StoredObject<any, any>, TProperties extends StoredProperty<any, any>, TVariables extends StoredVariable<any, any>> {
  private readonly built: boolean
  private readonly builder: ServiceBuilder<TClasses, TObjects, TProperties, TVariables>
  private isDisposed: boolean

  private constructor (baseBuilder: ServiceBuilder<TClasses, TObjects, TProperties, TVariables> | null, built: boolean) {
    this.built = built
    this.builder = new ServiceBuilder(baseBuilder)
    this.isDisposed = false
  }

  public static create (): ContextProvider<GenericObject, GenericObject, GenericObject, GenericObject> {
    return new ContextProvider(null, false)
  }

  /** Use the current context as a parent context. Note that this will create a new context, leaving the old one unaffected.
   * Calling `initialise` or `dispose` will only be delegated the new partial context, not the parent. */
  public asParent (): this extends BuiltContext<TClasses, TObjects, TProperties, TVariables> ? ContextProvider<TClasses, TObjects, TProperties, TVariables> : never {
    // it is utterly amazing that this works!! (even with the any typing)
    if (this.isBuiltContext()) {
      return new ContextProvider(this.builder.isolateServices(), false) as this extends BuiltContext<TClasses, TObjects, TProperties, TVariables> ? ContextProvider<TClasses, TObjects, TProperties, TVariables> : never
    }
    throw new Error(`Cannot use this context as a parent because it hasn't been built yet`)
  }

  // add the given class to the context. note that its dependencies can only depend on classes
  // that are already part of the context (will throw otherwise).
  public withClass<Name extends UniqueName<Name, TClasses, TObjects, TProperties, TVariables>, ClassType extends ContextClass> (name: Name, ctor: new (dep: Dependencies<TClasses & TObjects & TProperties & TVariables>) => ClassType) {
    this.assertMutable()
    // todo: this should just extend the types, but not do any instantiation...
    return this.extendAndReturnMutableContext(() => this.builder.withClass(name, ctor))
  }

  // add the given helper class to the context. it should not have ANY dependencies
  public withHelpers<Name extends UniqueName<Name, TClasses, TObjects, TProperties, TVariables>, HelperClassType extends ContextClass> (name: Name, ctor: new () => HelperClassType) {
    this.assertMutable()
    return this.extendAndReturnMutableContext(() => this.builder.withClass(name, ctor))
  }

  // add the given factory class to the context. it should not have ANY dependencies
  public withFactory<Name extends UniqueName<Name, TClasses, TObjects, TProperties, TVariables>, FactoryClassType extends Factory<any>> (name: Name, ctor: new () => FactoryClassType) {
    this.assertMutable()
    return this.extendAndReturnMutableContext(() => this.builder.withClass(name, ctor))
  }

  public withObject<Name extends UniqueName<Name, TClasses, TObjects, TProperties, TVariables>, T extends Injectable> (name: Name, object: T) {
    this.assertMutable()
    return this.extendAndReturnMutableContext(() => this.builder.withObject(name, object))
  }

  public withProperty<Name extends UniqueName<Name, TClasses, TObjects, TProperties, TVariables>, T extends string | boolean | number | null> (name: Name, prop: T) {
    this.assertMutable()
    return this.extendAndReturnMutableContext(() => this.builder.withProperty(name, prop))
  }

  public withVariable<Name extends UniqueName<Name, TClasses, TObjects, TProperties, TVariables>, T extends VariableResult> (name: Name, variable: () => T) {
    this.assertMutable()
    return this.extendAndReturnMutableContext(() => this.builder.withVariable(name, variable))
  }

  public build (): BuiltContext<TClasses, TObjects, TProperties, TVariables> {
    return new ContextProvider(this.builder, true) as any as BuiltContext<TClasses, TObjects, TProperties, TVariables>
  }

  public isBuiltContext (): this is BuiltContext<TClasses, TObjects, TProperties, TVariables> {
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
  public async initialise (errorHandler?: ErrorHandler) {
    if (this.isBuiltContext()) {
      await this.builder.initialise(errorHandler)
      await this.builder.notifyReady(errorHandler)
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

  private extendAndReturnMutableContext<TNewClasses extends StoredClass<any, any>, TNewObjects extends StoredObject<any, any>, TNewProperties extends StoredProperty<any, any>, TNewVariables extends StoredVariable<any, any>> (extender: () => ServiceBuilder<TNewClasses, TNewObjects, TNewProperties, TNewVariables>)
    : this extends BuiltContext<TNewClasses, TNewObjects, TNewProperties, TNewVariables> ? never : ContextProvider<TNewClasses, TNewObjects, TNewProperties, TNewVariables> {
    if (this.isBuiltContext()) {
      throw new Error('This should not happen')
    } else {
      return new ContextProvider(extender(), false) as this extends BuiltContext<TNewClasses, TNewObjects, TNewProperties, TNewVariables> ? never : ContextProvider<TNewClasses, TNewObjects, TNewProperties, TNewVariables>
    }
  }
}

type DepName = string
type StoredClass<Name extends DepName, ClassType extends ContextClass> = { [key in Name]: ClassType }
type StoredObject<Name extends DepName, Obj extends Injectable> = { [key in Name]: Obj }
type StoredProperty<Name extends DepName, Prop extends string | boolean | number | null> = { [key in Name]: Prop }
type StoredVariable<Name extends DepName, Obj extends VariableResult> = { [key in Name]: () => Obj }

// returns `never` if the given name is not unique
type UniqueName<Name, SC extends StoredClass<any, any>, SO extends StoredObject<any, any>, SP extends StoredProperty<any, any>, SV extends StoredVariable<any, any>> =  SC[Name] extends never ? SO[Name] extends never ? SP[Name] extends never ? SV[Name] extends never ? DepName : never : never : never : never

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
export function setContextProvider<TClasses extends StoredClass<any, any>, TObjects extends StoredClass<any, any>, TProperties extends StoredClass<any, any>, TVariables extends StoredClass<any, any>> (req: Express.Request, context: BuiltContext<TClasses, TObjects, TProperties, TVariables>) {
  if (Object.getOwnPropertySymbols(req).includes(CONTEXT_SYMBOL)) {
    throw new Error('A context has already been set on the Request object')
  }

  Object.defineProperty(req, CONTEXT_SYMBOL, { value: context, writable: false })
  return req
}

// retrieve the context provider with the given name from the request. throws if it doesn't exist
export function getContextProvider<C extends BuiltContext<any, any, any, any>> (req: Express.Request): C {
  if (!Object.getOwnPropertySymbols(req).includes(CONTEXT_SYMBOL)) {
    throw new Error('A context could not be found on the Request object')
  }

  return (req as any)[CONTEXT_SYMBOL] as C
}

// used internally for connecting classes
class ServiceBuilder<TClasses extends StoredClass<any, any>, TObjects extends StoredObject<any, any>, TProperties extends StoredProperty<any, any>, TVariables extends StoredProperty<any, any>> {
  private dependencies: TClasses & TObjects & TProperties
  private contextClassOrder: (keyof TClasses)[]

  constructor (baseBuilder: ServiceBuilder<TClasses, TObjects, TProperties, TVariables> | null) {
    this.contextClassOrder = baseBuilder?.contextClassOrder ?? []
    this.dependencies = baseBuilder?.dependencies ?? {} as TClasses & TObjects & TProperties
  }

  public isolateServices () {
    const isolated = new ServiceBuilder(this)
    isolated.contextClassOrder = []
    return isolated
  }

  // instantiate the class using the current dependencies and add the new instance to the dependencies
  public withClass<Name extends DepName, ClassType extends ContextClass> (name: Name, ctor: new (dep: Dependencies<TClasses & TObjects & TProperties & TVariables>) => ClassType)
    : ServiceBuilder<TClasses & StoredClass<Name, ClassType>, TObjects, TProperties, TVariables>
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
    : ServiceBuilder<TClasses, TObjects & StoredObject<Name, ObjType>, TProperties, TVariables> {
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
    : ServiceBuilder<TClasses, TObjects, TProperties & StoredProperty<Name, PropType>, TVariables> {
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

  public withVariable<Name extends DepName, ObjType extends VariableResult> (name: Name, variable: () => ObjType)
    : ServiceBuilder<TClasses, TObjects, TProperties, TVariables & StoredVariable<Name, ObjType>> {
    this.assertUniqueDependency(name)

    const newStoredProp = {
      [name]: variable
    } as StoredVariable<Name, ObjType>

    this.dependencies = {
      ...this.dependencies,
      ...newStoredProp
    }

    return this
  }

  public getDependencies (): Dependencies<TClasses & TObjects & TProperties> {
    return new Dependencies(this.dependencies)
  }

  public async initialise (errorHandler?: ErrorHandler) {
    for (const className of this.contextClassOrder) {
      await this.withErrorHandling(className, 'initialise', errorHandler)
    }
  }

  public async notifyReady (errorHandler?: ErrorHandler) {
    for (const className of this.contextClassOrder) {
      await this.withErrorHandling(className, 'onReady', errorHandler)
    }
  }

  public async dispose (errorHandler?: ErrorHandler) {
    for (const className of reverse(this.contextClassOrder)) {
      await this.withErrorHandling(className, 'dispose', errorHandler)
      Object.defineProperty(this.dependencies, className, { value: null, writable: false })
    }
  }

  private assertUniqueDependency (name: DepName) {
    if (Object.keys(this.dependencies).includes(name)) {
      throw new Error(`Cannot add dependency with name ${name} because it already exists`)
    }
  }

  private async withErrorHandling (className: keyof TClasses, stage: 'initialise' | 'onReady' | 'dispose', errorHandler?: ErrorHandler) {
    const contextClass = this.dependencies[className] as ContextClass
    if (contextClass == null) {
      throw new Error(`Context: Can't process class ${String(className)} in stage ${stage} because it does not exist in the dependencies.`)
    }

    try {
      if (stage === 'initialise') {
        await contextClass.initialise()
      } else if (stage === 'onReady') {
        await contextClass.onReady()
      } else if (stage === 'dispose') {
        await contextClass.dispose()
      } else {
        assertUnreachable(stage)
      }
    } catch (e) {
      if (errorHandler == null) {
        console.error(`Context: Can't process class ${String(className)} in stage ${stage} because of an unhandled exception.`)
        throw e
      }

      const result = errorHandler(contextClass, stage, e)
      console.error(`Context: Processed ${String(className)} in stage ${stage} but encountered an error. Handler action: ${result}`)

      if (result === 'abort') {
        throw e
      } else if (result === 'ignore') {
        return
      } else if (result === 'retry') {
        await this.withErrorHandling(contextClass, stage, errorHandler)
      } else {
        assertUnreachable(result)
      }
    }
  }
}
