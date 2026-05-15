import React from "react";
import { Search, Grid, List, Moon, Sun, Monitor, Menu } from "lucide-react";
import { useApp } from "../AppContext";
import { Theme } from "../types";
import { cn } from "../lib/utils";

interface NavbarProps {
  onMenuClick?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onMenuClick }) => {
  const { state, dispatch } = useApp();

  return (
    <div className="h-16 border-b border-forest-outline/10 px-4 sm:px-6 flex items-center justify-between gap-4 bg-[var(--bg-color)]/80 backdrop-blur-md sticky top-0 z-20">
      <div className="flex items-center gap-2">
        <button onClick={onMenuClick} className="w-10 h-10 bg-forest-primary rounded-xl flex items-center justify-center text-forest-on-primary shadow-lg shadow-forest-primary/20 active:scale-95 transition-all">
          <Menu size={24} />
        </button>
        <h1 className="text-xl font-bold tracking-tight hidden xs:block">Arboreus</h1>
      </div>

      <div className="flex-1 max-w-md relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-variant)]" size={18} />
        <input 
          type="text" 
          placeholder="Search files..."
          value={state.searchQuery}
          onChange={(e) => dispatch({ type: "SET_SEARCH_QUERY", payload: e.target.value })}
          className="w-full h-10 pl-10 pr-4 bg-[var(--surface-color)] border border-transparent focus:border-forest-primary focus:bg-[var(--bg-color)] rounded-full text-sm outline-none transition-all"
        />
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <div className="flex items-center bg-[var(--surface-color)] rounded-full p-1 border border-forest-outline/5">
          <button 
            onClick={() => dispatch({ type: "SET_VIEW_MODE", payload: "grid" })}
            className={cn("p-1.5 rounded-full transition-all", state.viewMode === "grid" ? "bg-forest-primary text-forest-on-primary shadow-sm" : "text-[var(--text-variant)] hover:bg-forest-outline/5")}
          >
            <Grid size={18} />
          </button>
          <button 
            onClick={() => dispatch({ type: "SET_VIEW_MODE", payload: "list" })}
            className={cn("p-1.5 rounded-full transition-all", state.viewMode === "list" ? "bg-forest-primary text-forest-on-primary shadow-sm" : "text-[var(--text-variant)] hover:bg-forest-outline/5")}
          >
            <List size={18} />
          </button>
        </div>

        <select 
          value={state.theme}
          onChange={(e) => dispatch({ type: "SET_THEME", payload: e.target.value as Theme })}
          className="bg-[var(--surface-color)] border border-forest-outline/5 rounded-full px-3 py-1.5 text-xs font-medium outline-none cursor-pointer hover:bg-forest-outline/5 hidden sm:block appearance-none"
        >
          <option value={Theme.SYSTEM}>System</option>
          <option value={Theme.LIGHT}>Light</option>
          <option value={Theme.DARK}>Dark</option>
        </select>
        
        {/* Mobile Theme Toggle */}
        <button 
          onClick={() => {
            const next = state.theme === Theme.LIGHT ? Theme.DARK : Theme.LIGHT;
            dispatch({ type: "SET_THEME", payload: next });
          }}
          className="sm:hidden p-2 bg-[var(--surface-color)] rounded-full text-[var(--text-variant)]"
        >
          {state.theme === Theme.LIGHT ? <Moon size={20} /> : <Sun size={20} />}
        </button>
      </div>
    </div>
  );
};
