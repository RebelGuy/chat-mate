import { Dependencies, ContextProvider } from '@rebel/context/ContextProvider'

class TestA {
  constructor () {
    console.log('A constructed')
  }
}

class TestB {
  readonly testA: TestA

  constructor (dependencies: Dependencies) {
    this.testA = dependencies.resolve(TestA.name)
    console.log('B constructed')
  }
}

class TestC {
  readonly testA: TestA
  readonly testB: TestB

  constructor (dependencies: Dependencies) {
    this.testA = dependencies.resolve(TestA.name)
    this.testB = dependencies.resolve(TestB.name)
    console.log('C constructed')
  }
}

const prov = new ContextProvider()
  .withClass(TestA)
  .withClass(TestB)
  .withClass(TestC)

console.log()
