import React, { createContext, useContext, useReducer, useEffect } from "react";
import { AppState, AppAction, Theme, VirtualFile, VirtualFolder } from "./types";
import { saveAppMetadata, loadAppMetadata, deleteFileBlob, clearAllStorage } from "./lib/storage";

const initialState: AppState = {
  files: [],
  folders: [],
  currentFolderId: null,
  viewMode: "grid",
  theme: Theme.DARK,
  selectedFileId: null,
  searchQuery: "",
  isHydrated: false,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "REPLACE_STATE":
      return { ...state, ...action.payload, isHydrated: true };
    case "ADD_FILES":
      return { ...state, files: [...state.files, ...action.payload] };
    case "ADD_FOLDER":
      return { ...state, folders: [...state.folders, action.payload] };
    case "UPDATE_FILE_URL":
      return {
        ...state,
        files: state.files.map(f => f.id === action.payload.id ? { 
          ...f, 
          objectUrl: action.payload.url, 
          extractedImages: action.payload.extractedImages || f.extractedImages 
        } : f)
      };
    case "DELETE_FILE": {
      const fileToDelete = state.files.find(f => f.id === action.payload);
      if (fileToDelete) {
        if (fileToDelete.objectUrl) URL.revokeObjectURL(fileToDelete.objectUrl);
        if (fileToDelete.extractedImages) {
          fileToDelete.extractedImages.forEach(url => URL.revokeObjectURL(url));
        }
        deleteFileBlob(fileToDelete.id);
      }
      return { ...state, files: state.files.filter(f => f.id !== action.payload) };
    }
    case "DELETE_FOLDER": {
      const childFiles = state.files.filter(f => f.parentId === action.payload);
      childFiles.forEach(f => {
        if (f.objectUrl) URL.revokeObjectURL(f.objectUrl);
        deleteFileBlob(f.id);
      });
      
      return {
        ...state,
        folders: state.folders.filter(f => f.id !== action.payload),
        files: state.files.filter(f => f.parentId !== action.payload)
      };
    }
    case "CLEAR_ALL": {
      state.files.forEach(f => {
        if (f.objectUrl) URL.revokeObjectURL(f.objectUrl);
        if (f.extractedImages) {
          f.extractedImages.forEach(url => URL.revokeObjectURL(url));
        }
      });
      clearAllStorage();
      return {
        ...state,
        files: [],
        folders: [],
        currentFolderId: null,
        selectedFileId: null
      };
    }
    case "RENAME_FILE":
      return {
        ...state,
        files: state.files.map(f => f.id === action.payload.id ? { ...f, name: action.payload.name } : f)
      };
    case "RENAME_FOLDER":
      return {
        ...state,
        folders: state.folders.map(f => f.id === action.payload.id ? { ...f, name: action.payload.name } : f)
      };
    case "MOVE_FILE":
      return {
        ...state,
        files: state.files.map(f => f.id === action.payload.id ? { ...f, parentId: action.payload.newParentId } : f)
      };
    case "MOVE_FOLDER":
      return {
        ...state,
        folders: state.folders.map(f => f.id === action.payload.id ? { ...f, parentId: action.payload.newParentId } : f)
      };
    case "SET_CURRENT_FOLDER":
      return { ...state, currentFolderId: action.payload };
    case "SET_VIEW_MODE":
      return { ...state, viewMode: action.payload };
    case "SET_THEME":
      return { ...state, theme: action.payload };
    case "SET_SELECTED_FILE":
      return { ...state, selectedFileId: action.payload };
    case "SET_SEARCH_QUERY":
      return { ...state, searchQuery: action.payload };
    default:
      return state;
  }
}

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
} | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Persistence: Initial Load
  useEffect(() => {
    loadAppMetadata().then(({ files, folders }) => {
      // Clear session URLs from stored metadata
      const cleanFiles = files.map((f: VirtualFile) => ({ 
        ...f, 
        objectUrl: undefined, 
        extractedImages: undefined 
      }));
      dispatch({ type: "REPLACE_STATE", payload: { files: cleanFiles, folders } });
    });
  }, []);

  // Persistence: Save on change
  useEffect(() => {
    if (state.isHydrated) {
      // Don't save transient object URLs to metadata
      const filesToSave = state.files.map(({ objectUrl, extractedImages, ...rest }) => rest);
      saveAppMetadata(filesToSave, state.folders);
    }
  }, [state.files, state.folders, state.isHydrated]);

  // Handle Theme
  useEffect(() => {
    const root = window.document.documentElement;
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const activeTheme = state.theme === "system" ? systemTheme : state.theme;

    if (state.theme === "default") {
      root.classList.remove("dark");
      root.classList.add("theme-default");
    } else {
      root.classList.remove("theme-default");
      root.classList.toggle("dark", activeTheme === "dark");
    }
  }, [state.theme]);

  // Clean up Object URLs on unmount
  useEffect(() => {
    return () => {
      state.files.forEach(f => {
        if (f.objectUrl) URL.revokeObjectURL(f.objectUrl);
      });
    };
  }, []);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};
