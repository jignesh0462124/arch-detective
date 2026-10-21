# Archon workbench image generation briefs

Created 17 October 2026 with the built-in image generator. These are UI concept images, not screenshots of an implemented feature.

Reference 1 for the main screen was the verified current Archon light-theme screenshot at output/playwright/archon-logo/desktop-light.png. Reference 2 was docs/brand/archon-refined-v1/archon-wordmark.png. The upload-screen reference was the generated workbench plus the same logo. The product tokens and current scan/ingestion contracts informed the briefs.

## Audit workbench

```text
Use case: ui-mockup
Asset type: a professional, high fidelity product UI design image of a NEW Archon Audit Workbench page; a single full application screen, landscape 1920 by 1200 proportions, opaque background.
Input images: Image 1 is a STYLE REFERENCE of the existing Archon website: use its colors, understated buttons, compact typography and line weights, but build an internal product screen, do not copy its marketing hero or imagery. Image 2 is the EXACT ARCHON LOGO reference, preserve this new architectural A symbol with orange square and ARCHON wordmark in the top left.
Primary request: Design the page a user opens AFTER uploading a project ZIP and receiving a completed security scan. This is a VS Code-like code review workbench, matching Archon's existing tasteful cream, white, charcoal and signal-orange product system. It must feel like a carefully composed real engineering product designed by a senior product designer, functional and restrained.
Layout: edge-to-edge product screenshot, no browser or laptop frame. A fixed white 208px sidebar left with logo then small workspace switcher 'Engineering' and navigation rows with thin consistent outline icons: Dashboard; Codebase Audit (selected with subtle warm-gray fill); Attack Graph; Findings; Reports; Audit log; Security Advisor. Small user avatar with initials JS bottom.
Main content has a cream #F5F1EC background. Top app bar has breadcrumb 'Engineering / Codebase Audit / api-service', search shortcut and quiet theme icon and avatar. Page heading 'Audit Workbench' in Inter medium with subtext 'api-service.zip · Scan SCN-1042'. Right actions outlined 'New scan' and charcoal 'Export report'. Compact inline summary strip 'Scan complete' with green check, '47 files', '12 findings', red '2 critical', orange '4 high', amber '4 medium', muted-blue '2 low', 'Read-only snapshot'. Counts must be consistent.
Large workspace below fills most of screen, white surface with #D3CEC6 one-pixel borders and only 4px corner rounding. NO floating cards. Three adjacent panes:
LEFT file explorer 240px wide. Toolbar 'Files' with search icon, filter 'All files'. Tree root 'api-service', expanded app folder with routes folder and selected 'users.py' (warm cream selection, thin orange left indicator, red badge '2'); 'auth.py' badge 1; 'models.py'; 'config.py'; 'requirements.txt' badge2; 'docker-compose.yml' badge1; collapsed tests. Compact file extension glyphs. Footer '47 files indexed'.
CENTER source editor approx 710px with tabs users.py active, auth.py, docker-compose.yml. Breadcrumb 'app / routes / users.py'. Toolbar small 'Python' and lock 'Read only'. JetBrains Mono code with muted syntax colors on white. Line numbers 21 through 35. One red gutter dot at 28; line 28 very pale red row, line 29 very pale red row. Precisely show this harmless illustrative Python code fragment:
21  @router.get("/users")
22  def find_user(request, db):
23      name = request.query_params.get("name", "")
24
25      # Fetch matching account
26      cursor = db.cursor()
27
28      query = "SELECT * FROM users WHERE name = '" + name + "'"
29      cursor.execute(query)
30      rows = cursor.fetchall()
31
32      return {"users": rows}
Below editor line28 an unobtrusive inline warning strip 'SQL injection · CWE-89' and 'View finding' link.
RIGHT inspector approx 340px, white, border-left. Header 'Finding details' with previous/next chevrons and '1 of 12'. Thin tabs 'Evidence', 'Controls', 'Remediation'. Evidence active orange underline. Red soft badge 'Critical', text 'CWE-89', heading 'SQL injection', small 'CVSS 9.8'. File reference 'app/routes/users.py:28'. Short readable description 'User input is concatenated into a SQL query.' Section 'Why it matters': 'An attacker may read or modify database records.' Section 'Detected by' small 'Semgrep' and 'LLM review'. Section 'Suggested control' 'SOC 2 · CC6.1' and muted 'Review required'. Bottom charcoal button 'View remediation' then helper 'Suggestions do not change uploaded code.'
BOTTOM dock spanning editor and inspector only, thin tabs 'Problems 12' active orange underline; 'Scan activity'; 'Summary'. Table columns Severity / Finding / File / Line. Three visible rows: Critical / SQL injection / app/routes/users.py / 28 ; Critical / Hardcoded credential / app/config.py / 12 ; High / Missing authentication / app/routes/auth.py / 41. Selected SQL injection row faint warm cream. No terminal prompt.
BOTTOM page status bar warm cream: small lock 'Read only'; 'Snapshot retained'; right 'UTF-8' 'Python' 'Ln 28, Col 7'.
Design: exact colors cream #F5F1EC, white #FFFFFF, text #111111, secondary #626260, dividers #D3CEC6, brand orange #FF5600 only sparse selection indicators. Inter sans for UI, JetBrains Mono source. 16px line icons resembling Phosphor, 14px interface text, 13px code, sober thin borders. Source editor stays light. Clear alignment, intentional whitespace, appropriate dense developer-tool layout. All components rectangular and grid aligned.
Constraints: all key labels readable and correctly spelled; consistent example counts; flat screenshot; no glossy effects, purple gradients, glows, shadows, giant dashboard cards, mascots, decorative cyber shields, invented metrics, generic AI stars, visual clutter, watermark or promotional slogans. No terminal, no Run code, no automatic apply fix. This image is a planned feature concept, not a claim of current implementation.
```

