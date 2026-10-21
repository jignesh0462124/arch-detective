export const REPORT_INPUT =
  "min-h-10 min-w-0 rounded-sm border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-primary";
export const FRAMEWORK_LABELS: Record<string, string> = {
  gdpr: "GDPR",
  soc2: "SOC 2",
  iso27001: "ISO 27001",
  pci_dss: "PCI DSS",
  nist_csf: "NIST CSF",
};
export const reportDate = (value?: string | null) =>
  value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : "Not available";
export const frameworkLabel = (value: string) => FRAMEWORK_LABELS[value] || value;
