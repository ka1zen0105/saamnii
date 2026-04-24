import html2canvas from "html2canvas";

function sanitizeFileName(input) {
  const raw = String(input || "chart").trim();
  return raw.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "-");
}

export async function downloadElementAsPng(element, fileBaseName) {
  if (!element) return;
  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
  });
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitizeFileName(fileBaseName)}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

