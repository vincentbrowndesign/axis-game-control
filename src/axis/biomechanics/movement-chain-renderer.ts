import type { AxisMovementChain } from "./movement-chain-types";

export function renderAxisMovementChain(canvas: HTMLCanvasElement, input: {
  chain: AxisMovementChain | null;
  video: HTMLVideoElement;
}) {
  if (!input.chain) return;

  const context = canvas.getContext("2d");
  if (!context) return;

  const width = input.video.videoWidth;
  const height = input.video.videoHeight;
  if (!width || !height) return;

  const nodes = new Map(input.chain.nodes.map((node) => [node.id, node]));

  context.save();
  input.chain.links.forEach((link) => {
    const from = nodes.get(link.fromNodeId);
    const to = nodes.get(link.toNodeId);
    if (!from || !to) return;

    context.globalAlpha = link.state === "weak" ? 0.46 : 0.88;
    context.lineWidth = link.state === "weak" ? 2 : 3;
    context.strokeStyle = "#9dff45";
    context.setLineDash(link.state === "weak" ? [8, 7] : []);
    context.beginPath();
    context.moveTo(from.x * width, from.y * height);
    context.lineTo(to.x * width, to.y * height);
    context.stroke();
  });

  context.setLineDash([]);
  input.chain.nodes.forEach((node) => {
    context.globalAlpha = node.confidence >= 0.55 ? 0.92 : 0.5;
    context.fillStyle = "#f8f5ee";
    context.strokeStyle = "#101510";
    context.lineWidth = 2;
    context.beginPath();
    context.arc(node.x * width, node.y * height, node.kind === "trunk" ? 4.5 : 4, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  });

  const first = input.chain.nodes[0];
  if (first && input.chain.reviewState !== "uncertain") {
    drawTinyLabel(context, "Load chain", first.x * width, first.y * height);
  }
  context.restore();
}

function drawTinyLabel(context: CanvasRenderingContext2D, label: string, x: number, y: number) {
  context.globalAlpha = 0.78;
  context.font = "700 10px Arial, sans-serif";
  const width = context.measureText(label).width + 10;
  const labelX = Math.max(6, x - 4);
  const labelY = Math.max(18, y - 16);
  context.fillStyle = "rgba(16, 21, 16, 0.72)";
  context.beginPath();
  context.roundRect(labelX, labelY - 14, width, 18, 6);
  context.fill();
  context.fillStyle = "#9dff45";
  context.fillText(label, labelX + 5, labelY);
}