## New audit upload screen

```text
Use case: ui-mockup
Asset type: high fidelity companion product screenshot, opaque, landscape 1920x1200 proportions.
Input images: Image 1 is the STYLE AND LAYOUT REFERENCE: the newly designed Archon Audit Workbench. Preserve its sober cream/white interface, exact logo, sidebar width and nav rows, compact Phosphor-style thin line icons, borders, typography, and user identity. It is not an edit target; create its BEFORE-SCAN upload/setup page. Image 2 is the exact Archon wordmark.
Primary request: Create a professional Archon 'New audit' upload setup screen for code security auditing, clearly showing a project ZIP plus supporting architecture and log files, which will lead to the Audit Workbench after scanning. It must look like a plausible carefully designed real software product with straight aligned panels, readable functional text and a quiet editorial layout.
Layout: edge to edge application screen, no browser chrome, 208px white left sidebar identical to reference: ARCHON logo, Engineering workspace, Dashboard, Codebase Audit selected, Attack Graph, Findings, Reports, Audit log, Security Advisor, JS avatar and Jordan Smith at bottom.
Cream #F5F1EC main canvas. Top breadcrumb 'Engineering / Codebase Audit / New audit'. Page heading 'New audit' with helper 'Upload your project and supporting evidence.' Right small outlined 'View scan history'.
Below heading a compact horizontal step indicator: '1 Upload and configure' active with thin orange rule, '2 Scan project', '3 Review in workbench'.
Two-column content: large white panel 68 percent width and narrower white configuration panel 32 percent width, 1px #D3CEC6 dividers, corner radius4, 24px padding, no shadows.
Left panel heading 'Project source'; below segmented source choices 'ZIP project' active / 'Git repository' / 'Architecture' / 'Logs'. Under that a rectangular understated dashed upload area with small upload line icon, title 'Drop a project ZIP here', helper 'or browse files', quiet text '.zip source archive'. Below a selected file row 'api-service.zip' with file icon, '2.4 MB', outlined green 'Uploaded', and a remove X. Then divider. Heading 'Supporting evidence' with small 'Optional' text and right 'Add files' outlined button with plus icon. Helper 'Attach architecture and logs to the same audit.' Two tidy file rows: 'docker-compose.yml' / 'Architecture' / '12 KB' / green check; 'access.log' / 'Server logs' / '846 KB' / green check. At bottom small information row 'Other evidence formats: YAML, YML, JSON, JSONL, CSV, LOG, TXT'. Another muted row with lock icon 'Private to your workspace'.
Right panel heading 'Audit settings'; label 'Project name'; text input value 'api-service'. Label 'Audit scope'; selected radio 'Full project audit'; helper 'Code, architecture and log evidence'. Section 'Compliance frameworks' with five checkboxes, all checked, labels 'SOC 2', 'ISO 27001', 'GDPR', 'PCI DSS', 'NIST CSF'. Small note 'Controls are retrieved for each finding.' Section 'After the scan' showing 'Open Audit Workbench' selected with a small editor-window icon, helper 'Browse files, inspect findings and review remediation.' Section 'Source access' with lock 'Read-only snapshot'.
Full-width bottom action bar on cream under both cards: left small text '3 inputs attached' and helper 'Files are validated before analysis.' Right plain 'Cancel' then charcoal primary 'Start audit' with right arrow. Under bar a quiet small horizontal 'What happens next' line: 'Validate files → Scan evidence → Map controls → Open workbench'. Keep enough breathing room so every item fits.
Colors: pure white panels, warm cream background #F5F1EC, charcoal #111111, muted #626260, hairlines #D3CEC6, orange #FF5600 only selected accents, green #0B8F3C for upload checks. No gradients, glows, shadows, glossy surfaces, purple, giant icons, mascots, illustrations, decorative background, watermark, invented charts, impossible totals or marketing headings. Main text Inter 14px; headings Inter medium 28px; file paths JetBrains Mono if used. Precise consistent thin outline icons and 8px spacing rhythm. Preserve ARCHON identity exactly. All UI text legible, correctly spelled, and fully contained. This is a proposed future screen, not existing implemented functionality.
```

