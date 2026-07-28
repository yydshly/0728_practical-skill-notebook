function Lighthouse({ accent }) {
  return (
    <group name="lighthouse-artifact" position={[0, 0.05, 0]}>
      <mesh position={[0, -0.27, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.28, 0.34, 0.16, 12]} />
        <meshStandardMaterial color="#4a3425" roughness={0.82} />
      </mesh>
      <mesh position={[0, 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.25, 0.72, 14]} />
        <meshStandardMaterial color="#e5d6b8" roughness={0.72} />
      </mesh>
      <mesh position={[0, 0.12, 0.162]} castShadow>
        <boxGeometry args={[0.13, 0.22, 0.035]} />
        <meshStandardMaterial color={accent} roughness={0.58} />
      </mesh>
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.2, 0.08, 14]} />
        <meshStandardMaterial color="#29352e" roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.61, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.13, 0.2, 12]} />
        <meshStandardMaterial
          color="#ffd487"
          emissive="#f6a63c"
          emissiveIntensity={2.4}
          roughness={0.28}
        />
      </mesh>
      <mesh position={[0, 0.77, 0]} castShadow>
        <coneGeometry args={[0.22, 0.18, 12]} />
        <meshStandardMaterial color={accent} roughness={0.7} />
      </mesh>
      <mesh position={[0.36, 0.61, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.21, 0.72, 18, 1, true]} />
        <meshBasicMaterial
          color="#ffd47a"
          opacity={0.2}
          transparent
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function FlagGlyph({ variant }) {
  if (variant === "i") {
    return (
      <>
        <mesh position={[0, 0.02, 0.014]}>
          <boxGeometry args={[0.035, 0.2, 0.024]} />
          <meshStandardMaterial color="#f3ead7" />
        </mesh>
        <mesh position={[0, 0.16, 0.014]}>
          <boxGeometry args={[0.045, 0.045, 0.024]} />
          <meshStandardMaterial color="#f3ead7" />
        </mesh>
      </>
    );
  }

  if (variant === "v") {
    return (
      <>
        <mesh position={[-0.045, 0.04, 0.014]} rotation={[0, 0, -0.38]}>
          <boxGeometry args={[0.035, 0.22, 0.024]} />
          <meshStandardMaterial color="#f3ead7" />
        </mesh>
        <mesh position={[0.045, 0.04, 0.014]} rotation={[0, 0, 0.38]}>
          <boxGeometry args={[0.035, 0.22, 0.024]} />
          <meshStandardMaterial color="#f3ead7" />
        </mesh>
      </>
    );
  }

  return (
    <>
      <mesh position={[-0.065, 0.04, 0.014]} rotation={[0, 0, -0.2]}>
        <boxGeometry args={[0.035, 0.22, 0.024]} />
        <meshStandardMaterial color="#f3ead7" />
      </mesh>
      <mesh position={[0.065, 0.04, 0.014]} rotation={[0, 0, 0.2]}>
        <boxGeometry args={[0.035, 0.22, 0.024]} />
        <meshStandardMaterial color="#f3ead7" />
      </mesh>
      <mesh position={[0, 0, 0.014]}>
        <boxGeometry args={[0.13, 0.035, 0.024]} />
        <meshStandardMaterial color="#f3ead7" />
      </mesh>
    </>
  );
}

function SuspendedFlags({ accent }) {
  const flags = [
    { x: -0.34, y: 0.12, color: accent, glyph: "w", turn: -0.08 },
    { x: 0, y: 0.04, color: "#34483b", glyph: "i", turn: 0.05 },
    { x: 0.34, y: 0.15, color: "#d59644", glyph: "v", turn: 0.1 },
  ];

  return (
    <group name="suspended-flags-artifact" position={[0, 0.08, 0]}>
      <mesh position={[0, 0.63, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.025, 0.025, 0.95, 8]} />
        <meshStandardMaterial color="#493529" roughness={0.9} />
      </mesh>
      {flags.map((flag) => (
        <group
          key={flag.x}
          position={[flag.x, flag.y, 0]}
          rotation={[0, flag.turn, 0]}
        >
          <mesh position={[0, 0.34, 0]} castShadow>
            <cylinderGeometry args={[0.008, 0.008, 0.36, 6]} />
            <meshStandardMaterial color="#6e5c47" roughness={1} />
          </mesh>
          <mesh castShadow>
            <boxGeometry args={[0.27, 0.4, 0.025]} />
            <meshStandardMaterial
              color={flag.color}
              roughness={0.92}
              side={2}
            />
          </mesh>
          <FlagGlyph variant={flag.glyph} />
          <mesh position={[0, -0.23, 0]} rotation={[0, 0, Math.PI]}>
            <coneGeometry args={[0.135, 0.12, 3]} />
            <meshStandardMaterial color={flag.color} roughness={0.92} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function InterfaceFrame({ position, rotation, color, accent, scale = 1 }) {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh castShadow>
        <boxGeometry args={[0.86, 0.54, 0.055]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.08} />
      </mesh>
      <mesh position={[0, 0, 0.032]}>
        <planeGeometry args={[0.75, 0.43]} />
        <meshStandardMaterial color="#e9eadf" roughness={0.95} />
      </mesh>
      <mesh position={[-0.25, 0.14, 0.038]}>
        <boxGeometry args={[0.19, 0.035, 0.018]} />
        <meshStandardMaterial color={accent} roughness={0.65} />
      </mesh>
      <mesh position={[-0.1, 0.04, 0.038]}>
        <boxGeometry args={[0.49, 0.025, 0.018]} />
        <meshStandardMaterial color="#708078" roughness={0.75} />
      </mesh>
      <mesh position={[-0.15, -0.05, 0.038]}>
        <boxGeometry args={[0.39, 0.025, 0.018]} />
        <meshStandardMaterial color="#9aa49c" roughness={0.75} />
      </mesh>
      <mesh position={[0.18, -0.15, 0.038]}>
        <boxGeometry args={[0.23, 0.09, 0.018]} />
        <meshStandardMaterial color={accent} roughness={0.6} />
      </mesh>
    </group>
  );
}

function LayeredPrototype({ accent }) {
  return (
    <group name="layered-interface-artifact" position={[0, 0.14, 0]}>
      <InterfaceFrame
        position={[-0.18, 0.18, -0.16]}
        rotation={[0.08, 0.18, -0.04]}
        color="#34433e"
        accent={accent}
        scale={0.74}
      />
      <InterfaceFrame
        position={[0.16, -0.02, -0.05]}
        rotation={[-0.04, -0.14, 0.03]}
        color="#6d7d78"
        accent="#c5904c"
        scale={0.84}
      />
      <InterfaceFrame
        position={[0, -0.22, 0.13]}
        rotation={[0, 0.08, -0.02]}
        color={accent}
        accent="#9c3f31"
      />
    </group>
  );
}

export function CapabilityArtifact({ capability, ...groupProps }) {
  return (
    <group {...groupProps}>
      {capability.artifact === "lighthouse" && (
        <Lighthouse accent={capability.accent} />
      )}
      {capability.artifact === "flags" && (
        <SuspendedFlags accent={capability.accent} />
      )}
      {capability.artifact === "prototype" && (
        <LayeredPrototype accent={capability.accent} />
      )}
    </group>
  );
}
