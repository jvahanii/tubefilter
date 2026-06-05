import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function getRecoveryParams() {
  const search = typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : "";
  const hash = typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "";

  return new URLSearchParams([search, hash].filter(Boolean).join("&"));
}

function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  // Start as null = "checking", then true/false once we know.
  const [canReset, setCanReset] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    let recoveryEventSeen = false;

    const markResolved = (allowed: boolean, nextError: string | null = null) => {
      if (!active) return;
      setError(nextError);
      setCanReset(allowed);
    };

    // detectSessionInUrl auto-consumes recovery codes and fires
    // PASSWORD_RECOVERY. Subscribe first so we don't race the client.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        recoveryEventSeen = true;
        setError(null);
        setCanReset(true);
      }
    });

    const waitForSession = async (timeoutMs: number) => {
      const start = Date.now();
      while (active && Date.now() - start < timeoutMs) {
        if (recoveryEventSeen) return true;
        const { data } = await supabase.auth.getSession();
        if (data.session) return true;
        await new Promise((r) => setTimeout(r, 100));
      }
      return false;
    };

    void (async () => {
      const params = getRecoveryParams();
      const hasRecoveryParams =
        params.get("type") === "recovery" ||
        params.has("access_token") ||
        params.has("refresh_token") ||
        params.has("token_hash") ||
        params.has("code");

      if (!hasRecoveryParams) {
        // No recovery params — only allow if a session already exists.
        const { data } = await supabase.auth.getSession();
        markResolved(!!data.session);
        return;
      }

      // Step 1: let the Supabase client auto-process the URL first.
      if (await waitForSession(1500)) {
        markResolved(true);
        return;
      }

      // Step 2: fall back to manual exchange using whatever params we have.
      const code = params.get("code");
      const tokenHash = params.get("token_hash");
      const type = params.get("type");
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      let recoveryError: string | null = null;

      if (accessToken && refreshToken) {
        const { error: e } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        recoveryError = e?.message ?? null;
      } else if (code) {
        const { error: e } = await supabase.auth.exchangeCodeForSession(code);
        recoveryError = e?.message ?? null;
      } else if (type === "recovery" && tokenHash) {
        const { error: e } = await supabase.auth.verifyOtp({
          type: "recovery",
          token_hash: tokenHash,
        });
        recoveryError = e?.message ?? null;
      }

      // Step 3: re-verify — manual exchange may have failed because the
      // auto-detect already succeeded. Poll once more before giving up.
      if (await waitForSession(1500)) {
        markResolved(true);
        return;
      }

      markResolved(
        false,
        recoveryError ?? "This password reset link is invalid or has expired.",
      );
    })();

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
    } else {
      // Sign out so the user must log in with the new password.
      await supabase.auth.signOut();
      setSuccess(true);
    }
  }

  if (canReset === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-sm text-center">
          <h1 className="text-lg font-semibold mb-2">Password updated</h1>
          <p className="text-sm text-muted-foreground mb-4">Your password has been reset successfully.</p>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  if (!canReset) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-sm text-center">
          <h1 className="text-lg font-semibold mb-2">Invalid or expired link</h1>
          <p className="text-sm text-muted-foreground mb-4">This password reset link is invalid or has expired.</p>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-sm">
        <h1 className="text-lg font-semibold mb-1">Reset your password</h1>
        <p className="text-sm text-muted-foreground mb-4">Enter a new password below.</p>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="newPassword">New password</Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmNewPassword">Confirm password</Label>
            <div className="relative">
              <Input
                id="confirmNewPassword"
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update password
          </Button>
        </form>
      </div>
    </div>
  );
}
