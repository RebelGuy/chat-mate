export default interface IProvider<T> {
  get: () => T
}
