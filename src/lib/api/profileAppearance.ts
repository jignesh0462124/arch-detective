import { supabase } from "@/lib/supabase";
import { authScope, isCurrentScope } from "@/lib/authState";
import { appearanceKey, validAppearance, type AppearanceKind } from "@/lib/profileAppearance";

export async function saveProfileAppearance(userId: string, kind: AppearanceKind, value: string) {
  if (!validAppearance(kind, value)) throw new Error("Choose an available profile artwork.");
  const scope = authScope();
  if (scope.owner !== userId) throw new Error("Your account changed. Reopen profile settings.");
  const key = appearanceKey(kind);
  const { data, error } = await supabase.auth.updateUser({ data: { [key]: value } });
  if (!isCurrentScope(scope)) throw new Error("Your account changed. Reopen profile settings.");
  if (error || data.user?.id !== userId || data.user.user_metadata?.[key] !== value)
    throw new Error("Your selection could not be saved. Check your connection and try again.");
}
