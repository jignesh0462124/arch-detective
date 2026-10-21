import { accountStorage } from "../authState.ts";
/**
 * Attack Graph & STRIDE Threat Topology Modeling Engine
 * Automatically categorizes code vulnerabilities into STRIDE vectors and models
 * architectural breach chains from entry points to critical data assets.
 */

export type StrideCategory =
  "spoofing" | "tampering" | "repudiation" | "info_disclosure" | "dos" | "elevation_of_privilege";

export interface StrideInfo {
  category: StrideCategory;
  code: string;
  name: string;
  description: string;
  iconName: string;
}

export const STRIDE_DEFINITIONS: Record<StrideCategory, StrideInfo> = {
  spoofing: {
    category: "spoofing",
    code: "STRIDE-S",
    name: "Spoofing",
    description:
      "Impersonating an identity, client, or entity (missing authentication, forged tokens, credential stuffing).",
    iconName: "MaskHappy",
  },
  tampering: {
    category: "tampering",
    code: "STRIDE-T",
    name: "Tampering",
    description:
      "Modifying code or data in flight or at rest (SQL injection, command injection, insecure deserialization, XSS).",
    iconName: "ShieldWarning",
  },
  repudiation: {
    category: "repudiation",
    code: "STRIDE-R",
    name: "Repudiation",
    description:
      "Inability to prove an action occurred (missing audit trails, unlogged transactions, log forging).",
    iconName: "ClockCounterClockwise",
  },
  info_disclosure: {
    category: "info_disclosure",
    code: "STRIDE-I",
    name: "Info Disclosure",
    description:
      "Exposing protected data to unauthorized parties (hardcoded keys, path traversal, plaintext passwords, PAN leak).",
    iconName: "Info",
  },
  dos: {
    category: "dos",
    code: "STRIDE-D",
    name: "DoS",
    description:
      "Exhausting system resources or degrading availability (unbounded loop, memory leak, ReDoS, infinite recursion).",
    iconName: "Lightning",
  },
  elevation_of_privilege: {
    category: "elevation_of_privilege",
    code: "STRIDE-E",
    name: "Elevation of Privilege",
    description:
      "Gaining unauthorized permissions or roles (BOLA, IDOR, authorization bypass, sudo command execution).",
    iconName: "User",
  },
};

export interface AttackGraphNode {
  id: string;
  label: string;
  subtitle?: string;
  type: "client" | "gateway" | "service" | "database" | "storage" | "cache";
  icon: "Globe" | "Shield" | "Gear" | "Database" | "Package" | "Stack";
  status: "safe" | "vulnerable" | "compromised";
  isCompromised?: boolean;
  hasVulnerability?: boolean;
  x: number; // percentage or px coordinate on canvas
  y: number;
  metadata?: Record<string, string>;
}

export interface AttackGraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  isThreatVector?: boolean;
  threatCategory?: StrideCategory;
  animated?: boolean;
}

export interface ThreatVector {
  id: string;
  findingId?: string;
  scanId?: string;
  stride: StrideCategory;
  strideCode: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  cvssScore: number | null;
  sourceNodeId: string;
  compromisedNodeId: string;
  edgeIds: string[];
  summary: string;
  affectedAssets: string[];
  filePath?: string;
  lineNumber?: number;
  cweId?: string;
  remediationSnippet?: {
    vulnerable: string;
    patched: string;
    explanation: string;
  };
}

export interface AttackGraphScenario {
  id: string;
  title: string;
  subtitle: string;
  industry: "fintech" | "healthcare" | "ecommerce" | "custom";
  frameworks: string[];
  nodes: AttackGraphNode[];
  edges: AttackGraphEdge[];
  threats: ThreatVector[];
  defaultActiveStride: StrideCategory;
}

// ── Built-In High-Fidelity Scenarios (College Viva & Examiner Demo Suite) ────

