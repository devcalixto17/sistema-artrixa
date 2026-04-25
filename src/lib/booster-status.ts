import { z } from "zod";

const serverLookupInput = z.object({
  address: z.string().trim().min(3).max(80),
  game: z.string().trim().min(2).max(20).default("cs"),
  serverId: z.string().trim().min(1).max(30).optional(),
});

export type BoosterLiveStatus = {
  name: string;
  ip: string | null;
  port: number | null;
  status: "online" | "offline";
  map: string | null;
  players: number | null;
  maxPlayers: number | null;
  playersOnline: string[];
  playersSource: "live" | "fallback";
  country: string | null;
  updatedAt: string;
};

export type BoosterStatusResponse =
  | { ok: true; data: BoosterLiveStatus; resolvedServerId: string | null }
  | { ok: false; message: string; rateLimited?: boolean; retryAfterMs?: number };

type CsLiveResponse = {
  ok: boolean;
  data?: {
    map: string | null;
    players: number | null;
    maxPlayers: number | null;
    playersOnline: string[];
    status: "online" | "offline";
    updatedAt: string;
  };
};

type BattleMetricsServer = {
  id?: string;
  attributes?: {
    name?: string;
    ip?: string;
    port?: number;
    players?: number;
    maxPlayers?: number;
    status?: string;
    queryStatus?: string;
    country?: string;
    details?: {
      map?: string;
    };
  };
};

function mapLiveStatus(server: BattleMetricsServer, fallbackName: string, playersOnline: string[]): BoosterLiveStatus {
  const first = server.attributes;
  const normalizedStatus = String(first?.status ?? "").toLowerCase();
  const normalizedQueryStatus = String(first?.queryStatus ?? "").toLowerCase();
  const isExplicitOffline = ["offline", "removed", "dead"].includes(normalizedStatus);
  const hasFreshSignal = normalizedStatus.length > 0 || normalizedQueryStatus.length > 0 || Boolean(first?.details?.map);

  return {
    name: first?.name ?? fallbackName,
    ip: first?.ip ?? null,
    port: typeof first?.port === "number" ? first.port : null,
    status: !isExplicitOffline && (playersOnline.length > 0 || hasFreshSignal) ? "online" : "offline",
    map: first?.details?.map ?? null,
    players:
      typeof first?.players === "number" && first.players >= 0
        ? first.players
        : playersOnline.length,
    maxPlayers: typeof first?.maxPlayers === "number" ? first.maxPlayers : null,
    playersOnline,
    playersSource: "live",
    country: first?.country ?? null,
    updatedAt: new Date().toISOString(),
  };
}

