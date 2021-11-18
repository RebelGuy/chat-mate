import { Dependencies, ContextProvider } from '@context/ContextProvider'

class TestA {
  constructor () {
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

const prov = new ContextProvider()
  .withClass(TestA)
  .withClass(TestB)
  .withClass(TestC)

console.log()
