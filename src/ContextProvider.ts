export default class ContextProvider {
  private builder: ServiceBuilder<any>

  constructor () {
    this.builder = new ServiceBuilder({})
  }

  // this should just extend the types, but not do any instantiation...
  public withClass<Ctor extends new (dep: any) => any> (classObject: Ctor) {
    this.builder = this.builder.withClass(classObject)
    return this
  }

  // there should then be a buildClasses method which does all of the instantiation

  public contextualise (serviceClass: Function): Function {
    // const service = serviceClass.prototype.constructor.bind(serviceClass, this.builder.getDependencies())()
    // const service = serviceClass(this.builder.getDependencies())
    return this.builder.getDependencies().getInstance(serviceClass.name)
  }
}


class ServiceBuilder<D> {
  readonly dependencies: D

  constructor (dependencies: D) {
    this.dependencies = dependencies
  }

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



export class Dependencies {
  readonly dependencies

  constructor (dependencies: any) {
    this.dependencies = dependencies
  }

  public getInstance (name: string): any {
    const instance = this.dependencies[name]
    if (instance == null) {
      throw new Error(`Could not resolve dependency for ${name}`)
    }
    return instance
  }
}

class TestA {
  constructor (dependencies: Dependencies) {
    console.log('A constructed')
  }
}


class TestB {
  readonly testA: TestA

  constructor (dependencies: Dependencies) {
    this.testA = dependencies.getInstance(TestA.name)
    console.log('B constructed')
  }
}


class TestC {
  readonly testA: TestA
  readonly testB: TestB

  constructor (dependencies: Dependencies) {
    this.testA = dependencies.getInstance(TestA.name)
    this.testB = dependencies.getInstance(TestB.name)
    console.log('C constructed')
  }
}

export function setContextProvider (req: Express.Request, context: ContextProvider) {
  // tslint:disable-next-line:no-string-literal
  (req as any).context = context
}

export function getContextProvider (req: Express.Request): ContextProvider {
  const context = (req as any).context as ContextProvider
  if (context == null) {
    throw new Error('No context exists')
  }

  return context
}



const prov = new ContextProvider()
  .withClass(TestA)
  .withClass(TestB)
  .withClass(TestC)

console.log()
