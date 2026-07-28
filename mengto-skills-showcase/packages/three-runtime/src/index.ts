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
    for (const resource of this.resources) resource.dispose();
    this.resources.clear();
  }
}
