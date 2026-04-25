import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type EditableTextConfig = {
  text: string;
  color: string;
  size: number;
  font: string;
  weight: "500" | "700" | "800";
  italic: boolean;
  uppercase: boolean;
  glow: boolean;
  glowColor: string;
  glowIntensity: number;
};

export type EditableTextEntry = {
  id: string;
  label: string;
  defaultText: string;
  defaultConfig?: Partial<EditableTextConfig>;
};

type TextCustomizationContextValue = {
  entries: EditableTextEntry[];
  registerEntry: (entry: EditableTextEntry) => void;
  getConfig: (entry: EditableTextEntry) => EditableTextConfig;
  updateEntry: (entryId: string, next: Partial<EditableTextConfig>) => void;
  selectionMode: boolean;
  setSelectionMode: (enabled: boolean) => void;
  editingEntryId: string | null;
  openEditorFor: (entryId: string) => void;
  closeEditor: () => void;
};

const defaultConfig: EditableTextConfig = {
  text: "",
  color: "#f4f5ff",
  size: 28,
  font: "Orbitron",
  weight: "800",
  italic: false,
  uppercase: true,
  glow: false,
  glowColor: "#a855f7",
  glowIntensity: 16,
};

const STORAGE_KEY = "founder-text-customization-v1";

const TextCustomizationContext = createContext<TextCustomizationContextValue | null>(null);

export function TextCustomizationProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<EditableTextEntry[]>([]);
  const [configs, setConfigs] = useState<Record<string, Partial<EditableTextConfig>>>({});
  const [selectionMode, setSelectionMode] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const cached = window.localStorage.getItem(STORAGE_KEY);
    if (!cached) {
      return;
    }

    try {
      const parsed = JSON.parse(cached) as Record<string, Partial<EditableTextConfig>>;
      if (parsed && typeof parsed === "object") {
        setConfigs(parsed);
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
  }, [configs]);

  const registerEntry = (entry: EditableTextEntry) => {
    setEntries((prev) => {
      if (prev.some((item) => item.id === entry.id)) {
        return prev;
      }
      return [...prev, entry];
    });
  };

  const getConfig = (entry: EditableTextEntry) => {
    return {
      ...defaultConfig,
      text: entry.defaultText,
      ...entry.defaultConfig,
      ...(configs[entry.id] ?? {}),
    };
  };

  const updateEntry = (entryId: string, next: Partial<EditableTextConfig>) => {
    setConfigs((prev) => ({
      ...prev,
      [entryId]: {
        ...(prev[entryId] ?? {}),
        ...next,
      },
    }));
  };

  const openEditorFor = (entryId: string) => {
    setEditingEntryId(entryId);
    setSelectionMode(false);
  };

  const closeEditor = () => {
    setEditingEntryId(null);
  };

  const value = useMemo<TextCustomizationContextValue>(
    () => ({
      entries,
      registerEntry,
      getConfig,
      updateEntry,
      selectionMode,
      setSelectionMode,
      editingEntryId,
      openEditorFor,
      closeEditor,
    }),
    [entries, configs, selectionMode, editingEntryId],
  );

  return <TextCustomizationContext.Provider value={value}>{children}</TextCustomizationContext.Provider>;
}

export function useTextCustomization() {
  const context = useContext(TextCustomizationContext);
  if (!context) {
    throw new Error("useTextCustomization deve ser usado dentro de <TextCustomizationProvider>");
  }
  return context;
}