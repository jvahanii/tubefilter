import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Skull } from "lucide-react";

// Intentionally undiscoverable: no nav link, no sitemap entry, obscure path.
// Navigate manually to /oblivion to erase all account-related data.
export const Route = createFileRoute("/oblivion")({
  component: OblivionPage,
});

const CONFIRM_PHRASE = "ERASE EVERYTHING";

function OblivionPage() {
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const [phrase, setPhrase] = useState("");
  const [working, setWorking] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canErase = phrase === CONFIRM_PHRASE && !!user && !working;

  async function handleErase() {
    if (!user) return;
    setWorking(true);
    setError(null);
    try {
      // Best-effort wipe across all known user-scoped tables.
      const results = await Promise.all([
        supabase.from("search_events").delete().eq("user_id", user.id),
        supabase.from("user_preferences").delete().eq("user_id", user.id),
        supabase.from("user_roles").delete().eq("user_id", user.id),
      ]);
      const firstErr = results.find((r) => r.error)?.error;
      if (firstErr) throw firstErr;

      // Clear any local cached state, then sign out.
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        /* ignore */
      }
      await signOut();
      setDone(true);
      setTimeout(() => navigate({ to: "/" }), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to erase data");
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Sign in first.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-lg border border-destructive/40 bg-card p-6">
        <div className="flex items-center gap-2">
          <Skull className="h-5 w-5 text-destructive" />
          <h1 className="text-lg font-semibold">Erase all my data</h1>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          This permanently deletes your channels, filters, hidden videos, search
          activity, and roles tied to{" "}
          <span className="font-medium text-foreground">{user.email}</span>. You
          will be signed out. This cannot be undone.
        </p>

        {done ? (
          <p className="mt-4 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
            Erased. Redirecting…
          </p>
        ) : (
          <>
            <label className="mt-5 block text-xs font-medium text-muted-foreground">
              Type{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
                {CONFIRM_PHRASE}
              </code>{" "}
              to confirm
            </label>
            <Input
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="mt-1.5"
            />
            {error && (
              <p className="mt-2 text-xs text-destructive">{error}</p>
            )}
            <Button
              variant="destructive"
              className="mt-4 w-full"
              disabled={!canErase}
              onClick={handleErase}
            >
              {working ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Erasing…
                </>
              ) : (
                "Erase everything"
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