async function fetchServerById(serverId: string, headers: HeadersInit): Promise<{
  server: BattleMetricsServer;
  playersOnline: string[];
} | null> {
  const response = await fetch(`https://api.battlemetrics.com/servers/${serverId}?include=player`, {
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    data?: BattleMetricsServer;
    included?: Array<{
      type?: string;
      attributes?: {
        name?: string;
      };
    }>;
  };

  if (!payload.data?.attributes) {
    return null;
  }

  const playersOnline = (payload.included ?? [])
    .filter((entry) => entry.type === "player")
    .map((entry) => entry.attributes?.name?.trim() ?? "")
    .filter(Boolean);

  return {
    server: { ...payload.data, id: payload.data.id ?? serverId },
    playersOnline,
  };
}

function parseRetryAfterMs(payload: unknown): number | undefined {
  const tryAgain =
    (payload as { errors?: Array<{ meta?: { tryAgain?: string } }> })?.errors?.[0]?.meta?.tryAgain;
  if (!tryAgain) {
    return undefined;
  }

  const target = Date.parse(tryAgain);
  if (Number.isNaN(target)) {
    return undefined;
  }

  return Math.max(0, target - Date.now());
}

async function fetchCsLiveStatus(address: string): Promise<CsLiveResponse["data"] | null> {
  try {
    const response = await fetch(`/api/public/cs-live?address=${encodeURIComponent(address)}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as CsLiveResponse;
    if (!payload.ok || !payload.data) {
      return null;
    }

    return payload.data;
  } catch {
    return null;
  }
}

export const getServerStatus = async ({
  data,
}: {
  data: { address: string; game: string; serverId?: string };
}): Promise<BoosterStatusResponse> => {
  try {
    const parsed = serverLookupInput.safeParse(data);
    if (!parsed.success) {
      return { ok: false, message: "IP:PORTA inválido" };
    }

    const safeData = parsed.data;
    const requestHeaders: HeadersInit = {
      Accept: "application/json",
    };

    const normalizedAddress = safeData.address.trim();
    const [expectedIpRaw, expectedPortRaw] = normalizedAddress.split(":");
    const expectedIp = expectedIpRaw?.trim() || "";
    const expectedPort = Number(expectedPortRaw);

    const serverById = safeData.serverId
      ? await fetchServerById(safeData.serverId, requestHeaders)
      : null;

    if (serverById?.server.attributes) {
      const liveCs = safeData.game.toLowerCase() === "cs" ? await fetchCsLiveStatus(safeData.address) : null;
      const baseStatus = mapLiveStatus(serverById.server, safeData.address, serverById.playersOnline);

      return {
        ok: true,
        data: liveCs
          ? {
              ...baseStatus,
              map: liveCs.map ?? baseStatus.map,
              players: typeof liveCs.players === "number" ? liveCs.players : baseStatus.players,
              maxPlayers: typeof liveCs.maxPlayers === "number" ? liveCs.maxPlayers : baseStatus.maxPlayers,
              playersOnline: liveCs.playersOnline,
              status: liveCs.status,
              updatedAt: liveCs.updatedAt,
            }
          : baseStatus,
        resolvedServerId: serverById.server.id ?? safeData.serverId ?? null,
      };
    }

    const queryAttempts = [
      { search: normalizedAddress, includeGame: true },
      { search: normalizedAddress, includeGame: false },
    ].filter((attempt) => attempt.search.length > 0);

    const uniqueAttempts = Array.from(
      new Map(queryAttempts.map((attempt) => [`${attempt.search}:${attempt.includeGame}`, attempt])).values(),
    );

    const mergedServers = new Map<
      string,
      {
        id?: string;
        attributes?: {
          name?: string;
          ip?: string;
          port?: number;
          players?: number;
          maxPlayers?: number;
          status?: string;
          country?: string;
          details?: {
            map?: string;
          };
        };
      }
    >();

    if (serverById?.server) {
      const key = serverById.server.id ?? `${serverById.server.attributes?.ip ?? "unknown"}:${String(serverById.server.attributes?.port ?? "")}`;
      mergedServers.set(key, serverById.server);
    }

    for (const attempt of uniqueAttempts) {
      const query = new URL("https://api.battlemetrics.com/servers");
      query.searchParams.set("filter[search]", attempt.search);
      if (attempt.includeGame) {
        query.searchParams.set("filter[game]", safeData.game);
      }
      query.searchParams.set("page[size]", "20");

      let response = await fetch(query.toString(), { headers: requestHeaders, cache: "no-store" });
      if (response.status === 403 && attempt.includeGame) {
        const fallbackQuery = new URL("https://api.battlemetrics.com/servers");
        fallbackQuery.searchParams.set("filter[search]", attempt.search);
        fallbackQuery.searchParams.set("page[size]", "20");
        response = await fetch(fallbackQuery.toString(), { headers: requestHeaders, cache: "no-store" });
      }

      if (response.status === 429) {
        const payload = await response.json().catch(() => null);
        return {
          ok: false,
          message: "Limite da API atingido",
          rateLimited: true,
          retryAfterMs: parseRetryAfterMs(payload),
        };
      }

      if (!response.ok) {
        continue;
      }

      const payload = (await response.json()) as {
        data?: BattleMetricsServer[];
      };

      for (const server of payload.data ?? []) {
        const key = server.id ?? `${server.attributes?.ip ?? "unknown"}:${String(server.attributes?.port ?? "")}`;
        mergedServers.set(key, server);
      }
    }

    const servers = Array.from(mergedServers.values());
    if (!servers.length) {
      return { ok: false, message: "Servidor não encontrado para o IP:PORTA informado" };
    }

    const scoredServers = servers
      .map((entry) => {
        const attrs = entry.attributes;
        if (!attrs?.ip || typeof attrs.port !== "number") {
          return null;
        }

        let score = 0;
        if (attrs.ip === expectedIp && !Number.isNaN(expectedPort) && attrs.port === expectedPort) {
          score = 100;
        } else if (attrs.ip === expectedIp && !Number.isNaN(expectedPort)) {
          score = 80 - Math.min(Math.abs(attrs.port - expectedPort), 50);
        } else if (attrs.ip === expectedIp) {
          score = 70;
        } else if (normalizedAddress.includes(attrs.ip)) {
          score = 40;
        }

        return { entry, score };
      })
      .filter((entry): entry is { entry: (typeof servers)[number]; score: number } => Boolean(entry))
      .sort((a, b) => b.score - a.score);

    const matchedServer =
      scoredServers.find((entry) => entry.score >= 70)?.entry ??
      scoredServers.find((entry) => entry.score > 0)?.entry ??
      servers[0];

    const first = matchedServer?.attributes;
    const serverId = matchedServer?.id;
    if (!first) {
      return { ok: false, message: "Servidor não encontrado para o IP:PORTA informado" };
    }

    const playersOnline = serverId ? (await fetchServerById(serverId, requestHeaders))?.playersOnline ?? [] : [];

    const liveCs = safeData.game.toLowerCase() === "cs" ? await fetchCsLiveStatus(safeData.address) : null;
    const baseStatus = mapLiveStatus(matchedServer, safeData.address, playersOnline);

    return {
      ok: true,
      data: liveCs
        ? {
            ...baseStatus,
            map: liveCs.map ?? baseStatus.map,
            players: typeof liveCs.players === "number" ? liveCs.players : baseStatus.players,
            maxPlayers: typeof liveCs.maxPlayers === "number" ? liveCs.maxPlayers : baseStatus.maxPlayers,
            playersOnline: liveCs.playersOnline,
            status: liveCs.status,
            updatedAt: liveCs.updatedAt,
          }
        : baseStatus,
      resolvedServerId: serverId ?? null,
    };
  } catch {
    return { ok: false, message: "Erro de rede ao consultar servidor" };
  }
};