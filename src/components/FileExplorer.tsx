import React, { useState } from "react";
import { Folder, MoreVertical, ChevronRight, FileText, ImageIcon, Settings, Trash2, Download, Edit2, ExternalLink, Move, RefreshCw, FileArchive, FileType, BookOpen, CheckSquare, Square, X, CheckCircle2 } from "lucide-react";
import { useApp } from "../AppContext";
import { cn, formatFileSize, SUPPORTED_IMAGE_EXTENSIONS, SUPPORTED_DOC_EXTENSIONS, getFileExtension } from "../lib/utils";
import { VirtualFile, VirtualFolder } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { convertToCBZ, convertToPDF, convertToEPUB, convertPdfToDocx } from "../lib/conversion";
import { getFileBlob, getExtractedImages, saveFileBlob, saveExtractedImages } from "../lib/storage";
import { extractImagesFromBlob, extractImagesFromPdf } from "../lib/extractor";
import JSZip from "jszip";

export const FileExplorer: React.FC = () => {
  const { state, dispatch } = useApp();
  const [isConverting, setIsConverting] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, item: VirtualFile | VirtualFolder | null } | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const currentFolders = state.folders.filter(f => f.parentId === state.currentFolderId);
  const currentFiles = state.files.filter(f => 
    f.parentId === state.currentFolderId && 
    (state.searchQuery ? f.name.toLowerCase().includes(state.searchQuery.toLowerCase()) : true)
  );

  const handleToggleSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(selectedItems);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedItems(newSet);
  };

  const handleSelectAll = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const allIds = new Set<string>();
    currentFolders.forEach(f => allIds.add(f.id));
    currentFiles.forEach(f => allIds.add(f.id));
    setSelectedItems(allIds);
  };

  const clearSelection = () => {
    setSelectionMode(false);
    setSelectedItems(new Set());
  };

  const handleOpen = (item: VirtualFile | VirtualFolder) => {
    if ('extension' in item) {
      dispatch({ type: "SET_SELECTED_FILE", payload: item.id });
    } else {
      dispatch({ type: "SET_CURRENT_FOLDER", payload: item.id });
    }
  };

  const handleContextMenu = (e: React.MouseEvent, item: VirtualFile | VirtualFolder) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  };

  const getOrExtractBlobs = async (file: VirtualFile): Promise<Blob[]> => {
    let blobs = await getExtractedImages(file.id);
    if (blobs.length > 0) return blobs;

    const fileBlob = await getFileBlob(file.id);
    if (!fileBlob) return [];

    try {
      if (file.extension === 'pdf') {
        blobs = await extractImagesFromPdf(fileBlob);
      } else {
        blobs = await extractImagesFromBlob(fileBlob);
      }
      
      if (blobs.length > 0) {
        await saveExtractedImages(file.id, blobs);
      }
      return blobs;
    } catch (e) {
      console.error("Extraction failed", e);
      return [];
    }
  };

  const navigateUp = () => {
    if (state.currentFolderId) {
      const current = state.folders.find(f => f.id === state.currentFolderId);
      dispatch({ type: "SET_CURRENT_FOLDER", payload: current?.parentId || null });
    }
  };

  const breadcrumbs = [];
  let tempId = state.currentFolderId;
  while (tempId) {
    const f = state.folders.find(folder => folder.id === tempId);
    if (f) {
      breadcrumbs.unshift(f);
      tempId = f.parentId;
    } else break;
  }

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6" onClick={() => setContextMenu(null)}>
      {/* Header / Breadcrumbs */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-2">
        {!selectionMode ? (
          <div className="flex items-center gap-2 text-sm font-medium overflow-x-auto no-scrollbar">
            <button 
              onClick={() => dispatch({ type: "SET_CURRENT_FOLDER", payload: null })}
              className={cn("hover:text-[var(--primary-color)] transition-colors", !state.currentFolderId && "text-[var(--primary-color)]")}
            >
              My Files
            </button>
            {breadcrumbs.map((b, i) => (
              <React.Fragment key={b.id}>
                <ChevronRight size={14} className="text-[var(--text-variant)] shrink-0" />
                <button 
                  onClick={() => dispatch({ type: "SET_CURRENT_FOLDER", payload: b.id })}
                  className={cn("hover:text-[var(--primary-color)] transition-colors whitespace-nowrap", i === breadcrumbs.length - 1 && "text-[var(--primary-color)]")}
                >
                  {b.name}
                </button>
              </React.Fragment>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-4 text-sm font-medium whitespace-nowrap">
            <button onClick={() => { setSelectionMode(false); setSelectedItems(new Set()); }} className="p-1 hover:bg-forest-outline/10 rounded-lg">
              <X size={20} />
            </button>
            <span className="text-[var(--primary-color)]">{selectedItems.size} seleccionados</span>
          </div>
        )}

        <div className="flex items-center gap-2 ml-auto">
        </div>
      </div>

      {state.viewMode === "grid" ? (
        <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-4">
          {currentFolders.map(folder => (
            <motion.div
              layout
              key={folder.id}
              onClick={(e) => {
                if (selectionMode) { e.preventDefault(); handleToggleSelection(folder.id, e as unknown as React.MouseEvent); }
                else handleOpen(folder);
              }}
              onContextMenu={(e) => { if (!selectionMode) handleContextMenu(e, folder); }}
              className="flex flex-col items-center gap-2 p-3 rounded-[var(--radius-m3)] hover:bg-forest-surface-elevated cursor-pointer transition-colors group relative"
            >
              {selectionMode && (
                <div className="absolute top-2 left-2 z-10 text-[var(--primary-color)]">
                  {selectedItems.has(folder.id) ? <CheckSquare size={20} className="fill-[var(--surface-color)] bg-[var(--surface-color)] rounded-sm" /> : <Square size={20} className="text-[var(--text-variant)] fill-[var(--surface-color)] bg-[var(--surface-color)] rounded-sm" />}
                </div>
              )}
              <div className={cn("w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center bg-forest-primary/10 rounded-2xl group-hover:bg-forest-primary/20 transition-all", selectedItems.has(folder.id) && "ring-2 ring-[var(--primary-color)]")}>
                <Folder className="text-forest-primary" size={32} fill="currentColor" fillOpacity={0.2} />
              </div>
              <span className="text-xs sm:text-sm font-medium text-center line-clamp-2 px-1">{folder.name}</span>
            </motion.div>
          ))}
          {currentFiles.map(file => (
            <motion.div
              layout
              key={file.id}
              onClick={(e) => {
                if (selectionMode) { e.preventDefault(); handleToggleSelection(file.id, e as unknown as React.MouseEvent); }
                else handleOpen(file);
              }}
              onContextMenu={(e) => { if (!selectionMode) handleContextMenu(e, file); }}
              className="flex flex-col items-center gap-2 p-3 rounded-[var(--radius-m3)] hover:bg-forest-surface-elevated cursor-pointer transition-colors group relative"
            >
              {selectionMode && (
                <div className="absolute top-2 left-2 z-10 text-[var(--primary-color)]">
                  {selectedItems.has(file.id) ? <CheckSquare size={20} className="fill-[var(--surface-color)] bg-[var(--surface-color)] rounded-sm" /> : <Square size={20} className="text-[var(--text-variant)] fill-[var(--surface-color)] bg-[var(--surface-color)] rounded-sm" />}
                </div>
              )}
              <div className={cn("w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center bg-forest-secondary/10 rounded-2xl group-hover:bg-forest-secondary/20 transition-all overflow-hidden border border-forest-outline/5", selectedItems.has(file.id) && "ring-2 ring-[var(--primary-color)]")}>
                {SUPPORTED_IMAGE_EXTENSIONS.includes(file.extension) && file.objectUrl ? (
                  <img src={file.objectUrl} alt={file.name} className="w-full h-full object-cover" />
                ) : file.extension === 'pdf' ? (
                  <FileText className="text-forest-secondary" size={32} />
                ) : file.extension === 'epub' ? (
                  <BookOpen className="text-forest-secondary" size={32} />
                ) : SUPPORTED_IMAGE_EXTENSIONS.includes(file.extension) ? (
                  <ImageIcon className="text-forest-secondary" size={32} />
                ) : (
                  <FileText className="text-forest-secondary" size={32} />
                )}
              </div>
              <span className="text-xs sm:text-sm font-medium text-center line-clamp-2 px-1 text-[var(--text-color)]">{file.name}</span>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col bg-[var(--surface-color)] rounded-[var(--radius-m3)] overflow-hidden border border-forest-outline/10 shadow-sm">
          {currentFolders.length === 0 && currentFiles.length === 0 && (
            <div className="p-12 text-center text-[var(--text-variant)]">No files here yet. Upload some!</div>
          )}
          {currentFolders.map(folder => (
            <div
              key={folder.id}
              onClick={(e) => {
                if (selectionMode) { e.preventDefault(); handleToggleSelection(folder.id, e as unknown as React.MouseEvent); }
                else handleOpen(folder);
              }}
              onContextMenu={(e) => { if (!selectionMode) handleContextMenu(e, folder); }}
              className={cn("flex items-center gap-4 p-4 hover:bg-forest-surface-elevated cursor-pointer transition-colors border-b border-forest-outline/5 last:border-0", selectedItems.has(folder.id) && "bg-forest-primary/5")}
            >
              {selectionMode && (
                <div className="text-[var(--primary-color)]">
                  {selectedItems.has(folder.id) ? <CheckSquare size={20} /> : <Square size={20} className="text-[var(--text-variant)]" />}
                </div>
              )}
              <Folder className="text-forest-primary" size={24} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{folder.name}</div>
                <div className="text-xs text-[var(--text-variant)]">Folder</div>
              </div>
            </div>
          ))}
          {currentFiles.map(file => (
            <div
              key={file.id}
              onClick={(e) => {
                if (selectionMode) { e.preventDefault(); handleToggleSelection(file.id, e as unknown as React.MouseEvent); }
                else handleOpen(file);
              }}
              onContextMenu={(e) => { if (!selectionMode) handleContextMenu(e, file); }}
              className={cn("flex items-center gap-4 p-4 hover:bg-forest-surface-elevated cursor-pointer transition-colors border-b border-forest-outline/5 last:border-0", selectedItems.has(file.id) && "bg-forest-primary/5")}
            >
              {selectionMode && (
                <div className="text-[var(--primary-color)]">
                  {selectedItems.has(file.id) ? <CheckSquare size={20} /> : <Square size={20} className="text-[var(--text-variant)]" />}
                </div>
              )}
              <div className="w-10 h-10 flex items-center justify-center bg-forest-secondary/10 rounded-lg group-hover:bg-forest-secondary/20 transition-all overflow-hidden shrink-0">
                {SUPPORTED_IMAGE_EXTENSIONS.includes(file.extension) ? (
                  <img src={file.objectUrl} alt={file.name} className="w-full h-full object-cover" />
                ) : file.extension === 'epub' ? (
                  <BookOpen className="text-forest-secondary" size={20} />
                ) : <FileText className="text-forest-secondary" size={20} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{file.name}</div>
                <div className="text-xs text-[var(--text-variant)]">{file.extension.toUpperCase()} • {formatFileSize(file.size)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Context Menu */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{ top: contextMenu.y, left: contextMenu.x }}
            className="fixed z-50 min-w-48 bg-forest-surface-elevated border border-forest-outline/20 rounded-2xl shadow-2xl overflow-hidden py-2"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => {
                if (contextMenu.item) handleOpen(contextMenu.item);
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-forest-primary/10 transition-colors text-sm"
            >
              <ExternalLink size={16} /> Open
            </button>
            <button 
              onClick={() => {
                if (contextMenu.item && 'extension' in contextMenu.item) {
                  const a = document.createElement('a');
                  a.href = contextMenu.item.objectUrl;
                  a.download = contextMenu.item.name;
                  a.click();
                }
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-forest-primary/10 transition-colors text-sm"
            >
              <Download size={16} /> Download
            </button>
            <button 
              onClick={() => {
                const newName = prompt("Enter new name:", contextMenu.item?.name);
                if (newName && contextMenu.item) {
                  const type = 'extension' in contextMenu.item ? "RENAME_FILE" : "RENAME_FOLDER";
                  dispatch({ type: type as any, payload: { id: contextMenu.item.id, name: newName } });
                }
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-forest-primary/10 transition-colors text-sm"
            >
              <Edit2 size={16} /> Rename
            </button>
            <button 
              onClick={() => {
                if (contextMenu.item) {
                  const type = 'extension' in contextMenu.item ? "MOVE_FILE" : "MOVE_FOLDER";
                  // Simple move to root for demo, or we could add a picker
                  const newParentId = prompt("Enter parent folder ID (or leave empty for root):", contextMenu.item.parentId || "");
                  dispatch({ type: type as any, payload: { id: contextMenu.item.id, newParentId: newParentId || null } });
                }
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-forest-primary/10 transition-colors text-sm"
            >
              <Move size={16} /> Move
            </button>

            {contextMenu.item && 'extension' in contextMenu.item && (contextMenu.item.extension === 'rar' || contextMenu.item.extension === 'cbr') && (
              <>
                <div className="h-px bg-forest-outline/10 my-1" />
                <button 
                  disabled={isConverting}
                  onClick={async () => {
                    const file = contextMenu.item as VirtualFile;
                    setIsConverting(true);
                    setContextMenu(null);
                    
                    try {
                      const blobs = await getOrExtractBlobs(file);

                      if (blobs.length > 0) {
                        const cbzBlob = await convertToCBZ(file, blobs);
                        const newId = crypto.randomUUID();
                        await saveFileBlob(newId, cbzBlob);
                        await saveExtractedImages(newId, blobs);
                        
                        dispatch({
                          type: "ADD_FILES",
                          payload: [{
                            id: newId,
                            name: file.name.replace(/\.(rar|cbr)$/i, '.cbz'),
                            extension: 'cbz',
                            size: cbzBlob.size,
                            type: 'application/x-cbz',
                            parentId: file.parentId,
                            lastModified: Date.now(),
                            objectUrl: URL.createObjectURL(cbzBlob),
                            extractedImages: blobs.map(b => URL.createObjectURL(b))
                          }]
                        });
                        alert("Successfully converted to CBZ!");
                      } else {
                        alert("Could not extract any images. The file might be encrypted or unsupported.");
                      }
                    } finally {
                      setIsConverting(false);
                    }
                  }}
                  className={cn("w-full flex items-center gap-3 px-4 py-2.5 hover:bg-forest-primary/10 transition-colors text-sm text-forest-primary font-medium", isConverting && "opacity-50 pointer-events-none")}
                >
                  {isConverting ? <RefreshCw size={16} className="animate-spin" /> : <FileArchive size={16} />}
                  Convert to CBZ
                </button>
                <button 
                  disabled={isConverting}
                  onClick={async () => {
                    const file = contextMenu.item as VirtualFile;
                    setIsConverting(true);
                    setContextMenu(null);

                    try {
                      const blobs = await getOrExtractBlobs(file);

                      if (blobs.length > 0) {
                        const pdfBlob = await convertToPDF(file, blobs);
                        const newId = crypto.randomUUID();
                        await saveFileBlob(newId, pdfBlob);
                        await saveExtractedImages(newId, blobs);
                        
                        dispatch({
                          type: "ADD_FILES",
                          payload: [{
                            id: newId,
                            name: file.name.replace(/\.(rar|cbr)$/i, '.pdf'),
                            extension: 'pdf',
                            size: pdfBlob.size,
                            type: 'application/pdf',
                            parentId: file.parentId,
                            lastModified: Date.now(),
                            objectUrl: URL.createObjectURL(pdfBlob),
                            extractedImages: blobs.map(b => URL.createObjectURL(b))
                          }]
                        });
                        alert("Successfully converted to PDF!");
                      } else {
                        alert("Could not extract any images. The file might be encrypted or unsupported.");
                      }
                    } finally {
                      setIsConverting(false);
                    }
                  }}
                  className={cn("w-full flex items-center gap-3 px-4 py-2.5 hover:bg-forest-primary/10 transition-colors text-sm text-forest-primary font-medium", isConverting && "opacity-50 pointer-events-none")}
                >
                  {isConverting ? <RefreshCw size={16} className="animate-spin" /> : <FileType size={16} />}
                  Convert to PDF
                </button>
              </>
            )}

            {contextMenu.item && 'extension' in contextMenu.item && contextMenu.item.extension === 'pdf' && (
              <>
                <div className="h-px bg-forest-outline/10 my-1" />
                <button 
                  disabled={isConverting}
                  onClick={async () => {
                    const file = contextMenu.item as VirtualFile;
                    setIsConverting(true);
                    setContextMenu(null);

                    try {
                      const docxBlob = await convertPdfToDocx(file);
                      const newId = crypto.randomUUID();
                      await saveFileBlob(newId, docxBlob);
                      
                      dispatch({
                        type: "ADD_FILES",
                        payload: [{
                          id: newId,
                          name: file.name.replace(/\.pdf$/i, '.docx'),
                          extension: 'docx',
                          size: docxBlob.size,
                          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                          parentId: file.parentId,
                          lastModified: Date.now(),
                          objectUrl: URL.createObjectURL(docxBlob),
                          extractedImages: []
                        }]
                      });
                      alert("Successfully converted PDF to DOCX!");
                    } catch (err) {
                      console.error(err);
                      alert("Could not convert the PDF to DOCX.");
                    } finally {
                      setIsConverting(false);
                    }
                  }}
                  className={cn("w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--primary-color)]/10 transition-colors text-sm text-[var(--primary-color)] font-medium", isConverting && "opacity-50 pointer-events-none")}
                >
                  {isConverting ? <RefreshCw size={16} className="animate-spin" /> : <FileText size={16} />}
                  Convert to DOCX
                </button>
                <button 
                  disabled={isConverting}
                  onClick={async () => {
                    const file = contextMenu.item as VirtualFile;
                    setIsConverting(true);
                    setContextMenu(null);

                    try {
                      const blobs = await getOrExtractBlobs(file);
                      if (blobs.length > 0) {
                        const epubBlob = await convertToEPUB(file, blobs);
                        const newId = crypto.randomUUID();
                        await saveFileBlob(newId, epubBlob);
                        await saveExtractedImages(newId, blobs);
                        
                        dispatch({
                          type: "ADD_FILES",
                          payload: [{
                            id: newId,
                            name: file.name.replace(/\.pdf$/i, '.epub'),
                            extension: 'epub',
                            size: epubBlob.size,
                            type: 'application/epub+zip',
                            parentId: file.parentId,
                            lastModified: Date.now(),
                            objectUrl: URL.createObjectURL(epubBlob),
                            extractedImages: blobs.map(b => URL.createObjectURL(b))
                          }]
                        });
                        alert("Successfully converted PDF to EPUB!");
                      } else {
                        alert("Could not extract any images. The file might be unsupported.");
                      }
                    } finally {
                      setIsConverting(false);
                    }
                  }}
                  className={cn("w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--primary-color)]/10 transition-colors text-sm text-[var(--primary-color)] font-medium", isConverting && "opacity-50 pointer-events-none")}
                >
                  {isConverting ? <RefreshCw size={16} className="animate-spin" /> : <BookOpen size={16} />}
                  Convert to EPUB
                </button>
              </>
            )}
            <div className="h-px bg-forest-outline/10 my-1" />
            <button 
              onClick={() => {
                if (contextMenu.item) {
                  const type = 'extension' in contextMenu.item ? "DELETE_FILE" : "DELETE_FOLDER";
                  dispatch({ type: type as any, payload: contextMenu.item.id });
                }
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-red-500/10 text-red-500 transition-colors text-sm"
            >
              <Trash2 size={16} /> Delete Permanently
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
