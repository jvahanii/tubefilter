import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2,
  ShieldAlert,
  ArrowLeft,
  Users as UsersIcon,
  Shield,
  ShieldOff,
  Crown,
} from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

type Profile = {
  id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
};
type PrefRow = {
  user_id: string;
  data: {
    channels?: Array<{ id: string; name: string; handle?: string }>;
    activeChannelIds?: string[];
    hiddenIds?: string[];
  } | null;
};
type SearchRow = {
  id: string;
  user_id: string;
  query: string;
  kind: string;
  created_at: string;
};
type RoleRow = { user_id: string; role: "admin" | "user" };

type UserRow = Profile & {
  prefs: PrefRow["data"];
  searches: SearchRow[];
  roles: Array<"admin" | "user">;
};

function fmt(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString();
}

function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mutatingId, setMutatingId] = useState<string | null>(null);

  // Verify admin role
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setChecking(false);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (error) setError(error.message);
      setIsAdmin(!!data);
      setChecking(false);
    })();
  }, [user, authLoading]);

  async function loadAll() {
    setLoading(true);
    const [profilesRes, prefsRes, searchesRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("id,email,created_at,last_sign_in_at"),
      supabase.from("user_preferences").select("user_id,data"),
      supabase
        .from("search_events")
        .select("id,user_id,query,kind,created_at")
        .order("created_at", { ascending: false })
        .limit(2000),
      supabase.from("user_roles").select("user_id,role"),
    ]);
    if (
      profilesRes.error ||
      prefsRes.error ||
      searchesRes.error ||
      rolesRes.error
    ) {
      setError(
        profilesRes.error?.message ||
          prefsRes.error?.message ||
          searchesRes.error?.message ||
          rolesRes.error?.message ||
          "Failed to load",
      );
      setLoading(false);
      return;
    }
    const prefMap = new Map<string, PrefRow["data"]>();
    (prefsRes.data as PrefRow[]).forEach((p) => prefMap.set(p.user_id, p.data));
    const searchMap = new Map<string, SearchRow[]>();
    (searchesRes.data as SearchRow[]).forEach((s) => {
      const arr = searchMap.get(s.user_id) ?? [];
      arr.push(s);
      searchMap.set(s.user_id, arr);
    });
    const roleMap = new Map<string, Array<"admin" | "user">>();
    (rolesRes.data as RoleRow[]).forEach((r) => {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role);
      roleMap.set(r.user_id, arr);
    });
    const merged: UserRow[] = (profilesRes.data as Profile[])
      .map((p) => ({
        ...p,
        prefs: prefMap.get(p.id) ?? null,
        searches: searchMap.get(p.id) ?? [],
        roles: roleMap.get(p.id) ?? [],
      }))
      .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
    setRows(merged);
    setLoading(false);
  }

  // Load all data once admin verified
  useEffect(() => {
    if (!isAdmin) return;
    loadAll().then(() => {
      setRows((curr) => {
        if (curr.length && !selectedId) setSelectedId(curr[0].id);
        return curr;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  async function toggleAdmin(target: UserRow) {
    if (!user) return;
    const currentlyAdmin = target.roles.includes("admin");
    // Prevent locking yourself out by removing your own admin role.
    if (currentlyAdmin && target.id === user.id) {
      setError("You can't remove your own admin role.");
      return;
    }
    setMutatingId(target.id);
    setError(null);
    try {
      if (currentlyAdmin) {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", target.id)
          .eq("role", "admin");
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: target.id, role: "admin" });
        if (error) throw error;
      }
      // Optimistic local update
      setRows((curr) =>
        curr.map((r) =>
          r.id === target.id
            ? {
                ...r,
                roles: currentlyAdmin
                  ? r.roles.filter((x) => x !== "admin")
                  : Array.from(new Set([...r.roles, "admin" as const])),
              }
            : r,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update role");
    } finally {
      setMutatingId(null);
    }
  }

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId],
  );

  if (authLoading || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md rounded-lg border border-border bg-card p-6 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
          <h1 className="mt-3 text-lg font-semibold">Admin only</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account doesn't have admin access.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/">Go back</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back to feed
            </Link>
          </Button>
          <h1 className="flex items-center gap-2 text-base font-semibold">
            <UsersIcon className="h-4 w-4" />
            Admin · Users
          </h1>
          <Badge variant="secondary" className="ml-2">
            {rows.length}
          </Badge>
        </div>
      </header>

      {error && (
        <div className="mx-auto mt-4 max-w-7xl rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 p-4 md:grid-cols-[340px_1fr]">
          {/* User list */}
          <aside className="rounded-lg border border-border bg-card">
            <ScrollArea className="h-[calc(100vh-140px)]">
              <ul className="divide-y divide-border">
                {rows.map((r) => {
                  const active = r.id === selectedId;
                  const channelCount = r.prefs?.channels?.length ?? 0;
                  const isUserAdmin = r.roles.includes("admin");
                  return (
                    <li key={r.id}>
                      <button
                        onClick={() => setSelectedId(r.id)}
                        className={`w-full px-3 py-2.5 text-left transition-colors ${
                          active ? "bg-accent" : "hover:bg-accent/50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex-1 truncate text-sm font-medium">
                            {r.email ?? r.id.slice(0, 8)}
                          </div>
                          {isUserAdmin && (
                            <Badge className="text-[10px]" variant="default">
                              <Shield className="mr-1 h-3 w-3" />
                              admin
                            </Badge>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{channelCount} ch</span>
                          <span>·</span>
                          <span>{r.searches.length} searches</span>
                        </div>
                        <div className="mt-0.5 text-[10px] text-muted-foreground">
                          Joined {fmt(r.created_at)}
                        </div>
                      </button>
                    </li>
                  );
                })}
                {rows.length === 0 && (
                  <li className="p-4 text-center text-sm text-muted-foreground">
                    No users yet.
                  </li>
                )}
              </ul>
            </ScrollArea>
          </aside>

          {/* Detail */}
          <section className="rounded-lg border border-border bg-card p-5">
            {selected ? (
              <UserDetail
                user={selected}
                currentUserId={user?.id ?? ""}
                mutating={mutatingId === selected.id}
                onToggleAdmin={() => toggleAdmin(selected)}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Select a user.</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function UserDetail({
  user,
  currentUserId,
  mutating,
  onToggleAdmin,
}: {
  user: UserRow;
  currentUserId: string;
  mutating: boolean;
  onToggleAdmin: () => void;
}) {
  const channels = user.prefs?.channels ?? [];
  const activeIds = user.prefs?.activeChannelIds ?? [];
  const hiddenIds = user.prefs?.hiddenIds ?? [];
  const filtering = activeIds.length > 0;
  const isUserAdmin = user.roles.includes("admin");
  const isSelf = user.id === currentUserId;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{user.email ?? "(no email)"}</h2>
          <Badge variant={isUserAdmin ? "default" : "secondary"} className="text-[10px]">
            {isUserAdmin ? (
              <>
                <Shield className="mr-1 h-3 w-3" />
                admin
              </>
            ) : (
              "user"
            )}
          </Badge>
          {isSelf && (
            <Badge variant="outline" className="text-[10px]">
              you
            </Badge>
          )}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div>
            User ID: <code className="text-[10px]">{user.id}</code>
          </div>
          <div>Signed up: {fmt(user.created_at)}</div>
          <div>Last sign-in: {fmt(user.last_sign_in_at)}</div>
          <div>Hidden videos: {hiddenIds.length}</div>
        </div>
      </div>

      {/* Role management */}
      <div className="rounded-md border border-border bg-background p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Role</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {isUserAdmin
                ? "This user has admin access to this panel."
                : "Standard user. Grant admin to allow access to this panel."}
            </p>
          </div>
          <Button
            size="sm"
            variant={isUserAdmin ? "outline" : "default"}
            disabled={mutating || (isUserAdmin && isSelf)}
            onClick={onToggleAdmin}
            title={
              isUserAdmin && isSelf
                ? "You can't remove your own admin role"
                : undefined
            }
          >
            {mutating ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : isUserAdmin ? (
              <ShieldOff className="mr-1.5 h-3.5 w-3.5" />
            ) : (
              <Shield className="mr-1.5 h-3.5 w-3.5" />
            )}
            {isUserAdmin ? "Revoke admin" : "Make admin"}
          </Button>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2">
          <h3 className="text-sm font-semibold">Channels</h3>
          <Badge variant="secondary">{channels.length}</Badge>
          {filtering && (
            <Badge variant="outline" className="text-[10px]">
              Filtering by {activeIds.length}
            </Badge>
          )}
        </div>
        {channels.length === 0 ? (
          <p className="text-sm text-muted-foreground">No channels added.</p>
        ) : (
          <ul className="space-y-1.5">
            {channels.map((c) => {
              const isActive = activeIds.includes(c.id);
              return (
                <li
                  key={c.id}
                  className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <span className="font-medium">{c.name}</span>
                  {c.handle && (
                    <span className="text-xs text-muted-foreground">
                      {c.handle.startsWith("@") ? c.handle : `@${c.handle}`}
                    </span>
                  )}
                  {filtering && isActive && (
                    <Badge variant="default" className="ml-auto text-[10px]">
                      Active filter
                    </Badge>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2">
          <h3 className="text-sm font-semibold">Recent searches</h3>
          <Badge variant="secondary">{user.searches.length}</Badge>
        </div>
        {user.searches.length === 0 ? (
          <p className="text-sm text-muted-foreground">No search activity tracked.</p>
        ) : (
          <ScrollArea className="h-64 rounded-md border border-border">
            <ul className="divide-y divide-border">
              {user.searches.slice(0, 100).map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-3 py-1.5 text-sm">
                  <Badge variant="outline" className="text-[10px]">
                    {s.kind}
                  </Badge>
                  <span className="flex-1 truncate">{s.query}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {fmt(s.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
