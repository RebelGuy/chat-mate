// Hydratable map.
export default class HydroMap<K, V> {
  private cache: Map<K, V> = new Map()

  public async get (key: K, hydrate: () => Promise<V>): Promise<V> {
    if (this.has(key)) {
      return this.cache.get(key)!
    } else {
      const value = await hydrate()
      return this.set(key, value)
    }
  }

  public delete (key: K) {
    this.cache.delete(key)
  }

  public clear (){
    this.cache.clear()
  }

  public has (key: K) {
    return this.cache.has(key)
  }

  public set (key: K, value: V): V {
    this.cache.set(key, value)
    return value
  }
}