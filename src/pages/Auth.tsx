import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Flame } from "lucide-react";

// Add Google icon (simple SVG)
function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" {...props}>
      <g>
        <path fill="#4285F4" d="M43.6 20.5h-1.9V20H24v8h11.3c-1.6 4.3-5.7 7-11.3 7-6.6 0-12-5.4-12-12s5.4-12 12-12c2.7 0 5.2.9 7.2 2.5l6-6C34.5 5.1 29.5 3 24 3 12.9 3 4 11.9 4 23s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.2-.3-3.5z"/>
        <path fill="#34A853" d="M6.3 14.7l6.6 4.8C14.5 16.1 18.8 13 24 13c2.7 0 5.2.9 7.2 2.5l6-6C34.5 5.1 29.5 3 24 3 15.3 3 7.9 8.7 6.3 14.7z"/>
        <path fill="#FBBC05" d="M24 43c5.3 0 10.2-1.8 13.9-4.9l-6.4-5.2c-2 1.4-4.5 2.1-7.5 2.1-5.6 0-10.3-3.7-12-8.7l-6.6 5.1C7.9 39.3 15.3 45 24 45z"/>
        <path fill="#EA4335" d="M43.6 20.5h-1.9V20H24v8h11.3c-1.1 3-4.1 7-11.3 7-6.6 0-12-5.4-12-12s5.4-12 12-12c2.7 0 5.2.9 7.2 2.5l6-6C34.5 5.1 29.5 3 24 3c-8.7 0-16.1 5.7-17.7 11.7l6.6 4.8C14.5 16.1 18.8 13 24 13c2.7 0 5.2.9 7.2 2.5l6-6C34.5 5.1 29.5 3 24 3c-8.7 0-16.1 5.7-17.7 11.7l6.6 4.8C14.5 16.1 18.8 13 24 13c2.7 0 5.2.9 7.2 2.5l6-6C34.5 5.1 29.5 3 24 3c-8.7 0-16.1 5.7-17.7 11.7l6.6 4.8C14.5 16.1 18.8 13 24 13c2.7 0 5.2.9 7.2 2.5l6-6C34.5 5.1 29.5 3 24 3c-8.7 0-16.1 5.7-17.7 11.7l6.6 4.8C14.5 16.1 18.8 13 24 13c2.7 0 5.2.9 7.2 2.5l6-6C34.5 5.1 29.5 3 24 3c-8.7 0-16.1 5.7-17.7 11.7l6.6 4.8C14.5 16.1 18.8 13 24 13c2.7 0 5.2.9 7.2 2.5l6-6C34.5 5.1 29.5 3 24 3c-8.7 0-16.1 5.7-17.7 11.7l6.6 4.8C14.5 16.1 18.8 13 24 13c2.7 0 5.2.9 7.2 2.5l6-6C34.5 5.1 29.5 3 24 3z"/>
      </g>
    </svg>
  );
}

export default function Auth() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Welcome to Hearth", { description: "Your account is ready." });
        navigate("/");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/");
      }
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  };


    // Handler for Google sign-in
  const handleGoogleSignIn = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/',
        },
      });
      if (error) throw error;
      // The user will be redirected by Supabase, so no need to navigate here
    } catch (err: any) {
      toast.error(err.message ?? 'Google sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-md animate-in-up">
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center text-accent-foreground">
            <Flame className="h-5 w-5" />
          </div>
          <span className="font-display text-2xl font-semibold">Hearth</span>
        </div>

        <div className="surface p-8">
          <h1 className="font-display text-3xl font-semibold mb-1">
            {mode === "signin" ? "Welcome back" : "Begin gently"}
          </h1>
          <p className="text-muted-foreground text-sm mb-6">
            {mode === "signin" ? "Sign in to continue your streak." : "Create an account to start tracking."}
          </p>

          <Button
            type="button"
            className="w-full flex items-center justify-center gap-2 mb-4 border border-input bg-white text-black hover:bg-gray-100"
            onClick={handleGoogleSignIn}
            disabled={busy}
            variant="outline"
          >
            <GoogleIcon className="mr-2" />
            {busy ? '...' : 'Sign in with Google'}
          </Button>

          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "..." : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <button
            type="button"
            className="w-full text-sm text-muted-foreground hover:text-foreground mt-6 transition"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
