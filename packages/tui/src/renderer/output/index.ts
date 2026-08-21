// Barrel for the renderer's output stage (ADR 0001) — everything between a
// laid-out node tree and the bytes written to the terminal.

export { OutputEngine } from "./output-engine.js";
export { Output } from "./output-grid.js";
export { renderNodeToOutput } from "./render-node.js";
export type {
  CellDimensions,
  ImageCellSize,
  ImageDimensions,
  ImageProtocol,
} from "./terminal-image.js";
export {
  allocateImageId,
  calculateImageCellSize,
  deleteKittyImage,
  detectImageProtocol,
  encodeITerm2,
  encodeKitty,
  getImageDimensions,
  imageFallback,
} from "./terminal-image.js";
