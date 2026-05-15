import React, { useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Upload,
  FolderPlus,
  FilePlus,
  Loader2,
  FileDown,
  X,
  Info,
} from "lucide-react";
import { useApp } from "../AppContext";
import { VirtualFile, VirtualFolder } from "../types";
import { getFileExtension } from "../lib/utils";
import JSZip from "jszip";
import { saveFileBlob, saveExtractedImages } from "../lib/storage";
import { extractImagesFromBlob } from "../lib/extractor";
import { convertToCBZ, convertToPDF } from "../lib/conversion";
import { motion, AnimatePresence } from "motion/react";

export const FileUploader: React.FC = () => {
  const { state, dispatch } = useApp();
  const [isProcessing, setIsProcessing] = useState(false);
  const [rarQueue, setRarQueue] = useState<
    { file: File; id: string; virtualFile: VirtualFile }[]
  >([]);
  const [isConvertingRar, setIsConvertingRar] = useState(false);
  const [showUploadHint, setShowUploadHint] = useState(false);
  const [uploadFileCount, setUploadFileCount] = useState(1);
  const uploadHintTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const processFiles = async (
    files: FileList | File[],
    forcedParentId: string | null = state.currentFolderId,
  ) => {
    setIsProcessing(true);
    setUploadFileCount(files.length);
    setShowUploadHint(true);

    if (uploadHintTimeoutRef.current) {
      clearTimeout(uploadHintTimeoutRef.current);
    }
    uploadHintTimeoutRef.current = setTimeout(() => {
      setShowUploadHint(false);
    }, 12000);

    // Yield to event loop so React can paint the hint
    await new Promise((resolve) => setTimeout(resolve, 100));

    const newFiles: VirtualFile[] = [];
    const newFolders: Map<string, string> = new Map();
    const discoveredRars: {
      file: File;
      id: string;
      virtualFile: VirtualFile;
    }[] = [];

    try {
      for (const file of Array.from(files)) {
        const ext = getFileExtension(file.name);
        const fileId = crypto.randomUUID();

        await saveFileBlob(fileId, file);

        let parentId = forcedParentId;
        if ("webkitRelativePath" in file && (file as any).webkitRelativePath) {
          const parts = (file as any).webkitRelativePath.split("/");
          let currentPath = "";
          let currentParentId = forcedParentId;

          for (let i = 0; i < parts.length - 1; i++) {
            currentPath += (currentPath ? "/" : "") + parts[i];
            if (!newFolders.has(currentPath)) {
              const folderId = crypto.randomUUID();
              const newFolder: VirtualFolder = {
                id: folderId,
                name: parts[i],
                parentId: currentParentId,
                createdAt: Date.now(),
              };
              dispatch({ type: "ADD_FOLDER", payload: newFolder });
              newFolders.set(currentPath, folderId);
            }
            currentParentId = newFolders.get(currentPath)!;
          }
          parentId = currentParentId;
        }

        const virtualFile: VirtualFile = {
          id: fileId,
          name: file.name,
          extension: ext,
          size: file.size,
          type: file.type,
          parentId: parentId,
          objectUrl: URL.createObjectURL(file), // Session URL
          lastModified: file.lastModified,
        };

        if (ext === "rar" || ext === "cbr") {
          discoveredRars.push({ file, id: fileId, virtualFile });
        } else if (ext === "cbz") {
          try {
            const imageBlobs = await extractImagesFromBlob(file);
            if (imageBlobs.length > 0) {
              const imageUrls = imageBlobs.map((blob) =>
                URL.createObjectURL(blob),
              );
              virtualFile.extractedImages = imageUrls;
              await saveExtractedImages(fileId, imageBlobs);
            }
          } catch (e) {
            console.error(`Failed to extract images from ${ext}`, e);
          }
        }

        newFiles.push(virtualFile);
      }

      dispatch({ type: "ADD_FILES", payload: newFiles });

      if (discoveredRars.length > 0) {
        setRarQueue((prev) => [...prev, ...discoveredRars]);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRarConvert = async (format: "pdf" | "cbz") => {
    if (rarQueue.length === 0) return;
    setIsConvertingRar(true);
    try {
      const top = rarQueue[0];
      const blobs = await extractImagesFromBlob(top.file);
      if (blobs.length === 0) {
        alert("Failed to extract images from this RAR. Cannot convert.");
      } else {
        await saveExtractedImages(top.id, blobs);
        const imageUrls = blobs.map((blob) => URL.createObjectURL(blob));
        dispatch({
          type: "UPDATE_FILE_URL",
          payload: {
            id: top.id,
            url: top.virtualFile.objectUrl,
            extractedImages: imageUrls,
          },
        });

        let outBlob;
        let ext;
        if (format === "cbz") {
          outBlob = await convertToCBZ(top.virtualFile, blobs);
          ext = "cbz";
        } else {
          outBlob = await convertToPDF(top.virtualFile, blobs);
          ext = "pdf";
        }

        const a = document.createElement("a");
        a.href = URL.createObjectURL(outBlob);
        a.download = top.file.name.replace(/\.[^/.]+$/, "") + `.${ext}`;
        a.click();

        // Notify user directly
        alert(
          `Conversion complete! Your ${ext.toUpperCase()} file is ready and downloading.`,
        );
      }
      setRarQueue((prev) => prev.slice(1));
    } catch (e) {
      console.error(e);
      alert("Conversion encountered an error.");
    } finally {
      setIsConvertingRar(false);
    }
  };

  const handleSkipRar = () => {
    setRarQueue((prev) => prev.slice(1));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
    e.target.value = "";
  };

  return (
    <>
      {!state.selectedFileId && (
        <div className="flex gap-2 max-sm:fixed max-sm:bottom-24 max-sm:left-1/2 max-sm:-translate-x-1/2 max-sm:flex-row max-sm:z-[150] sm:items-center">
          <input
            type="file"
            multiple
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          <input
            type="file"
            webkitdirectory=""
            className="hidden"
            // @ts-ignore
            directory=""
            ref={folderInputRef}
            onChange={handleFileChange}
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 max-sm:w-14 max-sm:h-14 sm:px-4 sm:py-2 bg-[var(--primary-color)] text-[var(--on-primary-color)] rounded-full hover:opacity-90 transition-all shadow-lg active:scale-95"
            title="Add Files"
          >
            <FilePlus size={24} className="sm:w-[18px] sm:h-[18px]" />
            <span className="hidden sm:inline">Add Files</span>
          </button>

          <button
            onClick={() => folderInputRef.current?.click()}
            className="flex items-center justify-center gap-2 max-sm:w-14 max-sm:h-14 sm:px-4 sm:py-2 bg-[var(--surface-color)] text-[var(--text-color)] rounded-full border border-forest-outline/30 hover:bg-forest-surface-elevated transition-all shadow-md active:scale-95"
            title="Add Folder"
          >
            <FolderPlus size={24} className="sm:w-[18px] sm:h-[18px]" />
            <span className="hidden sm:inline">Add Folder</span>
          </button>
        </div>
      )}

      <AnimatePresence>
        {showUploadHint &&
          createPortal(
            <motion.div
              initial={{ opacity: 0, y: -20, x: "-50%" }}
              animate={{ opacity: 1, y: 0, x: "-50%" }}
              exit={{ opacity: 0, y: -20, x: "-50%" }}
              className="fixed top-12 left-1/2 z-[9999] bg-[var(--surface-color)] border border-blue-500/40 shadow-[0_8px_30px_rgb(0,0,0,0.12)] px-6 py-4 rounded-2xl flex items-center gap-4"
            >
              <div className="bg-blue-500/10 p-2 rounded-full">
                <Info size={24} className="text-blue-500" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-[var(--text-color)]">
                  Consejo de carga
                </span>
                <span className="text-sm text-[var(--text-variant)]">
                  {uploadFileCount > 1
                    ? "Espera unos 10-15 segundos para asegurar una carga completa de los archivos subidos."
                    : "Espera unos 10-15 segundos para asegurar una carga completa del archivo."}
                </span>
              </div>
              <button
                onClick={() => setShowUploadHint(false)}
                className="ml-2 p-1.5 bg-[var(--surface-color)] hover:bg-[var(--background-color)] rounded-full text-[var(--text-variant)] hover:text-[var(--text-color)] transition-colors border border-[var(--border-color)]"
              >
                <X size={16} />
              </button>
            </motion.div>,
            document.body,
          )}
      </AnimatePresence>

      <AnimatePresence>
        {rarQueue.length > 0 &&
          createPortal(
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-forest-surface p-6 rounded-2xl shadow-2xl max-w-sm w-full border border-white/10"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg text-white">
                    RAR/CBR Detected
                  </h3>
                  <button
                    onClick={handleSkipRar}
                    className="text-white/50 hover:text-white transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                <p className="text-white/70 text-sm mb-6">
                  RAR and CBR files can be slow to view in the browser. Would
                  you like to convert <strong>{rarQueue[0].file.name}</strong>{" "}
                  to CBZ or PDF? It will immediately download once ready.
                </p>

                {isConvertingRar ? (
                  <div className="flex flex-col items-center justify-center py-4 gap-3">
                    <Loader2
                      className="animate-spin text-forest-primary"
                      size={32}
                    />
                    <p className="text-sm text-forest-primary font-medium animate-pulse">
                      Converting...
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={() => handleRarConvert("cbz")}
                      className="flex justify-center items-center gap-2 w-full py-3 bg-[var(--primary-color)] text-[var(--on-primary-color)] font-medium rounded-xl hover:opacity-90 transition-all active:scale-95"
                    >
                      <FileDown size={18} />
                      Convert to CBZ
                    </button>
                    <button
                      onClick={() => handleRarConvert("pdf")}
                      className="flex justify-center items-center gap-2 w-full py-3 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-all active:scale-95"
                    >
                      <FileDown size={18} />
                      Convert to PDF
                    </button>
                    <button
                      onClick={handleSkipRar}
                      className="flex justify-center items-center gap-2 w-full py-3 bg-white/5 text-white font-medium rounded-xl hover:bg-white/10 transition-all active:scale-95"
                    >
                      Keep as is
                    </button>
                  </div>
                )}
              </motion.div>
            </motion.div>,
            document.body,
          )}
      </AnimatePresence>
    </>
  );
};
