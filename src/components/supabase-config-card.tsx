import { useMemo, useState } from "react";
import { clearSupabaseConfig, getSupabaseConfig, saveSupabaseConfig } from "../lib/supabase";
import { EditableText } from "./editable-text";

export function SupabaseConfigCard() {
  const current = useMemo(() => getSupabaseConfig(), []);
  const [url, setUrl] = useState(current.url);
  const [anonKey, setAnonKey] = useState(current.anonKey);
  const [table, setTable] = useState(current.table);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <section className="panel space-y-4 p-4">
      <div>
        <h2 className="text-base font-bold uppercase tracking-wide">
          <EditableText as="span" entry={{ id: "config-title", label: "Configuração • título", defaultText: "Conexão Supabase" }} />
        </h2>
        <p className="text-xs text-muted-foreground">
          <EditableText
            as="span"
            entry={{
              id: "config-subtitle",
              label: "Configuração • descrição",
              defaultText: "Cole abaixo a URL, anon key e nome da tabela de banidos.",
              defaultConfig: { uppercase: false, font: "Exo 2", size: 13, weight: "500" },
            }}
          />
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1 text-xs text-muted-foreground">
          URL do projeto
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://xxxx.supabase.co"
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none ring-ring focus:ring-2"
          />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          Anon key pública
          <input
            value={anonKey}
            onChange={(e) => setAnonKey(e.target.value)}
            placeholder="eyJhbGciOi..."
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none ring-ring focus:ring-2"
          />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          Nome da tabela
          <input
            value={table}
            onChange={(e) => setTable(e.target.value)}
            placeholder="banishments"
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none ring-ring focus:ring-2"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="action-button"
          onClick={() => {
            saveSupabaseConfig(url, anonKey, table);
            setMessage("Dados salvos. Atualizando listagem...");
          }}
        >
          <EditableText as="span" entry={{ id: "config-save", label: "Configuração • botão salvar", defaultText: "Salvar conexão" }} />
        </button>
        <button
          type="button"
          className="action-button"
          onClick={() => {
            clearSupabaseConfig();
            setUrl("");
            setAnonKey("");
            setTable("banishments");
            setMessage("Conexão limpa.");
          }}
        >
          <EditableText as="span" entry={{ id: "config-clear", label: "Configuração • botão limpar", defaultText: "Limpar" }} />
        </button>
      </div>

      {message && <p className="text-xs text-muted-foreground">{message}</p>}
    </section>
  );
}