export default class Pipeline<T> {
    private value: T
    constructor(value: T) {
        this.value = value
    }

  // Receives a modifier function, applies it, and returns a new Pipeline instance of T
  execute(fn: (arg: T) => T): Pipeline<T> {
    return new Pipeline(fn(this.value));
  }

  // Returns the final generic T value
  end(): T {
    return this.value;
  }
}