export const PRESET_SCENARIOS: Record<string, AttackGraphScenario> = {
  fintech: {
    id: "fintech",
    title: "Fintech Banking Core & Ledger",
    subtitle:
      "Evaluates PCI DSS v4.0 & SOC 2 against SQLi, exposed Stripe secrets, and card logging",
    industry: "fintech",
    frameworks: ["pci_dss", "soc2", "iso27001"],
    defaultActiveStride: "tampering",
    nodes: [
      {
        id: "node-client",
        label: "Public Client",
        subtitle: "/ Attacker",
        type: "client",
        icon: "Globe",
        status: "safe",
        x: 30,
        y: 165,
      },
      {
        id: "node-gateway",
        label: "API Gateway",
        subtitle: "(Nginx / Cloudflare)",
        type: "gateway",
        icon: "Shield",
        status: "safe",
        x: 210,
        y: 165,
      },
      {
        id: "node-service",
        label: "Payment Service",
        subtitle: "(transfer.py)",
        type: "service",
        icon: "Gear",
        status: "vulnerable",
        hasVulnerability: true,
        x: 390,
        y: 165,
        metadata: {
          file: "app/transfer.py",
          port: "8080",
          runtime: "FastAPI / Python 3.12",
        },
      },
      {
        id: "node-s3",
        label: "AWS S3",
        subtitle: "Document Store",
        type: "storage",
        icon: "Package",
        status: "safe",
        x: 580,
        y: 40,
      },
      {
        id: "node-database",
        label: "PostgreSQL",
        subtitle: "Core Ledger",
        type: "database",
        icon: "Database",
        status: "compromised",
        isCompromised: true,
        x: 580,
        y: 165,
        metadata: {
          tables: "accounts, ledger_entries, cards",
          engine: "PostgreSQL 16",
        },
      },
      {
        id: "node-redis",
        label: "Redis Cache",
        subtitle: "(Session & Rates)",
        type: "cache",
        icon: "Stack",
        status: "safe",
        x: 580,
        y: 290,
      },
    ],
    edges: [
      { id: "e1", source: "node-client", target: "node-gateway" },
      {
        id: "e2",
        source: "node-gateway",
        target: "node-service",
        isThreatVector: true,
        threatCategory: "tampering",
        animated: true,
      },
      { id: "e3", source: "node-service", target: "node-s3" },
      {
        id: "e4",
        source: "node-service",
        target: "node-database",
        isThreatVector: true,
        threatCategory: "tampering",
        animated: true,
      },
      { id: "e5", source: "node-service", target: "node-redis" },
    ],
    threats: [
      {
        id: "threat-sqli",
        stride: "tampering",
        strideCode: "STRIDE-T: Tampering",
        title: "SQL Injection in Ledger Transfer Query",
        severity: "critical",
        cvssScore: 9.8,
        sourceNodeId: "node-service",
        compromisedNodeId: "node-database",
        edgeIds: ["e2", "e4"],
        summary:
          "Arbitrary SQL Execution via account_id parameter in app/transfer.py:42 leads to full ledger exfiltration.",
        affectedAssets: ["PostgreSQL: accounts, transactions", "Core Ledger Balance Table"],
        filePath: "app/transfer.py",
        lineNumber: 42,
        cweId: "CWE-89",
        remediationSnippet: {
          vulnerable: `cursor.execute(f"SELECT * FROM ledger WHERE account = '{account_id}'")`,
          patched: `cursor.execute("SELECT * FROM ledger WHERE account = %s", (account_id,))`,
          explanation:
            "Replaced raw string formatting with parameterized query statement, neutralising attacker SQL breakout.",
        },
      },
      {
        id: "threat-stripe-key",
        stride: "info_disclosure",
        strideCode: "STRIDE-I: Info Disclosure",
        title: "Hardcoded Live Stripe Secret Key",
        severity: "critical",
        cvssScore: 9.4,
        sourceNodeId: "node-service",
        compromisedNodeId: "node-s3",
        edgeIds: ["e2", "e3"],
        summary:
          "Exposed sk_live_... production credential permits unauthorized balance transfers and payment gateway hijacking.",
        affectedAssets: ["Stripe Payment Gateway", "S3 Invoices & Receipts"],
        filePath: "config/payment.py",
        lineNumber: 18,
        cweId: "CWE-798",
        remediationSnippet: {
          vulnerable: `STRIPE_KEY = "sk_live_51M0abcdef1234567890"`,
          patched: `STRIPE_KEY = os.environ.get("STRIPE_SECRET_KEY")`,
          explanation:
            "Loaded secret key dynamically from secure environment variables rather than persisting in source control.",
        },
      },
      {
        id: "threat-pan-logging",
        stride: "info_disclosure",
        strideCode: "STRIDE-I: Info Disclosure",
        title: "Plaintext Cardholder PAN Logging",
        severity: "high",
        cvssScore: 7.8,
        sourceNodeId: "node-service",
        compromisedNodeId: "node-redis",
        edgeIds: ["e2", "e5"],
        summary:
          "Primary Account Numbers (PAN) written unmasked to debug logs in violation of PCI DSS Requirement 3.4.",
        affectedAssets: ["Redis Session Cache", "Application Log Stream"],
        filePath: "services/logger.py",
        lineNumber: 64,
        cweId: "CWE-532",
        remediationSnippet: {
          vulnerable: `logger.debug(f"Processing payment for card: {card_number}")`,
          patched: `logger.debug(f"Processing payment for card: ************{card_number[-4:]}")`,
          explanation: "Masked all but last 4 digits before writing to log streams.",
        },
      },
      {
        id: "threat-auth-bypass",
        stride: "elevation_of_privilege",
        strideCode: "STRIDE-E: Elevation of Privilege",
        title: "Missing Role Check on Balance Adjustment Route",
        severity: "high",
        cvssScore: 8.5,
        sourceNodeId: "node-service",
        compromisedNodeId: "node-database",
        edgeIds: ["e2", "e4"],
        summary:
          "Unchecked authorization on internal /adjust-balance endpoint enables arbitrary balance crediting.",
        affectedAssets: ["PostgreSQL: accounts table"],
        filePath: "routes/admin.py",
        lineNumber: 29,
        cweId: "CWE-285",
      },
      {
        id: "threat-jwt-none",
        stride: "spoofing",
        strideCode: "STRIDE-S: Spoofing",
        title: "Insecure JWT Algorithm None Accepted",
        severity: "high",
        cvssScore: 8.1,
        sourceNodeId: "node-gateway",
        compromisedNodeId: "node-service",
        edgeIds: ["e1", "e2"],
        summary:
          "Gateway authentication verifies signature without pinning algorithm, allowing token forgery with alg: none.",
        affectedAssets: ["API Gateway Session Token", "Payment Service Identity"],
        filePath: "middleware/auth.py",
        lineNumber: 52,
        cweId: "CWE-345",
      },
    ],
  },

  healthcare: {
    id: "healthcare",
    title: "Healthcare EHR Patient Portal",
    subtitle:
      "Evaluates HIPAA Security Rule (§164.312) & GDPR against plaintext ePHI and broken authorization",
    industry: "healthcare",
    frameworks: ["hipaa", "gdpr", "soc2"],
    defaultActiveStride: "elevation_of_privilege",
    nodes: [
      {
        id: "node-client",
        label: "Patient Browser",
        subtitle: "/ External",
        type: "client",
        icon: "Globe",
        status: "safe",
        x: 30,
        y: 165,
      },
      {
        id: "node-gateway",
        label: "TLS Ingress",
        subtitle: "(HAProxy)",
        type: "gateway",
        icon: "Shield",
        status: "safe",
        x: 210,
        y: 165,
      },
      {
        id: "node-service",
        label: "EHR API Server",
        subtitle: "(records.py)",
        type: "service",
        icon: "Gear",
        status: "vulnerable",
        hasVulnerability: true,
        x: 390,
        y: 165,
      },
      {
        id: "node-s3",
        label: "PACS Cloud",
        subtitle: "MRI / X-Ray Dicom",
        type: "storage",
        icon: "Package",
        status: "safe",
        x: 580,
        y: 40,
      },
      {
        id: "node-database",
        label: "ePHI Database",
        subtitle: "Diagnostic Vault",
        type: "database",
        icon: "Database",
        status: "compromised",
        isCompromised: true,
        x: 580,
        y: 165,
      },
      {
        id: "node-redis",
        label: "Auth Token Store",
        subtitle: "(JWT Session)",
        type: "cache",
        icon: "Stack",
        status: "safe",
        x: 580,
        y: 290,
      },
    ],
    edges: [
      { id: "e1", source: "node-client", target: "node-gateway" },
      {
        id: "e2",
        source: "node-gateway",
        target: "node-service",
        isThreatVector: true,
        threatCategory: "elevation_of_privilege",
        animated: true,
      },
      { id: "e3", source: "node-service", target: "node-s3" },
      {
        id: "e4",
        source: "node-service",
        target: "node-database",
        isThreatVector: true,
        threatCategory: "elevation_of_privilege",
        animated: true,
      },
      { id: "e5", source: "node-service", target: "node-redis" },
    ],
    threats: [
      {
        id: "threat-bola",
        stride: "elevation_of_privilege",
        strideCode: "STRIDE-E: Elevation of Privilege",
        title: "Broken Object-Level Auth (BOLA) on Patient Records",
        severity: "critical",
        cvssScore: 8.8,
        sourceNodeId: "node-service",
        compromisedNodeId: "node-database",
        edgeIds: ["e2", "e4"],
        summary:
          "Insecure direct object reference on /api/patients/{id}/records allows any authenticated user to view other patients' ePHI.",
        affectedAssets: ["ePHI Diagnostic Vault", "Patient Treatment Histories"],
        filePath: "routes/records.py",
        lineNumber: 88,
        cweId: "CWE-639",
      },
      {
        id: "threat-unencrypted-ephi",
        stride: "info_disclosure",
        strideCode: "STRIDE-I: Info Disclosure",
        title: "Unencrypted ePHI Storage at Rest",
        severity: "critical",
        cvssScore: 8.5,
        sourceNodeId: "node-service",
        compromisedNodeId: "node-database",
        edgeIds: ["e2", "e4"],
        summary:
          "Medical diagnostic notes stored without AES-256 field-level encryption, violating HIPAA §164.312(a)(2)(iv).",
        affectedAssets: ["ePHI Diagnostic Vault"],
        filePath: "models/patient.py",
        lineNumber: 31,
        cweId: "CWE-311",
      },
      {
        id: "threat-insecure-cookie",
        stride: "spoofing",
        strideCode: "STRIDE-S: Spoofing",
        title: "Session Cookie Missing Secure & HttpOnly Flags",
        severity: "medium",
        cvssScore: 5.3,
        sourceNodeId: "node-client",
        compromisedNodeId: "node-service",
        edgeIds: ["e1", "e2"],
        summary:
          "Session tokens vulnerable to XSS exfiltration and transmission over unencrypted channels.",
        affectedAssets: ["Auth Token Store", "Patient Browser Session"],
        filePath: "server/session.py",
        lineNumber: 49,
        cweId: "CWE-614",
      },
    ],
  },

  ecommerce: {
    id: "ecommerce",
    title: "E-Commerce Cloud SaaS",
    subtitle:
      "Evaluates GDPR & ISO 27001 against path traversal, AWS key leakage, and vulnerable packages",
    industry: "ecommerce",
    frameworks: ["gdpr", "iso27001", "pci_dss"],
    defaultActiveStride: "info_disclosure",
    nodes: [
      {
        id: "node-client",
        label: "Shopper Browser",
        subtitle: "/ Web Client",
        type: "client",
        icon: "Globe",
        status: "safe",
        x: 30,
        y: 165,
      },
      {
        id: "node-gateway",
        label: "Cloud Ingress",
        subtitle: "(AWS ALB)",
        type: "gateway",
        icon: "Shield",
        status: "safe",
        x: 210,
        y: 165,
      },
      {
        id: "node-service",
        label: "Order & Invoice API",
        subtitle: "(invoice.py)",
        type: "service",
        icon: "Gear",
        status: "vulnerable",
        hasVulnerability: true,
        x: 390,
        y: 165,
      },
      {
        id: "node-s3",
        label: "AWS S3 Assets",
        subtitle: "(Invoices Bucket)",
        type: "storage",
        icon: "Package",
        status: "compromised",
        isCompromised: true,
        x: 580,
        y: 40,
      },
      {
        id: "node-database",
        label: "Customer DB",
        subtitle: "Orders & Addresses",
        type: "database",
        icon: "Database",
        status: "safe",
        x: 580,
        y: 165,
      },
      {
        id: "node-redis",
        label: "Cart Cache",
        subtitle: "(Active Carts)",
        type: "cache",
        icon: "Stack",
        status: "safe",
        x: 580,
        y: 290,
      },
    ],
    edges: [
      { id: "e1", source: "node-client", target: "node-gateway" },
      {
        id: "e2",
        source: "node-gateway",
        target: "node-service",
        isThreatVector: true,
        threatCategory: "info_disclosure",
        animated: true,
      },
      {
        id: "e3",
        source: "node-service",
        target: "node-s3",
        isThreatVector: true,
        threatCategory: "info_disclosure",
        animated: true,
      },
      { id: "e4", source: "node-service", target: "node-database" },
      { id: "e5", source: "node-service", target: "node-redis" },
    ],
    threats: [
      {
        id: "threat-path-traversal",
        stride: "info_disclosure",
        strideCode: "STRIDE-I: Info Disclosure",
        title: "Arbitrary File Download via Path Traversal",
        severity: "critical",
        cvssScore: 8.1,
        sourceNodeId: "node-service",
        compromisedNodeId: "node-s3",
        edgeIds: ["e2", "e3"],
        summary:
          "Unsanitized file parameter in controllers/invoice.py allows dot-dot-slash (/../) traversal to read server configs.",
        affectedAssets: ["AWS S3 Assets", "Host Operating System Files"],
        filePath: "controllers/invoice.py",
        lineNumber: 34,
        cweId: "CWE-22",
      },
      {
        id: "threat-s3-leak",
        stride: "info_disclosure",
        strideCode: "STRIDE-I: Info Disclosure",
        title: "Leaked AWS S3 Production Credentials",
        severity: "critical",
        cvssScore: 9.4,
        sourceNodeId: "node-service",
        compromisedNodeId: "node-s3",
        edgeIds: ["e2", "e3"],
        summary:
          "Hardcoded AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY found in deployment settings.",
        affectedAssets: ["AWS S3 Assets Bucket"],
        filePath: "deploy/settings.py",
        lineNumber: 19,
        cweId: "CWE-798",
      },
      {
        id: "threat-cve-req",
        stride: "tampering",
        strideCode: "STRIDE-T: Tampering",
        title: "Vulnerable Dependency: CVE-2018-18074 in requests",
        severity: "high",
        cvssScore: 7.5,
        sourceNodeId: "node-service",
        compromisedNodeId: "node-database",
        edgeIds: ["e2", "e4"],
        summary:
          "Older requests version leaks HTTP Basic Auth credentials during cross-domain 302 redirects.",
        affectedAssets: ["Order API", "External Payment Webhooks"],
        filePath: "requirements.txt",
        lineNumber: 12,
        cweId: "CWE-1104",
      },
    ],
  },
};

