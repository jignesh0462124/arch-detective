import { useState } from "react";
import { profileAvatar, profileInitials } from "@/lib/profileAppearance";
import { cn } from "@/lib/utils";

export function ProfileAvatar({
  metadata,
  email,
  className,
}: {
  metadata?: Record<string, unknown> | null;
  email?: string | null;
  className?: string;
}) {
  const src = profileAvatar(metadata);
  const [failed, setFailed] = useState<string | null>(null);
  return src && failed !== src ? (
    <img
      src={src}
      alt=""
      decoding="async"
      onError={() => setFailed(src)}
      className={cn("size-8 shrink-0 rounded-full object-cover", className)}
    />
  ) : (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-xs font-semibold text-foreground",
        className,
      )}
    >
      {profileInitials(metadata, email)}
    </span>
  );
}
