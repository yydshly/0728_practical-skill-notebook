export function ShowroomEnvironment() {
  return (
    <>
      <color attach="background" args={["#15211b"]} />
      <fog attach="fog" args={["#15211b", 4.8, 10]} />

      <ambientLight color="#b9c9d2" intensity={0.45} />
      <directionalLight
        color="#9fc5dc"
        intensity={1.15}
        position={[-3, 4.5, 2]}
      />
      <pointLight
        color="#ffc477"
        intensity={18}
        distance={7}
        decay={2}
        position={[2.2, 2.4, 0.7]}
        castShadow
      />

      <mesh position={[0, 1.15, -2.05]} receiveShadow>
        <boxGeometry args={[6.4, 3.7, 0.18]} />
        <meshStandardMaterial color="#26372f" roughness={0.96} />
      </mesh>
      <mesh position={[0, -0.73, -0.2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[7, 7]} />
        <meshStandardMaterial color="#16231d" roughness={1} />
      </mesh>

      {[-2.3, -1.15, 0, 1.15, 2.3].map((x) => (
        <mesh key={x} position={[x, 1.12, -1.94]} receiveShadow>
          <boxGeometry args={[0.035, 3.55, 0.035]} />
          <meshStandardMaterial color="#3b4c42" roughness={0.9} />
        </mesh>
      ))}

      <mesh position={[0, 0.62, -1.66]} castShadow receiveShadow>
        <boxGeometry args={[3.1, 0.12, 0.6]} />
        <meshStandardMaterial color="#765539" roughness={0.88} />
      </mesh>
      <mesh position={[0, 0.43, -1.73]} castShadow receiveShadow>
        <boxGeometry args={[2.9, 0.28, 0.36]} />
        <meshStandardMaterial color="#4f3929" roughness={0.92} />
      </mesh>
      {[-1.22, 1.22].map((x) => (
        <mesh key={x} position={[x, -0.02, -1.73]} castShadow>
          <boxGeometry args={[0.13, 0.75, 0.26]} />
          <meshStandardMaterial color="#493326" roughness={0.95} />
        </mesh>
      ))}

      <mesh position={[0, -0.54, -0.5]} castShadow receiveShadow>
        <cylinderGeometry args={[0.72, 0.82, 0.26, 28]} />
        <meshStandardMaterial color="#34443b" roughness={0.75} />
      </mesh>
      <mesh position={[0, -0.39, -0.5]} receiveShadow>
        <cylinderGeometry args={[0.66, 0.7, 0.08, 28]} />
        <meshStandardMaterial color="#b1844f" roughness={0.7} />
      </mesh>
    </>
  );
}