// ── Dynamic Attack Graph Generator for Real Scanned Codebases ────────────────

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function classifyFindingToStride(value: unknown): StrideCategory {
  const f = record(value);
  const cwe = text(f.cwe_id).toLowerCase();
  const title = text(f.title).toLowerCase();
  const desc = text(f.description).toLowerCase();
  const combined = `${title} ${desc} ${cwe}`;
  const cweCategories: Record<string, StrideCategory> = {
    "22": "info_disclosure",
    "200": "info_disclosure",
    "532": "info_disclosure",
    "798": "info_disclosure",
    "78": "tampering",
    "79": "tampering",
    "89": "tampering",
    "94": "tampering",
    "502": "tampering",
    "287": "spoofing",
    "306": "spoofing",
    "285": "elevation_of_privilege",
    "639": "elevation_of_privilege",
    "400": "dos",
    "770": "dos",
    "835": "dos",
    "1333": "dos",
    "117": "repudiation",
    "778": "repudiation",
  };
  const exactCwe = cwe.match(/^cwe-(\d+)$/)?.[1];
  if (exactCwe && cweCategories[exactCwe]) return cweCategories[exactCwe];

  // Specific access-control / availability signals take priority over broad
  // words such as "auth", "injection", or "log" in a description.
  if (/cwe-(285|639)\b|privilege|\bbola\b|\bidor\b|authorization bypass/.test(combined))
    return "elevation_of_privilege";
  if (
    /cwe-(400|770|835|1333)\b|\bredos\b|denial of service|resource exhaustion|unbounded loop/.test(
      combined,
    )
  )
    return "dos";
  if (
    combined.includes("sql") ||
    combined.includes("cwe-89") ||
    combined.includes("injection") ||
    combined.includes("deserial") ||
    combined.includes("xss") ||
    combined.includes("cwe-78")
  ) {
    return "tampering";
  }
  if (
    /\bsecrets?\b|\bpasswords?\b|\bpan\b|api[_ -]?key|private[_ -]?key|traversal/.test(combined)
  ) {
    return "info_disclosure";
  }
  if (
    combined.includes("auth") ||
    combined.includes("jwt") ||
    combined.includes("spoof") ||
    combined.includes("token") ||
    combined.includes("cookie") ||
    combined.includes("cwe-287")
  ) {
    return "spoofing";
  }
  if (
    combined.includes("privilege") ||
    combined.includes("bola") ||
    combined.includes("idor") ||
    combined.includes("bypass") ||
    combined.includes("cwe-285") ||
    combined.includes("cwe-639")
  ) {
    return "elevation_of_privilege";
  }
  if (
    combined.includes("log") ||
    combined.includes("audit") ||
    combined.includes("trail") ||
    combined.includes("repudiat")
  ) {
    return "repudiation";
  }
  if (
    combined.includes("dos") ||
    combined.includes("denial") ||
    combined.includes("memory") ||
    combined.includes("exhaust") ||
    combined.includes("loop")
  ) {
    return "dos";
  }

  // Default fallback based on severity
  return "tampering";
}

