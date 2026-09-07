import { cn } from "@/lib/utils";

export function initialsFromName(name?: string | null, email?: string | null) {
  const src = (name && name.trim()) || (email && email.split("@")[0]) || "";
  const parts = src
    .replace(/[._-]+/g, " ")
    .split(" ")
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function UserAvatar({
  name,
  email,
  url,
  size = 36,
  className,
}: {
  name?: string | null;
  email?: string | null;
  url?: string | null;
  size?: number;
  className?: string;
}) {
  const initials = initialsFromName(name, email);
  const dim = { width: size, height: size, fontSize: Math.round(size * 0.4) };
  if (url) {
    return (
      <img
        loading="lazy"
        decoding="async"
        src={url}
        alt={name ?? "Avatar"}
        style={dim}
        className={cn("rounded-full object-cover ring-2 ring-primary/40 shadow-glow", className)}
      />
    );
  }
  return (
    <div
      style={dim}
      className={cn(
        "rounded-full grid place-items-center font-bold text-primary-foreground bg-gradient-to-br from-primary to-primary/70 ring-2 ring-primary/40 shadow-glow select-none",
        className,
      )}
    >
      {initials}
    </div>
  );
}
