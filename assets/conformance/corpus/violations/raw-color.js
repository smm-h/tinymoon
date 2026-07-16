import { cssVar } from "./settings.js";

export function paint(ctx) {
  ctx.fillStyle = "#2d7ff9";
  ctx.strokeStyle = "rgba(45, 127, 249, 0.35)";
  ctx.shadowColor = "oklch(0.7 0.1 200)";
  ctx.fillStyle = cssVar("--accent");
}
