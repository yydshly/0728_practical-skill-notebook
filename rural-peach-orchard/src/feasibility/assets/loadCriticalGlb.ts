import type { AnimationClip, Object3D } from 'three'

export interface CriticalGlbRequest {
  assetId: string
  url: string
  requiredNodes: readonly string[]
}

export interface LoadedCriticalAsset {
  scene: Object3D
  anchors: ReadonlyMap<string, Object3D>
  clips: AnimationClip[]
}

export interface CriticalGlbLoader {
  loadAsync(url: string): Promise<{
    scene: Object3D
    animations: AnimationClip[]
  }>
}

export async function loadCriticalGlb(
  loader: CriticalGlbLoader,
  request: CriticalGlbRequest,
): Promise<LoadedCriticalAsset> {
  const gltf = await loader.loadAsync(request.url)
  const anchors = new Map<string, Object3D>()

  for (const nodeName of request.requiredNodes) {
    const node = gltf.scene.getObjectByName(nodeName)
    if (!node) {
      throw new Error(`${request.assetId}: missing node ${nodeName}`)
    }
    anchors.set(nodeName, node)
  }

  return {
    scene: gltf.scene,
    anchors,
    clips: gltf.animations,
  }
}
