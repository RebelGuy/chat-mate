export default interface IFactory<T> {
  create: () => T
}
