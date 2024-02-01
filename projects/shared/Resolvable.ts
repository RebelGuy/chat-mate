export default class Resolvable<T> {
  private isResolved = false
  private value: T | null = null
  private promise: Promise<T> | null = null
  private readonly onResolve: () => Promise<T>

  constructor (onResolve: () => Promise<T>) {
    this.onResolve = onResolve
  }

  public async resolve (): Promise<T> {
    if (this.isResolved) {
      return this.value!
    } else if (this.promise != null) {
      return await this.promise
    } else {
      this.promise = this.onResolve()
      this.value = await this.promise
      return this.value
    }
  }
}
