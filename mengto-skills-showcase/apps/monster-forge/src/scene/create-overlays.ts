import type { MonsterInstance } from "@showcase/game-assets";
import {
  BufferGeometry,
  CanvasTexture,
  CylinderGeometry,
  DataTexture,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Sprite,
  SpriteMaterial,
  Texture,
  RGBAFormat,
  Vector3,
} from "three";

export type ReviewOverlayName = "skeleton" | "colliders" | "sockets";

export interface ReviewOverlays {
  setVisible(name: ReviewOverlayName, visible: boolean): void;
  update(): void;
  dispose(): void;
}

/**
 * Creates review-only diagnostics from the real procedural joint/socket maps.
 * The nodes are attached to the monster root, so their lifetime follows the
 * selected model rather than the global inspector scene.
 */
export function createReviewOverlays(instance: MonsterInstance): ReviewOverlays {
  const root = new Group();
  root.name = "review-overlays";
  root.userData.reviewOnly = true;
  instance.root.add(root);

  const skeleton = new Group();
  skeleton.name = "review-skeleton";
  const skeletonGeometry = new BufferGeometry();
  const skeletonMaterial = new LineBasicMaterial({ color: 0xf5d45e, transparent: true, opacity: 0.92 });
  const skeletonLines = new LineSegments(skeletonGeometry, skeletonMaterial);
  skeletonLines.name = "review-joint-hierarchy";
  skeleton.add(skeletonLines);

  const collider = new Group();
  collider.name = "review-colliders";
  const colliderGeometry = new CylinderGeometry(instance.collider.radius, instance.collider.radius, instance.collider.height, 18, 1, true);
  const colliderMaterial = new MeshBasicMaterial({ color: 0xff9b6c, transparent: true, opacity: 0.26, depthWrite: false });
  const colliderMesh = new Mesh(colliderGeometry, colliderMaterial);
  colliderMesh.name = "review-collider-solid";
  colliderMesh.position.y = instance.collider.height / 2;
  colliderMesh.userData = { ...instance.collider.root.userData, reviewOnly: true };
  collider.add(colliderMesh);

  const sockets = new Group();
  sockets.name = "review-sockets";
  const socketResources: Array<{ label: Sprite; material: SpriteMaterial; texture: Texture }> = [];
  for (const [name, socket] of instance.sockets) {
    const texture = createLabelTexture(name);
    const material = new SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const label = new Sprite(material);
    label.name = `review-socket-${name}`;
    label.userData = { socket: name, reviewOnly: true };
    label.scale.set(0.54, 0.18, 1);
    label.position.set(0, 0.12, 0);
    socket.add(label);
    label.visible = false;
    socketResources.push({ label, material, texture });
  }

  root.add(skeleton, collider, sockets);
  const visible: Record<ReviewOverlayName, boolean> = { skeleton: false, colliders: false, sockets: false };
  let disposed = false;

  const nearestJointParent = (joint: Object3D) => {
    let parent = joint.parent;
    while (parent) {
      if ([...instance.joints.values()].includes(parent)) return parent;
      parent = parent.parent;
    }
    return undefined;
  };

  const syncJointLines = () => {
    const points: Vector3[] = [];
    const childWorld = new Vector3();
    const parentWorld = new Vector3();
    instance.root.updateWorldMatrix(true, false);
    for (const joint of instance.joints.values()) {
      const parent = nearestJointParent(joint);
      if (!parent) continue;
      joint.getWorldPosition(childWorld);
      parent.getWorldPosition(parentWorld);
      points.push(instance.root.worldToLocal(parentWorld.clone()), instance.root.worldToLocal(childWorld.clone()));
    }
    skeletonGeometry.setFromPoints(points);
    skeletonGeometry.computeBoundingSphere();
  };

  syncJointLines();
  skeleton.visible = false;
  collider.visible = false;
  sockets.visible = false;

  return {
    setVisible(name, nextVisible) {
      if (disposed) return;
      visible[name] = nextVisible;
      if (name === "skeleton") skeleton.visible = nextVisible;
      if (name === "colliders") collider.visible = nextVisible;
      if (name === "sockets") {
        sockets.visible = nextVisible;
        for (const { label } of socketResources) label.visible = nextVisible;
      }
    },
    update() {
      if (disposed || !visible.skeleton) return;
      syncJointLines();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      skeletonGeometry.dispose();
      skeletonMaterial.dispose();
      colliderGeometry.dispose();
      colliderMaterial.dispose();
      for (const { label, material, texture } of socketResources) {
        label.removeFromParent();
        material.dispose();
        texture.dispose();
      }
      socketResources.length = 0;
    },
  };
}

function createLabelTexture(label: string): Texture {
  if (typeof document === "undefined") {
    const texture = new DataTexture(new Uint8Array([144, 243, 211, 255]), 1, 1, RGBAFormat);
    texture.needsUpdate = true;
    return texture;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 72;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "rgba(18, 17, 20, 0.78)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#90f3d3";
  context.lineWidth = 3;
  context.strokeRect(1.5, 1.5, canvas.width - 3, canvas.height - 3);
  context.fillStyle = "#effff9";
  context.font = "600 27px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, canvas.width / 2, canvas.height / 2);
  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
