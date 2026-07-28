import { Html } from "@react-three/drei";
import { CAPABILITIES } from "../../config/showcaseConfig";
import { shelfXFor } from "../../scene/stageMath";
import { useShowcaseStore } from "../../state/useShowcaseStore";
import { CapabilityArtifact } from "./CapabilityArtifact";

const shelfButtonStyle = {
  appearance: "none",
  border: "1px solid rgba(255, 232, 190, 0.52)",
  borderRadius: "999px",
  background: "rgba(20, 32, 26, 0.9)",
  color: "#f6ead3",
  cursor: "pointer",
  font: "600 10px/1.2 system-ui, sans-serif",
  letterSpacing: "0.05em",
  padding: "5px 9px",
  whiteSpace: "nowrap",
};

export function ShelfCapabilities() {
  const selectedIndex = useShowcaseStore((state) => state.selectedIndex);
  const selectIndex = useShowcaseStore((state) => state.selectIndex);

  const activateFromKeyboard = (event, index) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    selectIndex(index);
  };

  return CAPABILITIES.map((capability, index) => {
    if (index === selectedIndex) return null;

    const x = shelfXFor(index, CAPABILITIES.length);

    return (
      <group
        key={capability.id}
        name={`shelf-${capability.id}`}
        position={[x, 1.2, -1.5]}
      >
        <CapabilityArtifact
          capability={capability}
          scale={0.4}
          onClick={(event) => {
            event.stopPropagation();
            selectIndex(index);
          }}
          onPointerDown={(event) => event.stopPropagation()}
        />
        <Html center position={[0, -0.52, 0]} distanceFactor={4}>
          <button
            type="button"
            aria-label={`选择${capability.railLabel}`}
            onClick={() => selectIndex(index)}
            onKeyDown={(event) => activateFromKeyboard(event, index)}
            onPointerDown={(event) => event.stopPropagation()}
            style={shelfButtonStyle}
          >
            {capability.railLabel}
          </button>
        </Html>
      </group>
    );
  });
}
