# Signal veil validation

| State | Evidence | Result |
| --- | --- | --- |
| Desktop story B | 768 x 1024 browser preview at scene progress 0.58, 2026-07-28 | The signal veil is fully visible beside the lighthouse; the story panel remains readable above it. |
| Outside story B | Browser state before 0.50 and after 0.69; unit coverage | The canvas is transparent and stops animating. |
| Reduced motion and small screens | CSS capability fallback and automated browser coverage | The canvas is not displayed. |

Boundary: the veil is decorative only. Its pointer response is available for fine-pointer desktop scenes and is deliberately omitted on coarse-pointer and reduced-motion surfaces.
