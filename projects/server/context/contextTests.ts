import { Dependencies, ContextProvider } from '@rebel/server/context/context'

class TestA {
  constructor () {
    console.log('A constructed')
  }
}

class TestB {
  readonly testA: TestA

  constructor (dependencies: Dependencies<{ testA: TestA }>) {
    this.testA = dependencies.resolve('testA')
    console.log('B constructed')
  }
}

class TestC {
  readonly testA: TestA
  readonly testB: TestB

  constructor (dependencies: Dependencies<{ testA: TestA, testB: TestB }>) {
    this.testA = dependencies.resolve('testA')
    this.testB = dependencies.resolve('testB')
    console.log('C constructed')
  }
}

const prov = ContextProvider.create()
  .withClass('testA', TestA)
  .withClass('testB', TestB)
  .withClass('testC', TestC)
  .build()

console.log()
