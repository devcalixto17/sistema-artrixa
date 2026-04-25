import { createFileRoute } from "@tanstack/react-router";

type GameTrackerPlayer = {
  player?: {
    name?: string;
  };
};

type GameTrackerResponse = {
  map?: string;
  players?: string;
  playersmax?: string;
  status?: string;
  players_list?: GameTrackerPlayer[];
};

function parseAddress(address: string) {
  const [rawIp, rawPort] = address.split(":");
  const ip = rawIp?.trim() ?? "";
  const port = Number(rawPort);

  if (!ip || !Number.isInteger(port) || port <= 0 || port > 65535) {
    return null;
  }

  return { ip, port };
}

export const Route = createFileRoute("/api/public/cs-live")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const address = (url.searchParams.get("address") ?? "").trim();
          const parsed = parseAddress(address);

          if (!parsed) {
            return Response.json({ ok: false, message: "Endereço inválido" }, { status: 400 });
          }

          const target = `https://api.gametracker.rs/demo/json/server_info/${parsed.ip}:${parsed.port}`;
          const upstream = await fetch(target, {
            headers: {
              Accept: "application/json",
              "User-Agent": "Mozilla/5.0",
            },
            cache: "no-store",
          });

          if (!upstream.ok) {
            return Response.json({ ok: false, message: "Fonte indisponível" }, { status: 502 });
          }

          const payload = (await upstream.json()) as GameTrackerResponse;
          const playersOnline = (payload.players_list ?? [])
            .map((entry) => entry.player?.name?.trim() ?? "")
            .filter(Boolean);

          const playersFromList = playersOnline.length;
          const playersFromField = Number(payload.players);
          const maxPlayers = Number(payload.playersmax);

          return Response.json({
            ok: true,
            data: {
              map: payload.map?.trim() || null,
              players: Number.isFinite(playersFromField) ? playersFromField : playersFromList,
              maxPlayers: Number.isFinite(maxPlayers) ? maxPlayers : null,
              playersOnline,
              status: payload.status === "1" || playersFromList > 0 ? "online" : "offline",
              updatedAt: new Date().toISOString(),
            },
          });
        } catch {
          return Response.json({ ok: false, message: "Erro ao consultar status" }, { status: 500 });
        }
      },
    },
  },
});