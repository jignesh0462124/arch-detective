import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchScanStatus } from "@/lib/api/scans";
import { supabase } from "@/lib/supabase";
import type { ScanStatusResponse } from "@/lib/api/types";

const TERMINAL = new Set(["completed", "failed", "cancelled"]);
const POLL_INTERVAL = 3000;
const WS_BASE =
  (import.meta.env.VITE_API_URL ?? "http://localhost:8000")
    .replace(/^http/, "ws") + "/api/v1/ws";

export function useScanProgress(scanId: string | null | undefined) {
  const queryClient = useQueryClient();
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Polling fallback — always runs; becomes the source of truth when WS is absent
  const query = useQuery({
    queryKey: ["scan-progress", scanId],
    queryFn: () => fetchScanStatus(scanId!),
    enabled: Boolean(scanId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status || TERMINAL.has(status)) return false;
      return wsConnected ? false : POLL_INTERVAL; // pause polling while WS is up
    },
    staleTime: 0,
  });

  // WebSocket — preferred channel
  useEffect(() => {
    if (!scanId) return;
    const status = query.data?.status;
    if (status && TERMINAL.has(status)) return;

    let ws: WebSocket;
    let closed = false;

    async function connect() {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return; // no session — fall back to polling

      ws = new WebSocket(`${WS_BASE}/scans/${scanId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "authenticate", access_token: token }));
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as ScanStatusResponse & { type?: string };
          if (msg.type === "progress") {
            queryClient.setQueryData(["scan-progress", scanId], msg);
            if (TERMINAL.has(msg.status)) {
              void queryClient.invalidateQueries({ queryKey: ["scans"] });
              void queryClient.invalidateQueries({ queryKey: ["findings", scanId] });
            }
          }
        } catch {
          /* ignore parse errors */
        }
      };

      ws.onerror = () => {
        if (!closed) setWsConnected(false);
      };

      ws.onclose = () => {
        if (!closed) setWsConnected(false);
        // Force a poll on disconnect to catch final state
        void queryClient.invalidateQueries({ queryKey: ["scan-progress", scanId] });
      };
    }

    void connect();

    return () => {
      closed = true;
      setWsConnected(false);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [scanId, queryClient]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    ...query,
    isConnected: wsConnected,
    isTerminal: Boolean(query.data?.status && TERMINAL.has(query.data.status)),
  };
}
