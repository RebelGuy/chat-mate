import { Dependencies, ContextProvider } from '@rebel/server/context/context'

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

const prov = ContextProvider.create()
  .withClass(TestA)
  .withClass(TestB)
  .withClass(TestC)
  .build()

console.log()
