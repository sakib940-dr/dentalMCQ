# Bengali PDF trailing `D` artifact fix

Updated `src/components/PrescriptionPage.jsx` Bengali canvas renderer.

Changes are limited to the Bengali PDF rendering helper:
- NFC-normalizes Bengali Unicode before canvas shaping.
- Adds a zero-width shaping sentinel so the final Bengali cluster is not treated as a clipped terminal glyph.
- Sizes the canvas from `actualBoundingBoxLeft/Right` instead of advance width alone.
- Adds safer transparent padding around Bengali glyphs.
- Removes jsPDF `FAST` PNG compression from Bengali run images.

No A4 layout coordinates, margins, band heights, clinical data, medicine database, SQL schema, or prescription workflow were changed.
