// Isolated Postgres regression tests. Never connects to a Supabase project.
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import assert from "node:assert/strict";

const db = new PGlite();
let checks = 0;
const ids = Object.fromEntries(
  [
    "owner",
    "admin",
    "analyst",
    "viewer",
    "outsider",
    "workspace",
    "other",
    "scan",
    "finding",
    "report",
    "event",
    "violation",
    "invite",
  ].map((key, index) => [key, `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`]),
);
const q = (sql) => db.query(sql);
async function as(role, user) {
  await db.exec("RESET ROLE");
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [user ?? ""]);
  await db.exec(`SET ROLE ${role}`);
}
async function count(sql, expected) {
  assert.equal((await q(sql)).rows.length, expected, sql);
  checks++;
}
async function denied(sql) {
  await assert.rejects(q(sql), (error) => error.code === "42501", sql);
  checks++;
}
try {
  await db.exec(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS; CREATE ROLE threatlens_backend NOLOGIN;
    CREATE SCHEMA auth;
    CREATE SCHEMA storage;
    CREATE TABLE storage.buckets(id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text, name text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA storage TO anon, authenticated;
    GRANT ALL ON storage.objects TO anon, authenticated;
    CREATE POLICY old_permissive_storage ON storage.objects FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, raw_app_meta_data jsonb DEFAULT '{}', raw_user_meta_data jsonb DEFAULT '{}');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
    -- Only replaces pgcrypto's random default in this isolated test fixture.
    CREATE FUNCTION public.gen_random_bytes(n integer) RETURNS bytea LANGUAGE sql AS $$ SELECT decode(repeat(replace(gen_random_uuid()::text, '-', ''), n), 'hex') $$;`);
  for (const file of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    if (file.endsWith("_harden_workspace_rls.sql")) {
      await db.exec(
        "GRANT USAGE ON SCHEMA public TO threatlens_backend; GRANT SELECT ON scans TO threatlens_backend; CREATE POLICY backend_full_access ON scans FOR ALL TO threatlens_backend USING (true) WITH CHECK (true)",
      );
    }
    const sql = (await readFile(`supabase/migrations/${file}`, "utf8")).replace(
      /^create extension if not exists .*;\r?$/gim,
      "",
    );
    await db.exec(sql);
  }
  for (const user of ["owner", "admin", "analyst", "viewer", "outsider"]) {
    await db.query("INSERT INTO auth.users(id,email) VALUES ($1,$2)", [
      ids[user],
      `${user}@example.invalid`,
    ]);
  }
  await as("authenticated", ids.owner);
  await q(
    `INSERT INTO workspaces(id,name,slug,owner_user_id) VALUES ('${ids.workspace}','Test workspace','test-workspace','${ids.owner}')`,
  );
  await count(`SELECT * FROM workspace_members WHERE role='owner'`, 1);
  for (const role of ["admin", "analyst", "viewer"]) {
    await q(
      `INSERT INTO workspace_members(workspace_id,user_id,role) VALUES ('${ids.workspace}','${ids[role]}','${role}')`,
    );
  }
  await q(
    `INSERT INTO scans(id,workspace_id,created_by,target_name,status) VALUES ('${ids.scan}','${ids.workspace}','${ids.owner}','Fixture','completed')`,
  );
  await q(
    `INSERT INTO findings(id,scan_id,title,severity,source) VALUES ('${ids.finding}','${ids.scan}','Fixture finding','high','llm-review')`,
  );
  await q(`INSERT INTO reports(id,scan_id,status) VALUES ('${ids.report}','${ids.scan}','ready')`);
  await q(
    `INSERT INTO compliance_violations(id,finding_id,framework,control_id,control_title) VALUES ('${ids.violation}','${ids.finding}','soc2','CC6.1','Access')`,
  );
  await q(
    `INSERT INTO audit_events(id,workspace_id,actor_user_id,event_type) VALUES ('${ids.event}','${ids.workspace}','${ids.owner}','test')`,
  );
  await q(
    `INSERT INTO workspace_invites(id,workspace_id,invited_by,invited_email,role,token) VALUES ('${ids.invite}','${ids.workspace}','${ids.owner}','invite@example.invalid','viewer','fixture-token')`,
  );
  await as("authenticated", ids.outsider);
  await q(
    `INSERT INTO workspaces(id,name,slug,owner_user_id) VALUES ('${ids.other}','Other workspace','other-workspace','${ids.outsider}')`,
  );
  const tables = [
    "workspaces",
    "workspace_members",
    "workspace_invites",
    "scans",
    "findings",
    "compliance_violations",
    "reports",
    "audit_events",
    "workspaces_with_counts",
  ];
  for (const table of tables) {
    // All child data belongs to the first workspace, except the outsider's own membership/workspace.
    await count(
      `SELECT * FROM ${table}`,
      ["workspaces", "workspace_members", "workspaces_with_counts"].includes(table) ? 1 : 0,
    );
  }
  await denied(
    `INSERT INTO scans(workspace_id,created_by,target_name) VALUES ('${ids.workspace}','${ids.outsider}','Cross-tenant')`,
  );
  await denied(
    `INSERT INTO workspace_members(workspace_id,user_id,role) VALUES ('${ids.workspace}','${ids.outsider}','owner')`,
  );
  await denied(
    `INSERT INTO workspaces(name,slug,owner_user_id) VALUES ('Spoof','spoof-owner','${ids.owner}')`,
  );
  await count(`SELECT * FROM profiles WHERE id='${ids.owner}'`, 0);
  for (const role of ["owner", "admin", "analyst", "viewer"]) {
    await as("authenticated", ids[role]);
    for (const table of [
      "scans",
      "findings",
      "reports",
      "compliance_violations",
      "workspaces_with_counts",
    ])
      await count(`SELECT * FROM ${table}`, 1);
    await count(`SELECT * FROM profiles`, 4);
    await count(`SELECT * FROM audit_events`, ["owner", "admin"].includes(role) ? 1 : 0);
    await count(`SELECT * FROM workspace_invites`, ["owner", "admin"].includes(role) ? 1 : 0);
    await count(
      `UPDATE findings SET state='resolved' WHERE id='${ids.finding}' RETURNING id`,
      role === "viewer" ? 0 : 1,
    );
    await count(
      `UPDATE workspaces SET name='Renamed' WHERE id='${ids.workspace}' RETURNING id`,
      ["owner", "admin"].includes(role) ? 1 : 0,
    );
    await denied(`UPDATE workspaces SET owner_user_id='${ids[role]}' WHERE id='${ids.workspace}'`);
    await denied(`UPDATE scans SET workspace_id='${ids.other}' WHERE id='${ids.scan}'`);
    await denied(`UPDATE findings SET scan_id=gen_random_uuid() WHERE id='${ids.finding}'`);
    await denied(
      `INSERT INTO audit_events(workspace_id,actor_user_id,event_type) VALUES ('${ids.workspace}','${ids.outsider}','forged')`,
    );
    await count(
      `UPDATE workspace_members SET role='viewer' WHERE user_id='${ids.owner}' RETURNING user_id`,
      0,
    );
    if (["owner", "admin"].includes(role)) {
      await denied(`UPDATE workspace_members SET role='owner' WHERE user_id='${ids.viewer}'`);
      await denied(
        `INSERT INTO workspace_invites(workspace_id,invited_by,invited_email,role,token) VALUES ('${ids.workspace}','${ids[role]}','x@example.invalid','owner','owner-${role}')`,
      );
    }
  }
  // The History helper's exact conditional DELETE, including eligibility and tenant scope.
  for (const role of ["owner", "admin", "analyst", "viewer", "outsider", "anon"]) {
    for (const status of ["completed", "failed", "running", "pending"]) {
      await db.exec("RESET ROLE");
      const temporary = (
        await q(`INSERT INTO scans(workspace_id,created_by,target_name,scan_type,status)
        VALUES ('${ids.workspace}','${ids.owner}','Deletion fixture','codebase','${status}') RETURNING id`)
      ).rows[0].id;
      await as(role === "anon" ? "anon" : "authenticated", ids[role]);
      const deletion = (workspace) =>
        `DELETE FROM scans WHERE id='${temporary}' AND workspace_id='${workspace}' AND scan_type='codebase' AND status IN ('completed','failed') RETURNING id`;
      if (role === "anon") await denied(deletion(ids.workspace));
      else {
        await count(deletion(ids.other), 0);
        const eligible =
          ["owner", "admin"].includes(role) && ["completed", "failed"].includes(status);
        await count(deletion(ids.workspace), eligible ? 1 : 0);
        if (eligible) await count(deletion(ids.workspace), 0);
      }
      await db.exec("RESET ROLE");
      await q(`DELETE FROM scans WHERE id='${temporary}'`);
    }
  }
  await as("authenticated", ids.viewer);
  // Findings triage must persist every state, reject wrong scan scopes and honor role revocation.
  for (const state of ["open", "accepted_risk", "resolved", "false_positive"]) {
    await as("authenticated", ids.owner);
    await count(
      `UPDATE findings SET state='${state}' WHERE id='${ids.finding}' AND scan_id='${ids.scan}' RETURNING id`,
      1,
    );
    await count(`SELECT id FROM findings WHERE id='${ids.finding}' AND state='${state}'`, 1);
    await count(
      `UPDATE findings SET state='open' WHERE id='${ids.finding}' AND scan_id=gen_random_uuid() RETURNING id`,
      0,
    );
    await as("authenticated", ids.viewer);
    await count(`UPDATE findings SET state='${state}' WHERE id='${ids.finding}' RETURNING id`, 0);
  }
  await as("authenticated", ids.owner);
  await q(
    `DELETE FROM workspace_members WHERE workspace_id='${ids.workspace}' AND user_id='${ids.analyst}'`,
  );
  await as("authenticated", ids.analyst);
  await count(`SELECT * FROM findings WHERE id='${ids.finding}'`, 0);
  await count(
    `DELETE FROM scans WHERE id='${ids.scan}' AND workspace_id='${ids.workspace}' AND status IN ('completed','failed') RETURNING id`,
    0,
  );
  await count(`UPDATE findings SET state='open' WHERE id='${ids.finding}' RETURNING id`, 0);
  await as("authenticated", ids.owner);
  await q(
    `INSERT INTO workspace_members(workspace_id,user_id,role) VALUES ('${ids.workspace}','${ids.analyst}','analyst')`,
  );
  await as("authenticated", ids.viewer);
  await denied(
    `INSERT INTO scans(workspace_id,created_by,target_name) VALUES ('${ids.workspace}','${ids.viewer}','Denied')`,
  );
  await denied(
    `INSERT INTO findings(scan_id,title,severity,source) VALUES ('${ids.scan}','Denied','low','llm-review')`,
  );
  await denied(`INSERT INTO reports(scan_id) VALUES ('${ids.scan}')`);
  await count(`DELETE FROM scans WHERE id='${ids.scan}' RETURNING id`, 0);
  await as("authenticated", ids.analyst);
  await q(
    `INSERT INTO scans(workspace_id,created_by,target_name) VALUES ('${ids.workspace}','${ids.analyst}','Allowed')`,
  );
  await q(`INSERT INTO reports(scan_id) VALUES ('${ids.scan}')`);
  checks += 2;
  await denied(
    `INSERT INTO reports(scan_id,object_path) VALUES ('${ids.scan}','other-tenant/report.pdf')`,
  );
  await denied(`UPDATE reports SET object_path='other-tenant/report.pdf' WHERE id='${ids.report}'`);
  await denied(`UPDATE reports SET sha256='fake-proof' WHERE id='${ids.report}'`);
  await count(`DELETE FROM scans WHERE id='${ids.scan}' RETURNING id`, 0);
  await as("anon");
  for (const table of ["profiles", ...tables]) await denied(`SELECT * FROM ${table}`);
  await denied(
    `INSERT INTO workspaces(name,slug,owner_user_id) VALUES ('Anon','anon-workspace','${ids.owner}')`,
  );
  await denied(`SELECT public.workspace_user_role('${ids.workspace}')`);
  await as("authenticated", ids.admin);
  await count(`DELETE FROM workspaces WHERE id='${ids.workspace}' RETURNING id`, 0);
  // New source metadata is immutable to browser roles and isolated through scans.
  await db.exec("RESET ROLE");
  const snapshotId = "00000000-0000-4000-8000-000000000090";
  const fileId = "00000000-0000-4000-8000-000000000091";
  await q(
    `INSERT INTO source_snapshots(id,scan_id,state) VALUES ('${snapshotId}','${ids.scan}','ready')`,
  );
  await q(`INSERT INTO snapshot_files(id,snapshot_id,path,byte_size,line_count,preview_state,object_path)
    VALUES ('${fileId}','${snapshotId}','app.py',20,2,'ready','workspace/scan/snapshot/file.txt')`);
  await q(`INSERT INTO finding_locations(finding_id,snapshot_id,file_id,line_number,match_status)
    VALUES ('${ids.finding}','${snapshotId}','${fileId}',1,'verified')`);
  await q(`INSERT INTO audit_workbench_jobs(scan_id,workspace_id,created_by,idempotency_key,request_hash)
    VALUES ('${ids.scan}','${ids.workspace}','${ids.owner}',gen_random_uuid(),'hash')`);
  await q(
    `INSERT INTO storage.objects(bucket_id,name) VALUES ('audit-source','secret.txt'), ('other-bucket','allowed.txt')`,
  );
  const sourceTables = [
    "source_snapshots",
    "snapshot_files",
    "finding_locations",
    "audit_workbench_jobs",
  ];
  await q(`UPDATE snapshot_files SET preview_state='pending' WHERE id='${fileId}'`);
  checks++;
  for (const role of ["owner", "admin", "analyst", "viewer"]) {
    await as("authenticated", ids[role]);
    for (const table of sourceTables) {
      await count(`SELECT * FROM ${table}`, 1);
      await denied(`DELETE FROM ${table}`);
    }
    await denied(`UPDATE snapshot_files SET path='forged.py' WHERE id='${fileId}'`);
    const aggregate = (await q(`SELECT public.audit_workbench_counts('${ids.scan}') AS counts`))
      .rows[0].counts;
    assert.equal(aggregate.total, 1);
    assert.equal(aggregate.files[fileId], 1);
    assert.equal(aggregate.previews.pending, 1);
    checks += 3;
    await denied(`INSERT INTO source_snapshots(scan_id,state) VALUES ('${ids.scan}','ready')`);
    await count("SELECT * FROM storage.objects WHERE bucket_id='audit-source'", 0);
    await count("SELECT * FROM storage.objects WHERE bucket_id='other-bucket'", 1);
    await denied(
      "INSERT INTO storage.objects(bucket_id,name) VALUES ('audit-source','forged.txt')",
    );
    await count(
      "UPDATE storage.objects SET name='forged' WHERE bucket_id='audit-source' RETURNING id",
      0,
    );
  }
  await as("authenticated", ids.outsider);
  for (const table of sourceTables) await count(`SELECT * FROM ${table}`, 0);
  assert.equal(
    (await q(`SELECT public.audit_workbench_counts('${ids.scan}') AS counts`)).rows[0].counts.total,
    0,
  );
  checks++;
  await as("anon");
  await denied(`SELECT public.audit_workbench_counts('${ids.scan}')`);
  await denied(
    `SELECT public.report_scan_counts('${ids.workspace}', ARRAY['${ids.scan}']::uuid[])`,
  );
  await denied(
    `SELECT * FROM public.resolve_report_scan('${ids.workspace}', 'rep_${ids.scan.slice(0, 16)}')`,
  );
  for (const table of [...sourceTables, "source_cleanup_queue"])
    await denied(`SELECT * FROM ${table}`);
  await count("SELECT * FROM storage.objects WHERE bucket_id='audit-source'", 0);
  await as("authenticated", ids.owner);
  for (const role of ["owner", "admin", "analyst", "viewer"]) {
    await as("authenticated", ids[role]);
    const counts = (
      await q(
        `SELECT public.report_scan_counts('${ids.workspace}', ARRAY['${ids.scan}']::uuid[]) AS data`,
      )
    ).rows[0].data;
    assert.equal(counts[ids.scan].total, 1);
    assert.equal(counts[ids.scan].severity.high, 1);
    checks += 2;
    await count(
      `SELECT * FROM public.resolve_report_scan('${ids.workspace}', 'rep_${ids.scan.slice(0, 16)}')`,
      1,
    );
    assert.deepEqual(
      (
        await q(
          `SELECT public.report_scan_counts('${ids.other}', ARRAY['${ids.scan}']::uuid[]) AS data`,
        )
      ).rows[0].data,
      {},
    );
    checks++;
  }
  await as("authenticated", ids.outsider);
  assert.deepEqual(
    (
      await q(
        `SELECT public.report_scan_counts('${ids.workspace}', ARRAY['${ids.scan}']::uuid[]) AS data`,
      )
    ).rows[0].data,
    {},
  );
  checks++;
  await count(
    `SELECT * FROM public.resolve_report_scan('${ids.workspace}', 'rep_${ids.scan.slice(0, 16)}')`,
    0,
  );
  await as("authenticated", ids.owner);
  // GitHub metadata is readable only within the scan's workspace; all writes,
  // OAuth credentials and private patches remain backend-only.
  await db.exec("RESET ROLE");
  const integrationId = "00000000-0000-4000-8000-000000000101";
  const proposalId = "00000000-0000-4000-8000-000000000102";
  await q(
    `INSERT INTO repository_integrations(id,workspace_id,repository_id,installation_id,full_name,created_by) VALUES ('${integrationId}','${ids.workspace}',101,202,'fixture/repo','${ids.owner}')`,
  );
  await q(
    `INSERT INTO repository_scan_refs(scan_id,integration_id,workspace_id,branch,commit_sha) VALUES ('${ids.scan}','${integrationId}','${ids.workspace}','main','${"a".repeat(40)}')`,
  );
  await q(
    `INSERT INTO fix_proposals(id,workspace_id,scan_id,finding_id,snapshot_id,created_by,expires_at) VALUES ('${proposalId}','${ids.workspace}','${ids.scan}','${ids.finding}','${snapshotId}','${ids.owner}',now()+interval '30 days')`,
  );
  await q(
    `INSERT INTO github_private_records(id,workspace_id,proposal_id,snapshot_id,ciphertext,expires_at) VALUES ('proposal:${proposalId}','${ids.workspace}','${proposalId}','${snapshotId}','encrypted-fixture',now()+interval '30 days')`,
  );
  for (const role of ["owner", "admin", "analyst", "viewer"]) {
    await as("authenticated", ids[role]);
    for (const table of ["repository_integrations", "repository_scan_refs", "fix_proposals"]) {
      await count(`SELECT * FROM ${table}`, 1);
      await denied(`DELETE FROM ${table}`);
      await denied(`UPDATE ${table} SET workspace_id='${ids.other}'`);
    }
    for (const table of ["github_private_records", "github_webhook_deliveries"])
      await denied(`SELECT * FROM ${table}`);
  }
  await as("authenticated", ids.outsider);
  for (const table of ["repository_integrations", "repository_scan_refs", "fix_proposals"])
    await count(`SELECT * FROM ${table}`, 0);
  await as("anon");
  for (const table of [
    "repository_integrations",
    "repository_scan_refs",
    "fix_proposals",
    "github_private_records",
    "github_webhook_deliveries",
  ])
    await denied(`SELECT * FROM ${table}`);
  await as("authenticated", ids.owner);
  await q(
    `DELETE FROM workspace_members WHERE workspace_id='${ids.workspace}' AND user_id='${ids.viewer}'`,
  );
  await as("authenticated", ids.viewer);
  for (const table of ["repository_integrations", "repository_scan_refs", "fix_proposals"])
    await count(`SELECT * FROM ${table}`, 0);
  await db.exec("RESET ROLE");
  await assert.rejects(
    q(`UPDATE fix_proposals SET workspace_id='${ids.other}' WHERE id='${proposalId}'`),
    (error) => error.code === "23503",
  );
  checks++;
  const conversationId = "abababab-abab-4bab-8bab-abababababab";
  const expiredChat = "abababab-abab-4bab-8bab-abababababac";
  await q(
    `INSERT INTO advisor_conversations(id, owner_user_id, workspace_id, scan_id, finding_id, snapshot_id, title) VALUES ('${conversationId}','${ids.owner}','${ids.workspace}','${ids.scan}','${ids.finding}','${snapshotId}','Private source question')`,
  );
  await q(
    `INSERT INTO advisor_conversations(id, owner_user_id, workspace_id, title, created_at, expires_at) VALUES ('${expiredChat}','${ids.owner}','${ids.workspace}','Expired',now()-interval '40 days',now()-interval '10 days')`,
  );
  await q(
    `INSERT INTO advisor_messages(conversation_id,submission_id,role,content,status) VALUES ('${conversationId}',gen_random_uuid(),'user','Private question','completed')`,
  );
  await as("authenticated", ids.owner);
  await count("SELECT * FROM advisor_conversations", 1);
  await count("SELECT * FROM advisor_messages", 1);
  for (const member of ["admin", "analyst", "viewer", "outsider"]) {
    await as("authenticated", ids[member]);
    await count("SELECT * FROM advisor_conversations", 0);
    await count("SELECT * FROM advisor_messages", 0);
    await denied(`UPDATE advisor_conversations SET title='Changed' WHERE id='${conversationId}'`);
    await denied(`DELETE FROM advisor_messages WHERE conversation_id='${conversationId}'`);
  }
  await as("authenticated", ids.owner);
  await denied(
    `INSERT INTO advisor_conversations(owner_user_id,workspace_id,title) VALUES ('${ids.owner}','${ids.workspace}','Bypass')`,
  );
  await denied(
    `UPDATE advisor_conversations SET owner_user_id='${ids.admin}' WHERE id='${conversationId}'`,
  );
  await as("anon");
  await denied("SELECT * FROM advisor_conversations");
  await denied("SELECT * FROM advisor_messages");
  await db.exec("RESET ROLE");
  await q(`UPDATE source_snapshots SET state='expired' WHERE id='${snapshotId}'`);
  await as("authenticated", ids.owner);
  await count(`SELECT * FROM advisor_conversations WHERE id='${conversationId}'`, 0);
  await count("SELECT * FROM advisor_messages", 0);
  await db.exec("RESET ROLE");
  await q(`DELETE FROM source_snapshots WHERE id='${snapshotId}'`);
  await count(`SELECT * FROM advisor_conversations WHERE id='${conversationId}'`, 0);
  await count("SELECT * FROM advisor_messages", 0);
  await count("SELECT * FROM github_private_records", 0);
  await count(`SELECT * FROM fix_proposals WHERE id='${proposalId}' AND snapshot_id IS NULL`, 1);
  // Extension policy writes stay server-only; reads follow the parent scan RLS.
  const policyId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  await q(`UPDATE scans SET source_config='{"review_kind":"extension"}' WHERE id='${ids.scan}'`);
  await q(
    `INSERT INTO extension_reviews(scan_id, workspace_id, package_hash, package_name, package_version, manifest_version, stores, policy_version) VALUES ('${ids.scan}','${ids.workspace}','fixture','Fixture','1',3,ARRAY['chrome'],'fixture')`,
  );
  await q(`INSERT INTO extension_declarations(scan_id,content) VALUES ('${ids.scan}','{}')`);
  await q(
    `INSERT INTO extension_policy_results(id,scan_id,store,rule_id,category,outcome,title,details) VALUES ('${policyId}','${ids.scan}','chrome','fixture','security','needs_review','Fixture','{}')`,
  );
  await q(
    `INSERT INTO extension_review_annotations(result_id,scan_id,actor_id,note) VALUES ('${policyId}','${ids.scan}','${ids.owner}','Manual note')`,
  );
  const assetId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  const assetPath = `${ids.workspace}/${ids.scan}/listing/${assetId}.txt`;
  await q(
    `INSERT INTO extension_review_assets(id,scan_id,store,object_path,media_type,byte_size,width,height,expires_at) VALUES ('${assetId}','${ids.scan}','chrome','${assetPath}','image/png',100,100,100,now()+interval '30 days')`,
  );
  const policyConversation = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";
  await q(
    `INSERT INTO advisor_conversations(id,owner_user_id,workspace_id,scan_id,policy_result_id,title) VALUES ('${policyConversation}','${ids.owner}','${ids.workspace}','${ids.scan}','${policyId}','Policy discussion')`,
  );
  const extensionTables = [
    "extension_reviews",
    "extension_declarations",
    "extension_policy_results",
    "extension_review_annotations",
  ];
  for (const role of ["owner", "admin", "analyst", "viewer"]) {
    await as("authenticated", ids[role]);
    // The existing GitHub isolation fixture revoked this viewer above.
    for (const table of extensionTables)
      await count(`SELECT * FROM ${table}`, role === "viewer" ? 0 : 1);
    await count("SELECT id FROM extension_review_assets", role === "viewer" ? 0 : 1);
    await denied("SELECT object_path FROM extension_review_assets");
    await denied(`UPDATE extension_review_assets SET expires_at=now()+interval '1 year'`);
    await count(
      `SELECT * FROM advisor_conversations WHERE id='${policyConversation}'`,
      role === "owner" ? 1 : 0,
    );
    await denied(`UPDATE extension_policy_results SET outcome='passed' WHERE id='${policyId}'`);
    await denied(
      `UPDATE scans SET source_config='{"review_kind":"project"}' WHERE id='${ids.scan}'`,
    );
    await denied(`DELETE FROM extension_reviews WHERE scan_id='${ids.scan}'`);
  }
  await as("authenticated", ids.outsider);
  for (const table of extensionTables) await count(`SELECT * FROM ${table}`, 0);
  await count("SELECT id FROM extension_review_assets", 0);
  await as("anon");
  for (const table of extensionTables) await denied(`SELECT * FROM ${table}`);
  await denied("SELECT id FROM extension_review_assets");
  await db.exec("RESET ROLE");
  await q(
    `INSERT INTO workspace_members(workspace_id,user_id,role) VALUES ('${ids.workspace}','${ids.viewer}','viewer')`,
  );
  await as("authenticated", ids.viewer);
  for (const table of extensionTables) await count(`SELECT * FROM ${table}`, 1);
  await count("SELECT id FROM extension_review_assets", 1);
  await db.exec("RESET ROLE");
  await q(`UPDATE extension_declarations SET expires_at=now()-interval '1 second'`);
  await q(`UPDATE extension_review_assets SET expires_at=now()-interval '1 second'`);
  await as("authenticated", ids.owner);
  await count("SELECT * FROM extension_declarations", 0);
  await count("SELECT id FROM extension_review_assets", 0);
  await as("authenticated", ids.owner);
  await count(
    `DELETE FROM scans WHERE id='${ids.scan}' AND workspace_id='${ids.workspace}' AND status IN ('completed','failed') RETURNING id`,
    1,
  );
  for (const table of [
    "findings",
    "reports",
    "compliance_violations",
    "repository_scan_refs",
    "fix_proposals",
  ])
    await count(`SELECT * FROM ${table}`, 0);
  await count(`DELETE FROM workspaces WHERE id='${ids.workspace}' RETURNING id`, 1);
  await db.exec("RESET ROLE");
  await count("SELECT * FROM github_private_records", 0);
  await count("SELECT * FROM fix_proposals", 0);
  for (const table of extensionTables) await count(`SELECT * FROM ${table}`, 0);
  await count("SELECT * FROM extension_review_assets", 0);
  await count(`SELECT * FROM advisor_conversations WHERE id='${policyConversation}'`, 0);
  await count("SELECT * FROM source_cleanup_queue", 2);
  await count(`SELECT * FROM source_cleanup_queue WHERE object_path='${assetPath}'`, 1);
  for (const table of sourceTables) await count(`SELECT * FROM ${table}`, 0);
  await as("authenticated", ids.outsider);
  await count("SELECT * FROM workspaces", 1);
  await as("threatlens_backend");
  await count("SELECT * FROM pg_policies WHERE policyname='backend_full_access'", 1);
  console.log(
    `PASS: ${checks} RLS checks; signup/owner trigger, role access, tenant isolation, view, grants and escalation guards.`,
  );
} finally {
  await db.close();
}
