export interface Disposable {
  dispose(): void;
}

export class DisposableScope {
  private disposed = false;
  private readonly resources = new Set<Disposable>();

  track<T extends Disposable>(resource: T): T {
    if (this.disposed) throw new Error("DisposableScope is already disposed");
    this.resources.add(resource);
    return resource;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    const errors: unknown[] = [];
    try {
      for (const resource of this.resources) {
        try {
          resource.dispose();
        } catch (error) {
          errors.push(error);
        }
      }
    } finally {
      this.resources.clear();
    }

    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) {
      throw new AggregateError(errors, "DisposableScope failed to dispose one or more resources");
    }
  }
}
