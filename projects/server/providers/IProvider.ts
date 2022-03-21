// used to inject non-standard classes or defer/isolate the creation of objects.
export default interface IProvider<T> {
  // not guaranteed to be available/fully initialised in the constructor.
  // wait until the ContextClass::initalise() method to guarantee this.
  get: () => T
}