export function buildAttackGraphFromScan(
  value: unknown,
  scenarioId = "custom-scan",
): AttackGraphScenario {
  const scan = record(value);
  const targetName = text(scan.target_name) || text(scan.targetName) || "Scanned Codebase";
  const findings = Array.isArray(scan.findings)
    ? scan.findings
        .filter((f) => f !== null && typeof f === "object" && !Array.isArray(f))
        .map(record)
    : [];
  const frameworks = Array.isArray(scan.frameworks)
    ? [...new Set(scan.frameworks.map(text).filter(Boolean))]
    : [];
  // Findings establish source locations, not deployed infrastructure. Do not
  // invent S3, Redis, a gateway, or confirmed compromise from a CWE category.
  const nodes: AttackGraphNode[] = [
    {
      id: "node-service",
      label: "Scanned codebase",
      subtitle: targetName,
      type: "service",
      icon: "Gear",
      status: findings.length > 0 ? "vulnerable" : "safe",
      hasVulnerability: findings.length > 0,
      x: 0,
      y: 0,
      metadata: { scan_id: text(scan.scan_id) || scenarioId },
    },
  ];
  const edges: AttackGraphEdge[] = [];
  const locations = new Map<string, { nodeId: string; edgeId: string }>();

  // Convert findings into threat vectors
  const threats: ThreatVector[] = findings.map((f, idx) => {
    const stride = classifyFindingToStride(f);
    const def = STRIDE_DEFINITIONS[stride];
    const filePath = text(f.file_path).replace(/\\/g, "/");
    const locationKey = filePath || "[unlocated]";
    let location = locations.get(locationKey);
    if (!location) {
      location = { nodeId: `node-file-${locations.size}`, edgeId: `edge-file-${locations.size}` };
      locations.set(locationKey, location);
      nodes.push({
        id: location.nodeId,
        label: filePath.split("/").pop() || "Unlocated findings",
        subtitle: filePath || "No source file recorded",
        type: "service",
        icon: "Gear",
        status: "vulnerable",
        hasVulnerability: true,
        x: 0,
        y: 0,
        metadata: filePath ? { file: filePath } : undefined,
      });
      edges.push({
        id: location.edgeId,
        source: "node-service",
        target: location.nodeId,
        label: "Finding",
      });
    }
    const severity = text(f.severity).toLowerCase();
    const score = f.cvss_score;
    const steps = Array.isArray(f.remediation_steps)
      ? f.remediation_steps.map(text).filter(Boolean).join("\n")
      : text(f.remediation_steps) || text(f.remediation);
    const vulnerable = typeof f.code_snippet === "string" ? f.code_snippet : "";
    return {
      id: `${text(f.id) || "finding"}-${idx}`,
      findingId: /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(text(f.id)) ? text(f.id) : undefined,
      scanId: /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(text(scan.scan_id)) ? text(scan.scan_id) : undefined,
      stride,
      strideCode: `${def.code}: ${def.name}`,
      title: text(f.title) || "Detected finding",
      severity:
        severity === "critical" || severity === "high" || severity === "medium" ? severity : "low",
      cvssScore:
        typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 10
          ? score
          : null,
      sourceNodeId: "node-service",
      compromisedNodeId: location.nodeId,
      edgeIds: [location.edgeId],
      summary:
        text(f.description) || "Review this finding to establish its impact and exploitability.",
      affectedAssets: filePath ? [filePath] : [],
      filePath: filePath || undefined,
      lineNumber:
        typeof f.line_number === "number" && Number.isInteger(f.line_number) && f.line_number > 0
          ? f.line_number
          : undefined,
      cweId: text(f.cwe_id) || undefined,
      // Remediation instructions are not executable patches. Only show captured
      // evidence; never offer placeholder code as a production fix.
      remediationSnippet:
        vulnerable || steps ? { vulnerable, patched: "", explanation: steps } : undefined,
    };
  });

  const defaultActiveStride = threats.length > 0 ? threats[0].stride : "tampering";

  return {
    id: scenarioId,
    title: targetName,
    subtitle: `Inferred from saved audit findings (${findings.length} findings, ${frameworks.length} frameworks); topology requires validation`,
    industry: "custom",
    frameworks,
    nodes,
    edges,
    threats,
    defaultActiveStride,
  };
}

// ── Attack Graph Storage Helper ───────────────────────────────────────────────

const ATTACK_GRAPH_STORAGE_KEY_PREFIX = "threatlens_attack_graphs_v1";

export function getAttackGraphStorageKey(workspaceId?: string): string {
  return `${ATTACK_GRAPH_STORAGE_KEY_PREFIX}_${workspaceId || "global"}`;
}

export function saveCustomAttackGraph(scenario: AttackGraphScenario, workspaceId?: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = accountStorage.getItem(getAttackGraphStorageKey(workspaceId));
    const list: AttackGraphScenario[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter((s) => s.id !== scenario.id);
    const updated = [scenario, ...filtered].slice(0, 20);
    accountStorage.setItem(getAttackGraphStorageKey(workspaceId), JSON.stringify(updated));
  } catch (err) {
    console.warn("Could not save attack graph to accountStorage:", err);
  }
}

export function loadCustomAttackGraphs(workspaceId?: string): AttackGraphScenario[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = accountStorage.getItem(getAttackGraphStorageKey(workspaceId));
    if (!raw) return [];
    return JSON.parse(raw) as AttackGraphScenario[];
  } catch {
    return [];
  }
}
