import { api } from "./client";
import type { Framework } from "./types";

interface FrameworkApiItem {
  id: string;
  name: string;
  version: string;
  chunks_indexed: number;
}

interface FrameworksApiResponse {
  frameworks: FrameworkApiItem[];
}

export async function fetchFrameworks(): Promise<Framework[]> {
  const response = await api.get<FrameworksApiResponse>("/api/v1/frameworks");
  return response.frameworks.map((framework) => ({
    id: framework.id,
    label: framework.name,
    version: framework.version,
    controls: framework.chunks_indexed,
  }));
}
