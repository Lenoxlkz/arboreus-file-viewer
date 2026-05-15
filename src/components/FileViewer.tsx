import React, { useState, useEffect, useRef } from "react";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, Loader2, Settings, ArrowDownUp, ArrowLeftRight } from "lucide-react";
import { useApp } from "../AppContext";
import { SUPPORTED_IMAGE_EXTENSIONS, getFileExtension } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import { getFileBlob, getExtractedImages, saveExtractedImages } from "../lib/storage";
import { extractImagesFromBlob, extractImagesFromPdf } from "../lib/extractor";
import * as pdfjs from 'pdfjs-dist';
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import ePub from "epubjs";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

export const FileViewer: React.FC = () => {
  const { state, dispatch } = useApp();
  const [zoom, setZoom] = useState(100);
  const [currentPage, setCurrentPage] = useState(0);
  const [isContinuous, setIsContinuous] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [autoScrollSpeed, setAutoScrollSpeed] = useState<number>(0);
  const viewerRef = useRef<HTMLDivElement>(null);
  const epubContainerRef = useRef<HTMLDivElement>(null);
  const [epubRendition, setEpubRendition] = useState<any>(null);
  const [fileHtml, setFileHtml] = useState<string | null>(null);

  const file = state.files.find(f => f.id === state.selectedFileId);
  
  useEffect(() => {
    if (!file) return;

    const hydrate = async () => {
      setIsLoading(true);
      try {
        // If the file session URL or extracted images are missing, restore them
        if (!file.objectUrl || (file.extractedImages === undefined && ["cbz", "cbr", "rar", "pdf", "epub"].includes(file.extension))) {
          const blob = await getFileBlob(file.id);
          if (!blob) throw new Error("File not found in storage");

          const url = URL.createObjectURL(blob);
          const ext = file.extension;
          let extractedImages: string[] | undefined = undefined;

          // Try loading from IDB first
          const cachedImageBlobs = await getExtractedImages(file.id);
          if (cachedImageBlobs.length > 0) {
            extractedImages = cachedImageBlobs.map(b => URL.createObjectURL(b));
          } else {
            // Extraction logic
            if (["cbz", "cbr", "rar"].includes(ext)) {
              const imageBlobs = await extractImagesFromBlob(blob);
              extractedImages = imageBlobs.map(b => URL.createObjectURL(b));
              await saveExtractedImages(file.id, imageBlobs);
            } else if (ext === "pdf") {
              const pdfImageBlobs = await extractImagesFromPdf(blob);
              extractedImages = pdfImageBlobs.map(b => URL.createObjectURL(b));
              await saveExtractedImages(file.id, pdfImageBlobs);
            } else if (ext === "epub") {
              // We do not extract images for epub; we just load it via epubjs later
              extractedImages = []; 
            } else if (ext === "doc" || ext === "docx") {
              const arrayBuffer = await blob.arrayBuffer();
              const mammoth = await import("mammoth");
              const result = await mammoth.convertToHtml({ arrayBuffer });
              setFileHtml(result.value);
            }
          }

          dispatch({ type: "UPDATE_FILE_URL", payload: { id: file.id, url, extractedImages } });
        } else if (file.extension === "doc" || file.extension === "docx") {
          const blob = await getFileBlob(file.id);
          if (blob) {
            const arrayBuffer = await blob.arrayBuffer();
            const mammoth = await import("mammoth");
            const result = await mammoth.convertToHtml({ arrayBuffer });
            setFileHtml(result.value);
          }
        }
      } catch (e) {
        console.error("Hydration failed", e);
      } finally {
        setIsLoading(false);
      }
    };

    hydrate();
  }, [file?.id]);

  let images = file?.extractedImages || [];
  let initialIndex = 0;

  if (file && images.length === 0 && file.objectUrl) {
    if (SUPPORTED_IMAGE_EXTENSIONS.includes(file.extension)) {
      const siblings = state.files
        .filter(f => f.parentId === file.parentId && SUPPORTED_IMAGE_EXTENSIONS.includes(f.extension))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      
      images = siblings.map(f => f.objectUrl).filter((url): url is string => !!url);
      initialIndex = siblings.findIndex(f => f.id === file.id);
      if (initialIndex === -1) initialIndex = 0;
    } else {
      images = [file.objectUrl];
    }
  }

  useEffect(() => {
    if (!file) return;
    setCurrentPage(initialIndex);
    if (isContinuous && initialIndex > 0) {
      setTimeout(() => {
        document.getElementById(`page-${initialIndex}`)?.scrollIntoView({ behavior: 'instant' });
      }, 100);
    }
  }, [file?.id, initialIndex, isContinuous]);

  useEffect(() => {
    // If epub isn't loaded yet or we are loading, return early.
    if (file?.extension === 'epub' && file.objectUrl && epubContainerRef.current && !isLoading) {
      const book = ePub();
      
      let isMounted = true;

      const loadEpub = async () => {
        try {
          const res = await fetch(file.objectUrl!);
          const buffer = await res.arrayBuffer();
          await book.open(buffer, "binary");
          
          if (!isMounted || !epubContainerRef.current) return;
          
          const rendition = book.renderTo(epubContainerRef.current, {
            manager: isContinuous ? "continuous" : "default",
            flow: isContinuous ? "scrolled" : "paginated",
            width: "100%",
            height: "100%",
            spread: "none",
          });
          
          rendition.themes.fontSize(`${zoom}%`);
          await rendition.display();
          
          if (isMounted) {
            setEpubRendition(rendition);
          }
        } catch (err) {
          console.error(err);
        }
      };
      
      loadEpub();

      return () => {
        isMounted = false;
        book.destroy();
        setEpubRendition(null);
      };
    }
  }, [file?.objectUrl, file?.extension, isLoading, isContinuous]);

  useEffect(() => {
    if (epubRendition && file?.extension === 'epub') {
      epubRendition.themes.fontSize(`${zoom}%`);
    }
  }, [zoom, epubRendition, file?.extension]);

  // Auto-scroll logic
  useEffect(() => {
    if (autoScrollSpeed === 0) return;
    
    let timeoutId: NodeJS.Timeout;
    let rAFId: number;
    let lastTime = performance.now();

    const startScrolling = () => {
       if (isContinuous || file?.extension === 'doc' || file?.extension === 'docx') {
         const loop = (time: number) => {
           const delta = time - lastTime;
           lastTime = time;
           if (viewerRef.current) {
               viewerRef.current.scrollTop += autoScrollSpeed * (delta / 16);
           }
           // Try to scroll iframe if it's epub in continuous mode
           if (file?.extension === 'epub' && epubRendition) {
             try {
               const iframe = epubContainerRef.current?.querySelector('iframe');
               if (iframe?.contentWindow) {
                 iframe.contentWindow.scrollBy(0, autoScrollSpeed * (delta / 16));
               }
             } catch (e) {}
           }
           rAFId = requestAnimationFrame(loop);
         };
         lastTime = performance.now();
         rAFId = requestAnimationFrame(loop);
       } else {
         const flipPage = () => {
           if (file?.extension === 'epub' && epubRendition) {
              epubRendition.next();
           } else {
              setCurrentPage(p => {
                const maxPage = images.length > 0 ? images.length - 1 : 0;
                return p < maxPage ? p + 1 : p;
              });
           }
           timeoutId = setTimeout(flipPage, Math.max(1000, 5000 / autoScrollSpeed));
         };
         timeoutId = setTimeout(flipPage, Math.max(1000, 5000 / autoScrollSpeed));
       }
    };

    const delayTimeout = setTimeout(() => {
      startScrolling();
    }, 1000);

    return () => {
       clearTimeout(delayTimeout);
       clearTimeout(timeoutId);
       if (rAFId) cancelAnimationFrame(rAFId);
    };
  }, [autoScrollSpeed, isContinuous, file?.extension, images.length, epubRendition]);

  if (!file) return null;

  const handleClose = () => dispatch({ type: "SET_SELECTED_FILE", payload: null });
  const isImageOnly = SUPPORTED_IMAGE_EXTENSIONS.includes(file.extension);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col"
    >
      {/* Toolbar */}
      <div className="h-16 flex items-center justify-between px-4 bg-forest-bg text-white border-b border-white/10">
        <div className="flex items-center gap-3 overflow-hidden">
          <button onClick={handleClose} className="p-2 hover:bg-white/10 rounded-full transition-colors shrink-0">
            <X size={20} />
          </button>
          <div className="flex flex-col min-w-0">
            <h2 className="text-sm font-medium truncate">{file.name}</h2>
            <p className="text-[10px] text-white/50 uppercase tracking-wider">{file.extension}</p>
          </div>
        </div>

        {!isLoading && (
          <div className="flex items-center gap-1 sm:gap-4">
            <div className="hidden sm:flex items-center bg-white/10 rounded-full px-2">
              <button onClick={() => setZoom(Math.max(25, zoom - 25))} className="p-2 hover:text-forest-primary transition-colors"><ZoomOut size={18} /></button>
              <span className="text-xs font-mono w-10 text-center">{zoom}%</span>
              <button onClick={() => setZoom(Math.min(400, zoom + 25))} className="p-2 hover:text-forest-primary transition-colors"><ZoomIn size={18} /></button>
            </div>
            
            {(images.length > 1 || file.extension === 'epub') && (
              <div className="relative">
                <button 
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-2 rounded-full transition-all hover:bg-white/10 text-white/70"
                >
                  <Settings size={20} />
                </button>

                <AnimatePresence>
                  {showSettings && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="absolute right-0 top-full mt-2 w-48 bg-forest-surface border border-white/10 rounded-xl shadow-2xl overflow-hidden py-1 z-50 text-sm"
                    >
                      <button 
                        onClick={() => { setIsContinuous(true); setShowSettings(false); }}
                        className="flex items-center w-full px-4 py-2 hover:bg-white/5 transition-colors"
                      >
                        <ArrowDownUp size={16} className={cn("mr-3", isContinuous ? "text-forest-primary" : "text-white/50")} />
                        <span className={cn(isContinuous ? "text-forest-primary font-medium" : "text-white/70")}>Scroll Vertical</span>
                      </button>
                      <button 
                        onClick={() => { setIsContinuous(false); setShowSettings(false); }}
                        className="flex items-center w-full px-4 py-2 hover:bg-white/5 transition-colors"
                      >
                        <ArrowLeftRight size={16} className={cn("mr-3", !isContinuous ? "text-forest-primary" : "text-white/50")} />
                        <span className={cn(!isContinuous ? "text-forest-primary font-medium" : "text-white/70")}>Scroll Horizontal</span>
                      </button>

                      <div className="flex flex-col border-t border-white/10 mt-1 pt-1 pb-1 px-4">
                        <span className="text-white/50 text-[10px] uppercase tracking-wider mb-2 mt-1">Auto Scroll Velocidad</span>
                        <select 
                          value={autoScrollSpeed} 
                          onChange={e => { setAutoScrollSpeed(Number(e.target.value)); setShowSettings(false); }}
                          className="bg-black/50 border border-white/20 text-white rounded-lg px-2 py-1.5 text-xs w-full focus:outline-none focus:border-forest-primary transition-colors cursor-pointer appearance-none"
                        >
                          <option value={0}>Desactivado (default)</option>
                          <option value={0.5}>x0.5</option>
                          <option value={1}>x1</option>
                          <option value={1.5}>x1.5</option>
                          <option value={2}>x2</option>
                          <option value={2.5}>x2.5</option>
                          <option value={3}>x3</option>
                          <option value={4}>x4</option>
                          <option value={6}>x6</option>
                          <option value={8}>x8</option>
                        </select>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            <button 
              onClick={() => {
                const a = document.createElement('a');
                a.href = file.objectUrl || "";
                a.download = file.name;
                a.click();
              }}
              className="p-2 hover:bg-white/10 rounded-full transition-colors hidden xs:block"
            >
              <Download size={20} />
            </button>
          </div>
        )}
      </div>

      {/* Main Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-white/50 gap-4">
            <Loader2 className="animate-spin text-forest-primary" size={48} />
            <p className="text-sm font-medium animate-pulse">Processing file...</p>
          </div>
        ) : (
          <>
            {/* Sidebar Miniatures */}
            {(images.length > 1) && (
              <div className="hidden md:flex flex-col w-48 border-r border-white/10 overflow-y-auto no-scrollbar p-4 gap-4 bg-black/40">
                {images.map((img, i) => (
                  <button 
                    key={i} 
                    onClick={() => {
                      setCurrentPage(i);
                      if (isContinuous) {
                        document.getElementById(`page-${i}`)?.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                    className={cn(
                      "relative aspect-[2/3] rounded-lg overflow-hidden border-2 transition-all shrink-0",
                      currentPage === i ? "border-forest-primary scale-105 shadow-lg shadow-forest-primary/20" : "border-transparent opacity-50 hover:opacity-100"
                    )}
                  >
                    <img src={img} alt={`Thumbnail ${i + 1}`} className="w-full h-full object-cover" />
                    <span className="absolute bottom-1 right-1 bg-black/60 text-[10px] px-1.5 rounded-sm">{i + 1}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Viewport */}
            <div ref={viewerRef} className={cn("flex-1 overflow-auto no-scrollbar bg-black relative", autoScrollSpeed === 0 && "scroll-smooth")}>
              {file.extension === 'epub' ? (
                <div className="w-full h-full bg-white relative">
                  <div ref={epubContainerRef} className="w-full h-full" />
                  
                  {/* ePub Nav Overlay */}
                  {!isContinuous && (
                    <div className="absolute inset-x-0 inset-y-0 pointer-events-none flex justify-between px-4 sm:px-8 items-center z-[110]">
                      <button 
                        onClick={() => epubRendition?.prev()}
                        className="p-4 bg-black/20 hover:bg-black/60 text-white rounded-full transition-all pointer-events-auto"
                      >
                        <ChevronLeft size={32} />
                      </button>
                      <button 
                        onClick={() => epubRendition?.next()}
                        className="p-4 bg-black/20 hover:bg-black/60 text-white rounded-full transition-all pointer-events-auto"
                      >
                        <ChevronRight size={32} />
                      </button>
                    </div>
                  )}
                </div>
              ) : file.extension === 'doc' || file.extension === 'docx' ? (
                <div className="w-full h-full bg-white text-black overflow-auto relative p-8 sm:p-12">
                   <div 
                     dangerouslySetInnerHTML={{ __html: fileHtml || "" }} 
                     className="max-w-4xl mx-auto prose prose-sm sm:prose-base document-content" 
                     style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
                   />
                </div>
              ) : isContinuous ? (
                <div className="flex flex-col items-center py-8 gap-4">
                  {images.map((img, i) => (
                    <div key={i} id={`page-${i}`} className="max-w-full flex justify-center">
                      <img 
                        src={img} 
                        alt={`Page ${i + 1}`} 
                        loading="lazy"
                        style={{ width: `${zoom}%` }}
                        className="max-w-[95vw] shadow-2xl"
                        onLoad={() => {
                           // Set current page based on scroll position could be added here
                        }}
                      />
                    </div>
                  ))}
                  {images.length === 0 && (
                     <div className="text-white/30 text-sm">No displayable content found.</div>
                  )}
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center relative p-8">
                  <AnimatePresence mode="wait">
                    <motion.img
                      key={currentPage}
                      initial={{ x: 300, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: -300, opacity: 0 }}
                      transition={{ type: "spring", damping: 20, stiffness: 100 }}
                      src={images[currentPage]}
                      alt={`Page ${currentPage + 1}`}
                      style={{ width: `${zoom}%` }}
                      className="max-h-full max-w-full object-contain shadow-2xl select-none"
                    />
                  </AnimatePresence>

                  {/* Nav Overlay */}
                  <div className="absolute inset-x-0 inset-y-0 pointer-events-none flex justify-between px-4 sm:px-8 items-center">
                    <button 
                      onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                      disabled={currentPage === 0}
                      className="p-4 bg-black/20 hover:bg-black/60 text-white rounded-full transition-all pointer-events-auto disabled:opacity-0"
                    >
                      <ChevronLeft size={32} />
                    </button>
                    <button 
                      onClick={() => setCurrentPage(Math.min(images.length - 1, currentPage + 1))}
                      disabled={currentPage === images.length - 1}
                      className="p-4 bg-black/20 hover:bg-black/60 text-white rounded-full transition-all pointer-events-auto disabled:opacity-0"
                    >
                      <ChevronRight size={32} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Footer / Info */}
      {!isLoading && images.length > 1 && (
        <div className="h-10 bg-forest-bg/80 backdrop-blur-sm border-t border-white/5 px-4 flex items-center justify-center text-[10px] text-white/50 gap-2">
          <span>Page {currentPage + 1} of {images.length}</span>
          <div className="w-32 h-1 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-forest-primary transition-all duration-300" 
              style={{ width: `${((currentPage + 1) / images.length) * 100}%` }}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
};
