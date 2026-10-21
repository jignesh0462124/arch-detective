/**
 * ThreatLens Compliance & Regulatory Framework Mapping Engine.
 * Maps security findings and CWE IDs to authoritative regulatory acts:
 * - GDPR (EU General Data Protection Regulation)
 * - SOC 2 Type II (AICPA Trust Services Criteria)
 * - ISO/IEC 27001:2022 (Information Security Management)
 * - PCI DSS v4.0 (Payment Card Industry Data Security Standard)
 * - NIST CSF 2.0 (National Institute of Standards & Technology Cybersecurity Framework)
 */

export interface ResolvedComplianceViolation {
  framework: string;
  control_id: string;
  control_title: string;
  act_name: string;
  requirement: string;
}

export function getFrameworkActName(fw: string): string {
  const norm = fw.toLowerCase().replace(/[-_\s]/g, "");
  if (norm === "gdpr") return "EU General Data Protection Regulation";
  if (norm === "soc2") return "AICPA SOC 2 Type II";
  if (norm === "iso27001") return "ISO/IEC 27001:2022 Annex A";
  if (norm === "pcidss") return "PCI DSS v4.0";
  if (norm === "nistcsf") return "NIST CSF 2.0";
  return fw.toUpperCase().replace("_", " ");
}

export function resolveComplianceViolations(
  finding: {
    cwe_id?: string | null;
    cve_id?: string | null;
    title?: string;
    violations?: Array<{
      framework: string;
      control_id: string;
      control_title: string;
      description?: string;
    }>;
  },
  targetFrameworks?: string[],
): ResolvedComplianceViolation[] {
  const cwe = String(finding.cwe_id || "").toUpperCase();
  const title = (finding.title || "").toLowerCase();

  const existingMap = new Map<string, ResolvedComplianceViolation>();
  if (Array.isArray(finding.violations) && finding.violations.length > 0) {
    for (const v of finding.violations) {
      const fwKey = String(v.framework || "").toLowerCase().replace(/[-_\s]/g, "");
      existingMap.set(fwKey, {
        framework: v.framework,
        control_id: v.control_id,
        control_title: v.control_title,
        act_name: getFrameworkActName(v.framework),
        requirement: v.description || v.control_title,
      });
    }
  }

  const frameworks =
    targetFrameworks && targetFrameworks.length > 0
      ? targetFrameworks
      : ["gdpr", "soc2", "iso27001", "pci_dss", "nist_csf"];

  const results: ResolvedComplianceViolation[] = [];

  for (const rawFw of frameworks) {
    const fw = rawFw.toLowerCase().replace(/[-_\s]/g, "");
    if (existingMap.has(fw)) {
      results.push(existingMap.get(fw)!);
      continue;
    }

    if (fw === "gdpr") {
      if (
        cwe.includes("798") ||
        cwe.includes("312") ||
        cwe.includes("311") ||
        title.includes("credential") ||
        title.includes("secret") ||
        title.includes("password")
      ) {
        results.push({
          framework: "gdpr",
          control_id: "Art. 32(1)(a)",
          control_title: "Encryption & Storage Protection of Authentication Credentials",
          act_name: "EU General Data Protection Regulation",
          requirement:
            "Mandates appropriate technical measures including pseudonymisation and encryption of sensitive identity data.",
        });
      } else if (
        cwe.includes("89") ||
        cwe.includes("78") ||
        cwe.includes("22") ||
        title.includes("injection") ||
        title.includes("traversal")
      ) {
        results.push({
          framework: "gdpr",
          control_id: "Art. 32(1)(b)",
          control_title: "Security of Processing: Ongoing Confidentiality & System Integrity",
          act_name: "EU General Data Protection Regulation",
          requirement:
            "Mandates continuous safeguards against arbitrary query manipulation, path tampering, and unauthorized data extraction.",
        });
      } else {
        results.push({
          framework: "gdpr",
          control_id: "Art. 25 & 32",
          control_title: "Data Protection by Design & Baseline Resilience",
          act_name: "EU General Data Protection Regulation",
          requirement:
            "Requires state-of-the-art software security defaults and routine technical evaluations to prevent data breaches.",
        });
      }
    } else if (fw === "soc2") {
      if (
        cwe.includes("798") ||
        cwe.includes("312") ||
        title.includes("credential") ||
        title.includes("secret")
      ) {
        results.push({
          framework: "soc2",
          control_id: "CC6.7",
          control_title: "Transmission and Storage Protection of Sensitive Credentials",
          act_name: "AICPA SOC 2 Type II",
          requirement:
            "Requires secrets and credentials to be safeguarded with secure key stores and encryption mechanisms.",
        });
      } else if (
        cwe.includes("89") ||
        cwe.includes("287") ||
        title.includes("injection") ||
        title.includes("auth")
      ) {
        results.push({
          framework: "soc2",
          control_id: "CC6.1",
          control_title: "Logical and Physical Access Controls",
          act_name: "AICPA SOC 2 Type II",
          requirement:
            "Restricts logical access to authorized entrypoints to prevent malicious database manipulation.",
        });
      } else if (cwe.includes("1395") || title.includes("dependency") || title.includes("cve")) {
        results.push({
          framework: "soc2",
          control_id: "CC7.1",
          control_title: "Vulnerability Management and Component Patching",
          act_name: "AICPA SOC 2 Type II",
          requirement:
            "Requires automated tracking and timely remediation of vulnerable third-party components.",
        });
      } else {
        results.push({
          framework: "soc2",
          control_id: "CC6.6",
          control_title: "System Operations and Boundary Protection",
          act_name: "AICPA SOC 2 Type II",
          requirement:
            "Enforces application security boundaries and input sanitization across service boundaries.",
        });
      }
    } else if (fw === "iso27001") {
      if (
        cwe.includes("798") ||
        cwe.includes("312") ||
        cwe.includes("328") ||
        title.includes("secret") ||
        title.includes("hash")
      ) {
        results.push({
          framework: "iso27001",
          control_id: "A.8.24",
          control_title: "Use of Strong Cryptography & Key Management",
          act_name: "ISO/IEC 27001:2022 Annex A",
          requirement:
            "Defines cryptographic controls and prohibits plaintext storage of credentials or weak hash algorithms.",
        });
      } else if (
        cwe.includes("89") ||
        cwe.includes("22") ||
        cwe.includes("78") ||
        title.includes("injection") ||
        title.includes("traversal")
      ) {
        results.push({
          framework: "iso27001",
          control_id: "A.14.2.5",
          control_title: "Secure System Engineering Principles",
          act_name: "ISO/IEC 27001:2022 Annex A",
          requirement:
            "Requires principles for secure software engineering to be strictly applied during development.",
        });
      } else if (cwe.includes("1395") || title.includes("cve") || title.includes("vulnerable")) {
        results.push({
          framework: "iso27001",
          control_id: "A.12.6.1",
          control_title: "Management of Technical Vulnerabilities",
          act_name: "ISO/IEC 27001:2022 Annex A",
          requirement:
            "Enforces continuous evaluation of known vulnerabilities in production libraries and dependencies.",
        });
      } else {
        results.push({
          framework: "iso27001",
          control_id: "A.14.2.1",
          control_title: "Secure Development Policy and Controls",
          act_name: "ISO/IEC 27001:2022 Annex A",
          requirement:
            "Mandates secure coding standards, input validation, and secure architectural baselines.",
        });
      }
    } else if (fw === "pcidss") {
      if (
        cwe.includes("311") ||
        cwe.includes("312") ||
        cwe.includes("798") ||
        title.includes("pan") ||
        title.includes("card") ||
        title.includes("secret")
      ) {
        results.push({
          framework: "pci_dss",
          control_id: "Req. 3.4",
          control_title: "Render Primary Account Numbers and Sensitive Data Unreadable",
          act_name: "PCI DSS v4.0",
          requirement:
            "PAN and authentication secrets must be rendered unreadable anywhere they are stored.",
        });
      } else if (
        cwe.includes("89") ||
        cwe.includes("78") ||
        cwe.includes("22") ||
        title.includes("injection") ||
        title.includes("traversal")
      ) {
        results.push({
          framework: "pci_dss",
          control_id: "Req. 6.2.4",
          control_title: "Mitigation of Software Vulnerabilities & Query Injection Attacks",
          act_name: "PCI DSS v4.0",
          requirement:
            "Requires bespoke applications to be hardened against SQL injection, path traversal, and malicious input.",
        });
      } else if (cwe.includes("287") || title.includes("auth") || title.includes("jwt")) {
        results.push({
          framework: "pci_dss",
          control_id: "Req. 8.2",
          control_title: "User Identification and Management of Authentication Tokens",
          act_name: "PCI DSS v4.0",
          requirement:
            "Requires verified token signatures and multi-factor authentication for sensitive API requests.",
        });
      } else {
        results.push({
          framework: "pci_dss",
          control_id: "Req. 6.2",
          control_title: "Bespoke and Custom Software Vulnerability Hardening",
          act_name: "PCI DSS v4.0",
          requirement:
            "Requires custom software components to be protected against recognized OWASP Top 10 flaws.",
        });
      }
    } else if (fw === "nistcsf") {
      if (
        cwe.includes("798") ||
        cwe.includes("312") ||
        cwe.includes("311") ||
        title.includes("secret") ||
        title.includes("password")
      ) {
        results.push({
          framework: "nist_csf",
          control_id: "PR.DS-1",
          control_title: "Data-at-Rest and Confidential Credentials Protection",
          act_name: "NIST CSF 2.0",
          requirement:
            "Data-at-rest is protected against unauthorized access and credential extraction.",
        });
      } else if (
        cwe.includes("89") ||
        cwe.includes("1395") ||
        cwe.includes("22") ||
        title.includes("injection") ||
        title.includes("cve")
      ) {
        results.push({
          framework: "nist_csf",
          control_id: "PR.IP-1",
          control_title: "Baseline Security Configuration and System Development Life Cycle",
          act_name: "NIST CSF 2.0",
          requirement:
            "A baseline configuration is maintained to mitigate common code and architectural vulnerabilities.",
        });
      } else {
        results.push({
          framework: "nist_csf",
          control_id: "PR.AC-1",
          control_title: "Identities and Credentials Managed & Protected",
          act_name: "NIST CSF 2.0",
          requirement:
            "Identities and credentials are authenticated and managed with least privilege access.",
        });
      }
    }
  }

  return results;
}
