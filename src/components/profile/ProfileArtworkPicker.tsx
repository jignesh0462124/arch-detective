import { useEffect, useRef, useState } from "react";
import { Check, X } from "@phosphor-icons/react";
import { useAuth } from "@/hooks/useAuth";
import {
  accountPhoto,
  appearanceKey,
  profileAvatars,
  profileCovers,
  profileInitials,
  validAppearance,
  type AppearanceKind,
} from "@/lib/profileAppearance";
import { saveProfileAppearance } from "@/lib/api/profileAppearance";
import { cn } from "@/lib/utils";

export function ProfileArtworkPicker({
  kind,
  legacyCover,
  onClose,
  onSaved,
}: {
  kind: AppearanceKind;
  legacyCover: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const dialog = useRef<HTMLDialogElement>(null);
  const alive = useRef(false);
  const pending = useRef(false);
  const [selected, setSelected] = useState(() => {
    const saved = user?.user_metadata?.[appearanceKey(kind)];
    if (
      validAppearance(kind, saved) &&
      !(kind === "avatar" && saved === "original" && !accountPhoto(user?.user_metadata))
    )
      return saved;
    return kind === "avatar" && !accountPhoto(user?.user_metadata) ? "initials" : "original";
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const avatar = kind === "avatar";
  const title = avatar ? "Choose your profile image" : "Choose your cover";
  useEffect(() => {
    alive.current = true;
    const element = dialog.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.showModal();
    return () => {
      alive.current = false;
      element?.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, []);
  const originalPhoto = accountPhoto(user?.user_metadata);
  const choices: { id: string; name: string; src: string | null }[] = avatar
    ? [
        ...profileAvatars,
        { id: "initials", name: "Initials", src: null },
        ...(originalPhoto ? [{ id: "original", name: "Account photo", src: originalPhoto }] : []),
      ]
    : [
        ...profileCovers,
        { id: "original", name: "Original cover", src: `/covers/cover-${legacyCover}.jpg` },
      ];
  async function save() {
    if (!user || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await saveProfileAppearance(user.id, kind, selected);
      if (alive.current) onSaved();
    } catch {
      if (alive.current)
        setError("Your selection could not be saved. Check your connection and try again.");
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const r = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < r.left ||
            event.clientX > r.right ||
            event.clientY < r.top ||
            event.clientY > r.bottom
          )
            onClose();
        }
      }}
      aria-labelledby="profile-art-title"
      aria-describedby="profile-art-description"
      className="m-auto max-h-[90dvh] w-[min(94vw,680px)] overflow-hidden rounded-xl border border-border bg-card p-5 text-foreground shadow-xl open:flex open:flex-col backdrop:bg-black/60 sm:p-6"
    >
      <div className="flex shrink-0 items-start justify-between gap-3">
        <div>
          <h2 id="profile-art-title" className="text-lg font-semibold">
            {title}
          </h2>
          <p id="profile-art-description" className="mt-1 text-sm text-muted-foreground">
            Choose a design, then save it to your account.
          </p>
        </div>
        <button
          type="button"
          aria-label="Close artwork picker"
          onClick={onClose}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-secondary focus-visible:shadow-ring"
        >
          <X size={20} />
        </button>
      </div>
      <div className="mt-5 min-h-0 overflow-y-auto p-1">
        <div
          className={cn(
            "grid gap-3",
            avatar ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2",
          )}
        >
          {choices.map((item) => (
            <button
              type="button"
              key={item.id}
              disabled={busy}
              aria-pressed={selected === item.id}
              onClick={() => {
                setSelected(item.id);
                setError("");
              }}
              className={cn(
                "overflow-hidden rounded-lg border bg-secondary text-left focus-visible:shadow-ring disabled:opacity-60",
                selected === item.id
                  ? "border-foreground ring-1 ring-foreground"
                  : "border-border hover:border-muted-foreground",
              )}
            >
              {item.src && !failedImages.includes(item.id) ? (
                <img
                  src={item.src}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  onError={() => setFailedImages((current) => [...current, item.id])}
                  className={cn("w-full object-cover", avatar ? "aspect-square" : "aspect-[3/1]")}
                />
              ) : (
                <span
                  className={cn(
                    "flex items-center justify-center text-2xl font-semibold",
                    avatar ? "aspect-square" : "aspect-[3/1]",
                  )}
                >
                  {item.src
                    ? "Image unavailable"
                    : profileInitials(user?.user_metadata, user?.email)}
                </span>
              )}
              <span className="flex min-h-11 items-center justify-between gap-2 bg-card px-3 py-2 text-sm">
                <span>{item.name}</span>
                {selected === item.id && <Check size={16} aria-label="Selected" />}
              </span>
            </button>
          ))}
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="mt-5 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-xs text-muted-foreground">Changes only your profile appearance.</p>
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || !user || failedImages.includes(selected)}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Saving…" : avatar ? "Save profile image" : "Save cover"}
        </button>
      </div>
    </dialog>
  );
}
