import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient, getSupabaseConfig, type BanRecord } from "../lib/supabase";
import { BanDetailsModal } from "./ban-details-modal";
import { EditableText } from "./editable-text";

const PAGE_SIZE = 10;

type SortField = "id" | "ban_date";
type SortDirection = "asc" | "desc";

function mapBanRecord(raw: Record<string, unknown>): BanRecord {
  return {
    id: Number(raw.id ?? 0),
    ban_type: String(raw.ban_type ?? ""),
    player_name: String(raw.player_name ?? "-"),
    steam_id: raw.player_steamid ? String(raw.player_steamid) : null,
    player_ip: raw.player_ip ? String(raw.player_ip) : null,
    server: raw.server_name ? String(raw.server_name) : null,
    reason: raw.reason ? String(raw.reason) : null,
    banned_by: raw.admin_name ? String(raw.admin_name) : null,
    admin_steamid: raw.admin_steamid ? String(raw.admin_steamid) : null,
    admin_ip: raw.admin_ip ? String(raw.admin_ip) : null,
    ban_date: raw.ban_time ? String(raw.ban_time) : null,
    unban_time: raw.unban_time ? String(raw.unban_time) : null,
    created_at: raw.created_at ? String(raw.created_at) : null,
  };
}

export function BanidosTable() {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [records, setRecords] = useState<BanRecord[]>([]);
  const [search, setSearch] = useState("");
  const [serverFilter, setServerFilter] = useState("");
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>("id");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selected, setSelected] = useState<BanRecord | null>(null);
  const [configVersion, setConfigVersion] = useState(0);

  const fetchBans = async () => {
    const config = getSupabaseConfig();
    const supabase = getSupabaseClient();

    if (!config.isConfigured || !supabase) {
      setErrorMessage("Configuração do Supabase ausente. Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
      setLoading(false);
      return;
    }

    const sortColumn = sortField === "ban_date" ? "ban_time" : "id";

    const { data, error } = await supabase
      .from(config.table)
      .select(
        "id, ban_type, player_name, player_steamid, player_ip, ban_time, unban_time, admin_name, admin_steamid, admin_ip, reason, server_name, created_at",
      )
      .order(sortColumn, { ascending: sortDirection === "asc" });

    if (error) {
      setErrorMessage(`Erro ao carregar banidos: ${error.message}`);
      setLoading(false);
      return;
    }

    const mapped = ((data as Record<string, unknown>[] | null) ?? []).map(mapBanRecord);
    setRecords(mapped);
    setErrorMessage(null);
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    void fetchBans();
  }, [sortField, sortDirection, configVersion]);

  useEffect(() => {
    const config = getSupabaseConfig();
    const supabase = getSupabaseClient();

    if (!config.isConfigured || !supabase) {
      return;
    }

    const interval = window.setInterval(() => {
      void fetchBans();
    }, 15000);

    const channel = supabase
      .channel("banidos-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: config.table,
        },
        () => {
          void fetchBans();
        },
      )
      .subscribe();

    return () => {
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [configVersion]);

  useEffect(() => {
    const syncConfig = () => setConfigVersion((prev) => prev + 1);
    window.addEventListener("storage", syncConfig);
    window.addEventListener("supabase-config-updated", syncConfig);

    return () => {
      window.removeEventListener("storage", syncConfig);
      window.removeEventListener("supabase-config-updated", syncConfig);
    };
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const serverTerm = serverFilter.trim().toLowerCase();

    return records.filter((item) => {
      const serverMatch = !serverTerm || item.server?.toLowerCase().includes(serverTerm);
      const searchMatch =
        !term || item.player_name?.toLowerCase().includes(term) || item.steam_id?.toLowerCase().includes(term);
      return (
        serverMatch &&
        searchMatch
      );
    });
  }, [records, search, serverFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(1);
    }
  }, [page, totalPages]);

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  return (
    <>
      <section className="panel overflow-hidden border-primary/40 bg-card/90 shadow-2xl shadow-primary/20">
      <div className="flex flex-col gap-4 border-b border-border/80 p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold uppercase tracking-[0.16em] text-foreground" style={{ fontFamily: '"Orbitron", "Exo 2", sans-serif' }}>
            <EditableText
              as="span"
              entry={{ id: "banidos-list-title", label: "Banidos • título da lista", defaultText: "Lista de Banidos" }}
            />
          </h2>
          <p className="text-sm text-muted-foreground">
            <EditableText
              as="span"
              entry={{
                id: "banidos-list-subtitle",
                label: "Banidos • subtítulo da lista",
                defaultText: "Atualização automática em tempo real + refresh a cada 15s",
                defaultConfig: { uppercase: false, font: "Exo 2", size: 14, weight: "500" },
              }}
            />
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Buscar por player ou steamid"
            className="h-11 rounded-xl border border-input bg-background/80 px-4 text-base outline-none ring-ring transition focus:ring-2"
            aria-label="Buscar por nome ou Steam ID"
          />
          <input
            type="search"
            value={serverFilter}
            onChange={(event) => {
              setServerFilter(event.target.value);
              setPage(1);
            }}
            placeholder="Filtrar por servidor"
            className="h-11 rounded-xl border border-input bg-background/80 px-4 text-base outline-none ring-ring transition focus:ring-2"
            aria-label="Filtrar por servidor"
          />
          <button
            type="button"
            className="action-button"
            onClick={() => {
              setSortField((prev) => (prev === "id" ? "ban_date" : "id"));
            }}
          >
            Ordenar: {sortField === "id" ? "ID" : "Data"}
          </button>
          <button
            type="button"
            className="action-button"
            onClick={() => {
              setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
            }}
          >
            Sentido: {sortDirection === "asc" ? "Crescente" : "Decrescente"}
          </button>
        </div>
      </div>

      <div className="grid gap-3 p-4">
        {loading && (
          <div className="rounded-lg border border-border bg-background px-4 py-5 text-sm text-muted-foreground">
            Carregando banidos...
          </div>
        )}

        {!loading && errorMessage && (
          <div className="rounded-lg border border-destructive/50 bg-background px-4 py-5 text-sm text-destructive">
            {errorMessage}
          </div>
        )}

        {!loading && !errorMessage && paged.length === 0 && (
          <div className="rounded-lg border border-border bg-background px-4 py-5 text-sm text-muted-foreground">
            Nenhum jogador banido encontrado.
          </div>
        )}

        {!loading &&
          !errorMessage &&
          paged.map((ban) => (
            <article
              key={ban.id}
              className="rounded-lg border bg-background px-4 py-3"
              style={{
                borderColor: !ban.unban_time ? "var(--color-destructive)" : "var(--color-status-temporary)",
                boxShadow: !ban.unban_time
                  ? "inset 4px 0 0 var(--color-destructive)"
                  : "inset 4px 0 0 var(--color-status-temporary)",
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-[240px] flex-1">
                  <h3 className="text-base font-bold uppercase text-foreground">{ban.player_name}</h3>
                  <p className="text-xs text-muted-foreground">ID do ban: #{ban.id}</p>
                </div>

                <div className="min-w-[220px] flex-1 text-sm">
                  <p className="text-xs text-muted-foreground">Steam ID</p>
                  <p className="font-medium text-foreground">{ban.steam_id || "-"}</p>
                </div>

                <div className="min-w-[220px] flex-1 text-sm">
                  <p className="text-xs text-muted-foreground">Servidor</p>
                  <p className="font-medium text-foreground">{ban.server || "-"}</p>
                </div>

                <button type="button" className="action-button" onClick={() => setSelected(ban)}>
                  Detalhes
                </button>
              </div>
            </article>
          ))}
      </div>

      <div className="flex items-center justify-between border-t border-border p-5 text-sm text-muted-foreground">
        <span>
          Página {page} de {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            className="action-button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page <= 1}
          >
            Anterior
          </button>
          <button
            type="button"
            className="action-button"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page >= totalPages}
          >
            Próxima
          </button>
        </div>
      </div>

      </section>

      {selected && <BanDetailsModal ban={selected} onClose={() => setSelected(null)} />}
    </>
  );
}