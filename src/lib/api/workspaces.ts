/**
 * workspaces.ts
 * Workspaces API module directly connected to Supabase PostgreSQL database.
 */

import {
  dbFetchWorkspaces,
  dbFetchWorkspace,
  dbCreateWorkspace,
  dbUpdateWorkspace,
  dbDeleteWorkspace,
  dbFetchMembers,
  dbInviteMember,
  dbRemoveMember,
  dbFetchPendingInvites,
  dbRevokeInvite,
} from "./database";

export type WorkspaceRole = "owner" | "admin" | "analyst" | "viewer";

export interface WorkspaceSettings {
  default_frameworks: string[];
  retention_days: number;
  notify_on_critical?: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  owner_user_id: string;
  role: "owner" | "admin" | "analyst" | "viewer";
  member_count: number;
  scan_count: number;
  settings?: WorkspaceSettings;
  created_at: string;
}

export interface WorkspaceMember {
  user_id: string;
  role: "owner" | "admin" | "analyst" | "viewer";
  display_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  created_at: string;
}

export interface WorkspaceInvite {
  id: string;
  workspace_id: string;
  invited_email: string;
  role: "owner" | "admin" | "analyst" | "viewer" | string;
  expires_at: string;
  created_at: string;
}

export interface WorkspaceUpdatePayload {
  name?: string;
  slug?: string;
  settings?: WorkspaceSettings;
}

/**
 * Fetch all workspaces the user is authorized to view directly from the Supabase database.
 */
export async function fetchWorkspaces(signal?: AbortSignal): Promise<Workspace[]> {
  return dbFetchWorkspaces(signal);
}

/**
 * Fetch a single workspace by ID directly from Supabase.
 */
export async function fetchWorkspace(workspaceId: string): Promise<Workspace> {
  return dbFetchWorkspace(workspaceId);
}

/**
 * Create a new workspace directly in the Supabase database.
 * The database trigger automatically creates the owner role in workspace_members.
 */
export async function createWorkspace(name: string, slug: string): Promise<Workspace> {
  return dbCreateWorkspace(name, slug);
}

/**
 * Update an existing workspace's name, slug, or settings.
 */
export async function updateWorkspace(
  workspaceId: string,
  payload: WorkspaceUpdatePayload | string,
): Promise<Workspace> {
  return dbUpdateWorkspace(workspaceId, payload);
}

/**
 * Delete a workspace from the database.
 */
export async function deleteWorkspace(workspaceId: string): Promise<void> {
  return dbDeleteWorkspace(workspaceId);
}

/**
 * Fetch members of a workspace along with profile information.
 */
export async function fetchMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  return dbFetchMembers(workspaceId);
}

/**
 * Fetch pending invitations for a workspace.
 */
export async function fetchPendingInvites(workspaceId: string): Promise<WorkspaceInvite[]> {
  return dbFetchPendingInvites(workspaceId);
}

/**
 * Revoke/cancel a pending workspace invitation.
 */
export async function revokeInvite(inviteId: string, workspaceId?: string): Promise<void> {
  return dbRevokeInvite(inviteId, workspaceId);
}

/**
 * Update a member's role in a workspace.
 */
export async function updateMemberRole(
  workspaceId: string,
  userId: string,
  role: string,
): Promise<WorkspaceMember> {
  const { supabase } = await import("@/lib/supabase");
  if (!["admin", "analyst", "viewer"].includes(role))
    throw new Error("Choose a supported member role.");
  const { data, error } = await supabase
    .from("workspace_members")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .neq("role", "owner")
    .select("user_id,role,created_at")
    .maybeSingle();

  if (error) throw error;
  if (!data)
    throw new Error("Member role was not changed. Refresh the list and check your access.");
  return data as WorkspaceMember;
}

/**
 * Remove a member from a workspace.
 */
export async function removeMember(workspaceId: string, userId: string): Promise<void> {
  return dbRemoveMember(workspaceId, userId);
}

/**
 * Invite a new member to a workspace via email.
 */
export async function inviteMember(
  workspaceId: string,
  email: string,
  role: string,
): Promise<WorkspaceInvite> {
  return dbInviteMember(workspaceId, email, role);
}
