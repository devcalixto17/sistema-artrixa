import { useEffect, useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import { useAuth } from "../lib/auth";
import { useTextCustomization } from "../lib/text-customization";

const FONT_OPTIONS = ["Orbitron", "Exo 2", "Rajdhani", "Teko", "Audiowide"];

export function FounderTextEditor() {
  const { hasRole } = useAuth();
  const { entries, getConfig, updateEntry, selectionMode, setSelectionMode, editingEntryId, closeEditor } = useTextCustomization();
  const isFounder = hasRole("fundador");
  const [draft, setDraft] = useState<ReturnType<typeof getConfig> | null>(null);
  const [originalDraft, setOriginalDraft] = useState<ReturnType<typeof getConfig> | null>(null);
  const [history, setHistory] = useState<Array<ReturnType<typeof getConfig>>>([]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const selectedEntry = useMemo(() => {
    if (!editingEntryId) {
      return null;
    }

    return entries.find((entry) => entry.id === editingEntryId) ?? null;
  }, [entries, editingEntryId]);

  const selectedEntryId = selectedEntry?.id ?? null;

  useEffect(() => {
    if (!selectedEntryId || !selectedEntry || !editingEntryId) {
      setDraft(null);
      setOriginalDraft(null);
      setHistory([]);
      setHistoryIndex(0);
      return;
    }

    const initialConfig = getConfig(selectedEntry);
    setDraft(initialConfig);
    setOriginalDraft(initialConfig);
    setHistory([initialConfig]);
    setHistoryIndex(0);
  }, [selectedEntryId, editingEntryId]);

  const applyDraftChange = (next: Partial<ReturnType<typeof getConfig>>) => {
    if (!selectedEntry) {
      return;
    }

    setDraft((prev) => {
      if (!prev) {
        return prev;
      }

      const merged = { ...prev, ...next };
      if (JSON.stringify(merged) === JSON.stringify(prev)) {
        return prev;
      }

      setHistory((prevHistory) => {
        const trimmed = prevHistory.slice(0, historyIndex + 1);
        return [...trimmed, merged];
      });
      setHistoryIndex((prevIndex) => prevIndex + 1);
      updateEntry(selectedEntry.id, merged);
      return merged;
    });
  };

  const undoLastChange = () => {
    if (!selectedEntry || historyIndex <= 0) {
      return;
    }

    const previous = history[historyIndex - 1];
    if (!previous) {
      return;
    }

    setHistoryIndex((prev) => Math.max(0, prev - 1));
    setDraft(previous);
    updateEntry(selectedEntry.id, previous);
  };

  useEffect(() => {
    if (!editingEntryId) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undoLastChange();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editingEntryId, historyIndex, history, selectedEntry]);

  const closeModal = () => {
    setDraft(null);
    setOriginalDraft(null);
    closeEditor();
  };

  if (!isFounder) {
    return null;
  }

  return (
    <aside className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      <button
        type="button"
        className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-secondary text-secondary-foreground shadow-lg"
        onClick={() => setSelectionMode(!selectionMode)}
        title={selectionMode ? "Selecionando texto" : "Editar textos"}
        aria-label={selectionMode ? "Selecionando texto" : "Editar textos"}
      >
        <Pencil size={16} />
      </button>

      {selectionMode && (
        <div className="panel w-[min(92vw,360px)] space-y-2 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Modo seleção ativo</p>
          <p className="text-sm text-muted-foreground">Clique no texto da página que você quer editar.</p>
        </div>
      )}

      {editingEntryId && selectedEntry && draft && (
        <>
          <div className="fixed inset-0 z-40 bg-background/40" onClick={closeModal} />
          <div className="panel fixed left-1/2 top-1/2 z-50 w-[min(92vw,380px)] -translate-x-1/2 -translate-y-1/2 space-y-3 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Editor de texto (fundador)</p>
            <p className="text-sm text-foreground">{selectedEntry.label}</p>

              <label className="space-y-1 text-xs text-muted-foreground">
                Texto
                <input
                  value={draft.text}
                  onChange={(event) => applyDraftChange({ text: event.target.value })}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none ring-ring focus:ring-2"
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1 text-xs text-muted-foreground">
                  Cor
                  <input
                    type="color"
                    value={draft.color}
                    onChange={(event) => applyDraftChange({ color: event.target.value })}
                    className="h-10 w-full rounded-lg border border-input bg-background p-1"
                  />
                </label>
                <label className="space-y-1 text-xs text-muted-foreground">
                  Tamanho ({draft.size}px)
                  <input
                    type="range"
                    min={14}
                    max={72}
                    value={draft.size}
                    onChange={(event) => applyDraftChange({ size: Number(event.target.value) })}
                    className="h-10 w-full"
                  />
                </label>
              </div>

              <label className="space-y-1 text-xs text-muted-foreground">
                Fonte
                <select
                  value={draft.font}
                  onChange={(event) => applyDraftChange({ font: event.target.value })}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none ring-ring focus:ring-2"
                >
                  {FONT_OPTIONS.map((font) => (
                    <option key={font} value={font}>
                      {font}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <button
                  type="button"
                  className="action-button"
                  onClick={() => applyDraftChange({ weight: "500" })}
                >
                  Leve
                </button>
                <button
                  type="button"
                  className="action-button"
                  onClick={() => applyDraftChange({ weight: "700" })}
                >
                  Forte
                </button>
                <button
                  type="button"
                  className="action-button"
                  onClick={() => applyDraftChange({ weight: "800" })}
                >
                  Extra
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  className="action-button"
                  onClick={() => applyDraftChange({ italic: !draft.italic })}
                >
                  Itálico
                </button>
                <button
                  type="button"
                  className="action-button"
                  onClick={() => applyDraftChange({ uppercase: !draft.uppercase })}
                >
                  MAIÚSCULO
                </button>
              </div>

              <div className="space-y-2 rounded-lg border border-border/70 bg-background/70 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Glow</span>
                  <button
                    type="button"
                    className="action-button"
                    onClick={() => applyDraftChange({ glow: !draft.glow })}
                  >
                    {draft.glow ? "Ativo" : "Desligado"}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="color"
                    value={draft.glowColor}
                    onChange={(event) => applyDraftChange({ glowColor: event.target.value })}
                    className="h-10 w-full rounded-lg border border-input bg-background p-1"
                  />
                  <input
                    type="range"
                    min={6}
                    max={40}
                    value={draft.glowIntensity}
                    onChange={(event) => applyDraftChange({ glowIntensity: Number(event.target.value) })}
                    className="h-10 w-full"
                  />
                </div>
              </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                className="action-button flex-1"
                onClick={undoLastChange}
                disabled={historyIndex <= 0}
              >
                Desfazer
              </button>
              <button
                type="button"
                className="action-button flex-1"
                onClick={() => {
                  updateEntry(selectedEntry.id, draft);
                  closeModal();
                }}
              >
                Salvar
              </button>
              <button
                type="button"
                className="action-button flex-1"
                onClick={() => {
                  if (originalDraft) {
                    updateEntry(selectedEntry.id, originalDraft);
                  }
                  closeModal();
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}