import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

async function writeBlob(filePath, blob) {
  await fs.writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
}

const [, , inputPptx, outDir] = process.argv;
if (!inputPptx || !outDir) {
  console.error("Usage: node inspect-custom.mjs <input.pptx> <out-dir>");
  process.exit(2);
}

await fs.mkdir(outDir, { recursive: true });
const presentation = await PresentationFile.importPptx(await FileBlob.load(inputPptx));
const inspect = await presentation.inspect({
  kind: "slide,textbox,shape,image,table,chart,notes,layout",
  maxChars: 200000,
});
await fs.writeFile(path.join(outDir, "inspect.ndjson"), inspect.ndjson, "utf8");

for (const [index, slide] of presentation.slides.items.entries()) {
  const stem = `slide-${String(index + 1).padStart(2, "0")}`;
  await writeBlob(path.join(outDir, `${stem}.png`), await presentation.export({ slide, format: "png", scale: 1 }));
  await fs.writeFile(path.join(outDir, `${stem}.layout.json`), await (await slide.export({ format: "layout" })).text(), "utf8");
}

await writeBlob(path.join(outDir, "montage.webp"), await presentation.export({ format: "webp", montage: true, scale: 1 }));
console.log(`Inspected ${presentation.slides.items.length} slides`);
