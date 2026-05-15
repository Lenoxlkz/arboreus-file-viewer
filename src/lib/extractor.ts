import { createExtractorFromData as createNodeUnrarExtractor } from "node-unrar-js";
// @ts-ignore
import wasmUrl from "node-unrar-js/esm/js/unrar.wasm?url";
import { createExtractorFromData as createUnrarExtractor } from "unrar-js";
import JSZip from "jszip";
import * as pdfjs from 'pdfjs-dist';
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

// Load wasm binary once
let wasmBinaryCache: ArrayBuffer | null = null;
async function getWasmBinary() {
  if (wasmBinaryCache) return wasmBinaryCache;
  const res = await fetch(wasmUrl);
  wasmBinaryCache = await res.arrayBuffer();
  return wasmBinaryCache;
}

export async function extractImagesFromPdf(blob: Blob): Promise<Blob[]> {
  const arrayBuffer = await blob.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const pdfImageBlobs: Blob[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    if (context) {
      await page.render({ canvasContext: context, viewport } as any).promise;
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.9));
      if (blob) pdfImageBlobs.push(blob);
    }
  }
  return pdfImageBlobs;
}

export async function extractImagesFromBlob(blob: Blob): Promise<Blob[]> {
  const buffer = await blob.arrayBuffer();
  const data = new Uint8Array(buffer);
  let blobs: Blob[] = [];

  // 1. Try node-unrar-js (supports RAR5)
  try {
    const wasmBinary = await getWasmBinary();
    const extractor = await createNodeUnrarExtractor({ data, wasmBinary });
    const list = extractor.getFileList();
    const fileHeaders = [...list.fileHeaders].filter(h => !h.flags.directory && /\.(jpg|jpeg|png|webp|gif)$/i.test(h.name))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    
    if (fileHeaders.length > 0) {
      const extracted = extractor.extract({ files: fileHeaders.map(h => h.name) });
      const result = Array.from(extracted.files)
        .map(f => f.extraction ? new Blob([f.extraction], { type: "image/jpeg" }) : null)
        .filter((b): b is Blob => b !== null);
      if (result.length > 0) return result;
    }
  } catch (e) {
    console.warn("node-unrar-js failed", e);
  }

  // 2. Try unrar-js (supports RAR4, pure JS fallback)
  try {
    const extractor = createUnrarExtractor(data);
    const result = extractor.extractAll();
    const extractedBlobs = Array.from(result.files as any[])
      .filter(f => !f.fileHeader.flags.directory && /\.(jpg|jpeg|png|webp|gif)$/i.test(f.fileHeader.name))
      .sort((a, b) => a.fileHeader.name.localeCompare(b.fileHeader.name, undefined, { numeric: true }))
      .map(f => f.extraction ? new Blob([f.extraction], { type: "image/jpeg" }) : null)
      .filter((b): b is Blob => b !== null);
    if (extractedBlobs.length > 0) return extractedBlobs;
  } catch (e) {
    console.warn("unrar-js failed", e);
  }

  // 3. Try JSZip (many CBRs are actually ZIPs)
  try {
    const zip = new JSZip();
    const content = await zip.loadAsync(blob);
    const imageFiles = Object.keys(content.files).filter(path => 
      /\.(jpg|jpeg|png|webp|gif)$/i.test(path) && !content.files[path].dir
    ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    if (imageFiles.length > 0) {
      return await Promise.all(
        imageFiles.map(name => content.files[name].async("blob"))
      );
    }
  } catch (e) {
    console.warn("JSZip failed", e);
  }

  return [];
}
