/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from "react";
import { AppProvider } from "./AppContext";
import { Navbar } from "./components/Navbar";
import { FileExplorer } from "./components/FileExplorer";
import { FileUploader } from "./components/FileUploader";
import { FileViewer } from "./components/FileViewer";
import { motion, AnimatePresence } from "motion/react";
import { useApp } from "./AppContext";
import { Folder, Settings, X, CheckCircle2, Sparkles, Bomb, RefreshCw } from "lucide-react";
import { cn, formatFileSize } from "./lib/utils";

function AppContent() {
  const { state, dispatch } = useApp();
  const [showWelcome, setShowWelcome] = useState(false);
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const hasVisited = localStorage.getItem("hasVisited");
    if (!hasVisited) {
      setShowWelcome(true);
    } else {
      setShowWelcomeBack(true);
      setTimeout(() => setShowWelcomeBack(false), 3000);
    }
  }, []);

  const closeWelcome = () => {
    setShowWelcome(false);
    localStorage.setItem("hasVisited", "true");
  };

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg-color)] relative">
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 bottom-0 w-80 bg-[var(--surface-color)] border-r border-[var(--outline-color)]/30 shadow-2xl z-[210] p-6 flex flex-col"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-bold text-[var(--text-color)]">Arboreus</h2>
                <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-[var(--surface-elevated-color)] rounded-full transition-colors text-[var(--text-variant)] hover:text-[var(--text-color)]">
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto">
                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-[var(--text-variant)] uppercase tracking-wider mb-4">Uso de Almacenamiento</h3>
                  <div className="bg-[var(--primary-color)]/10 border border-[var(--primary-color)]/20 rounded-xl p-4 flex flex-col items-center justify-center gap-4">
                    <div className="flex flex-col items-center">
                      <span className="text-[var(--text-variant)] text-xs font-medium uppercase tracking-wider mb-1">Peso Total Subido</span>
                      <span className="text-2xl font-bold text-[var(--primary-color)]">
                        {formatFileSize(state.files.reduce((acc, f) => acc + f.size, 0))}
                      </span>
                    </div>
                    
                    <div className="flex flex-col gap-2 w-full">
                      <button
                        onClick={() => {
                          if (state.files.length === 0) {
                            alert('No hay archivos para eliminar.');
                            return;
                          }
                          if (window.confirm('¿Estás seguro de que quieres eliminar TODOS los archivos?')) {
                            dispatch({ type: "CLEAR_ALL" });
                          }
                        }}
                        className="w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg font-medium transition-colors group"
                        title="Eliminar todos los archivos"
                      >
                        <div className="relative">
                          <Bomb size={18} className="group-hover:scale-110 transition-transform" />
                          <motion.div
                            animate={{ 
                              scale: [1, 1.5, 1],
                              opacity: [1, 0.5, 1]
                            }}
                            transition={{
                              duration: 0.5,
                              repeat: Infinity,
                              ease: "linear"
                            }}
                            className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full"
                          />
                        </div>
                        Eliminar Todos los Archivos
                      </button>

                      <button
                        onClick={() => {
                          if (window.confirm('¿Estás seguro de que quieres refrescar la página? Todos los archivos temporales se perderán. (Esto sirve para refrescar la web en caso de un bug, ten en cuenta que tendrás que borrar los archivos y volver a subirlo si aún los necesitas)')) {
                            window.location.reload();
                          }
                        }}
                        className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                        title="Refrescar Página"
                      >
                        <RefreshCw size={18} />
                        Refrescar Página
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-[var(--text-variant)] uppercase tracking-wider mb-4">Tema de la App</h3>
                  <div className="flex flex-col gap-2">
                    {(['light', 'dark', 'system', 'default'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => {
                          dispatch({ type: "SET_THEME", payload: t as any });
                        }}
                        className={cn(
                          "w-full px-4 py-3 rounded-xl flex items-center justify-between text-sm font-medium transition-all capitalize",
                          state.theme === t 
                            ? "bg-[var(--primary-color)] text-[var(--on-primary-color)] shadow-md" 
                            : "bg-[var(--surface-elevated-color)] text-[var(--text-variant)] hover:bg-[var(--outline-color)]/20 hover:text-[var(--text-color)]"
                        )}
                      >
                        {t === 'default' ? 'Custom Theme' : t}
                        {state.theme === t && <CheckCircle2 size={16} />}
                      </button>
                    ))}
                  </div>
                </div>

                <h3 className="text-sm font-semibold text-[var(--text-variant)] uppercase tracking-wider mb-4">Funciones Disponibles</h3>
                <div className="flex flex-col gap-5">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="text-[var(--primary-color)] shrink-0 mt-0.5" size={20} />
                    <p className="text-sm text-[var(--text-variant)]"><strong className="text-[var(--text-color)]">Soporte Multiformato:</strong> Lee archivos PDF, ePub, CBZ, CBR, Word (.doc, .docx) y galerías de imágenes.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="text-[var(--primary-color)] shrink-0 mt-0.5" size={20} />
                    <p className="text-sm text-[var(--text-variant)]"><strong className="text-[var(--text-color)]">Conversión Inteligente:</strong> Convierte archivos RAR/CBR a CBZ y realiza conversiones de PDF a ePUB y PDF a DOCX.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="text-[var(--primary-color)] shrink-0 mt-0.5" size={20} />
                    <p className="text-sm text-[var(--text-variant)]"><strong className="text-[var(--text-color)]">Modos de Lectura:</strong> Disfruta de scroll vertical fluido o cambio de página horizontal.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="text-[var(--primary-color)] shrink-0 mt-0.5" size={20} />
                    <p className="text-sm text-[var(--text-variant)]"><strong className="text-[var(--text-color)]">Librería Organizada:</strong> Crea carpetas y organiza todos tus documentos de manera local.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showWelcomeBack && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-8 left-1/2 -translate-x-1/2 z-[200] bg-[var(--primary-color)] text-[var(--on-primary-color)] px-6 py-3 rounded-full shadow-2xl font-medium tracking-wide flex items-center gap-2"
          >
            <Sparkles size={18} />
            ¡Bienvenid@ de nuevo!
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showWelcome && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[var(--surface-color)] p-6 sm:p-8 rounded-3xl shadow-2xl max-w-md w-full border border-[var(--outline-color)]/30"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-[var(--text-color)] mb-2">¡Bienvenido a tu Biblioteca!</h2>
                  <p className="text-[var(--text-variant)] text-sm">Estas son las funciones que tienes disponibles:</p>
                </div>
                <button onClick={closeWelcome} className="p-2 hover:bg-[var(--surface-elevated-color)] rounded-full transition-colors text-[var(--text-variant)] hover:text-[var(--text-color)]">
                  <X size={20} />
                </button>
              </div>

              <div className="flex flex-col gap-4 mb-8">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="text-[var(--primary-color)] shrink-0 mt-0.5" size={20} />
                  <p className="text-sm text-[var(--text-variant)]"><strong className="text-[var(--text-color)]">Soporte Multiformato:</strong> Lee archivos PDF, ePub, CBZ, CBR, Word (.doc, .docx) y galerías de imágenes.</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="text-[var(--primary-color)] shrink-0 mt-0.5" size={20} />
                  <p className="text-sm text-[var(--text-variant)]"><strong className="text-[var(--text-color)]">Conversión Inteligente:</strong> Convierte archivos RAR/CBR a CBZ y realiza conversiones de PDF a ePUB y PDF a DOCX.</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="text-[var(--primary-color)] shrink-0 mt-0.5" size={20} />
                  <p className="text-sm text-[var(--text-variant)]"><strong className="text-[var(--text-color)]">Modos de Lectura:</strong> Disfruta de scroll vertical fluido o cambio de página horizontal.</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="text-[var(--primary-color)] shrink-0 mt-0.5" size={20} />
                  <p className="text-sm text-[var(--text-variant)]"><strong className="text-[var(--text-color)]">Librería Organizada:</strong> Crea carpetas y organiza todos tus documentos de manera local.</p>
                </div>
              </div>

              <button 
                onClick={closeWelcome}
                className="w-full py-3.5 bg-[var(--primary-color)] text-[var(--on-primary-color)] font-bold rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-lg"
              >
                Comenzar a usar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <Navbar onMenuClick={() => setIsSidebarOpen(true)} />
      
      <main className="flex-1 flex flex-col pt-4 pb-24 sm:pb-4">
        <div className="px-4 sm:px-6 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--text-color)]">
              {state.currentFolderId ? 
                state.folders.find(f => f.id === state.currentFolderId)?.name : 
                "My Library"
              }
            </h2>
            <p className="text-sm text-[var(--text-variant)]">
              {state.files.filter(f => f.parentId === state.currentFolderId).length} files • {state.folders.filter(f => f.parentId === state.currentFolderId).length} folders
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                const name = prompt("Folder name:");
                if (name) {
                  dispatch({ 
                    type: "ADD_FOLDER", 
                    payload: { 
                      id: crypto.randomUUID(), 
                      name, 
                      parentId: state.currentFolderId, 
                      createdAt: Date.now() 
                    } 
                  });
                }
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-[var(--surface-color)] text-[var(--text-color)] rounded-full border border-forest-outline/30 hover:bg-forest-surface-elevated transition-all shadow-md active:scale-95 text-sm font-medium"
            >
              New Folder
            </button>
            <FileUploader />
          </div>
        </div>

        <FileExplorer />
      </main>

      {/* Mobile Bottom Nav */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 h-20 bg-[var(--surface-color)]/95 backdrop-blur-md border-t border-forest-outline/10 px-6 flex items-center justify-center z-30">
        <button 
          onClick={() => dispatch({ type: "SET_CURRENT_FOLDER", payload: null })}
          className={cn("flex flex-col items-center gap-1 transition-all", !state.currentFolderId ? "text-forest-primary scale-110" : "text-[var(--text-variant)]")}
        >
          <div className={cn("px-8 py-2 rounded-full transition-all", !state.currentFolderId && "bg-forest-primary/20 shadow-sm")}>
             <Folder fill={!state.currentFolderId ? "currentColor" : "none"} strokeWidth={!state.currentFolderId ? 1.5 : 2} size={28} />
          </div>
          <span className="text-[12px] font-bold tracking-wide">Library</span>
        </button>
      </div>

      <AnimatePresence>
        {state.selectedFileId && <FileViewer />}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
