export enum Theme {
  LIGHT = "light",
  DARK = "dark",
  SYSTEM = "system",
  DEFAULT = "default",
}

export interface VirtualFile {
  id: string;
  name: string;
  extension: string;
  size: number;
  type: string;
  parentId: string | null;
  objectUrl?: string; // Optional because it's session-based
  lastModified: number;
  extractedImages?: string[]; // For CBZ/CBR/RAR
}

export interface VirtualFolder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: number;
}

export interface AppState {
  files: VirtualFile[];
  folders: VirtualFolder[];
  currentFolderId: string | null;
  viewMode: "grid" | "list";
  theme: Theme;
  selectedFileId: string | null;
  searchQuery: string;
  isHydrated: boolean;
}

export type AppAction =
  | { type: "REPLACE_STATE"; payload: Partial<AppState> }
  | { type: "ADD_FILES"; payload: VirtualFile[] }
  | { type: "ADD_FOLDER"; payload: VirtualFolder }
  | { type: "DELETE_FILE"; payload: string }
  | { type: "DELETE_FOLDER"; payload: string }
  | { type: "RENAME_FILE"; payload: { id: string; name: string } }
  | { type: "RENAME_FOLDER"; payload: { id: string; name: string } }
  | { type: "MOVE_FILE"; payload: { id: string; newParentId: string | null } }
  | { type: "MOVE_FOLDER"; payload: { id: string; newParentId: string | null } }
  | { type: "SET_CURRENT_FOLDER"; payload: string | null }
  | { type: "SET_VIEW_MODE"; payload: "grid" | "list" }
  | { type: "SET_THEME"; payload: Theme }
  | { type: "SET_SELECTED_FILE"; payload: string | null }
  | { type: "SET_SEARCH_QUERY"; payload: string }
  | { type: "UPDATE_FILE_URL"; payload: { id: string; url: string, extractedImages?: string[] } };
