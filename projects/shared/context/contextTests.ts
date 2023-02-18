import { Dependencies, ContextProvider } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'

class TestA extends ContextClass {
  constructor () {
    super()
    console.log('A constructed')
  }
}

class TestB extends ContextClass {
  readonly testA: TestA

  constructor (dependencies: Dependencies<{ testA: TestA }>) {
    super()
    this.testA = dependencies.resolve('testA')
    console.log('B constructed')
  }
}

class TestC extends ContextClass {
  readonly testA: TestA
  readonly testB: TestB

  constructor (dependencies: Dependencies<{ testA: TestA, testB: TestB }>) {
    super()
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
