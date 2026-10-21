import type { Framework } from "./types";

export const DEFAULT_FRAMEWORKS: Framework[] = [
  { id: "gdpr", label: "GDPR", version: "2016/679", controls: 99 },
  { id: "soc2", label: "SOC 2", version: "2017 TSC", controls: 64 },
  { id: "iso27001", label: "ISO 27001", version: "2022 ISMS", controls: 93 },
  { id: "pci_dss", label: "PCI DSS", version: "v4.0", controls: 120 },
  { id: "nist_csf", label: "NIST CSF", version: "v2.0", controls: 108 },
];

export async function fetchFrameworks(): Promise<Framework[]> {
  return DEFAULT_FRAMEWORKS;
}
