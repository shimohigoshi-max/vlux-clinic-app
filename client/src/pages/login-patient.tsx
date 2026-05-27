import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

export default function LoginPatient() {
  const { signInWithPassword, session, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && session) {
    setLocation("/patient");
    return null;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await signInWithPassword(email.trim(), password);
    setSubmitting(false);
    if (result.ok) {
      setLocation("/patient");
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background text-foreground">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-card border border-border p-6 rounded-lg shadow space-y-4"
        data-testid="form-login-patient"
      >
        <div className="space-y-1">
          <h1 className="text-xl font-bold">患者ログイン</h1>
          <p className="text-xs text-muted-foreground">
            VLUX 患者アプリにログインします
          </p>
        </div>
        <div className="space-y-1">
          <label htmlFor="email" className="block text-sm">
            メールアドレス
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            inputMode="email"
            className="w-full border border-border rounded px-3 py-2 bg-background"
            data-testid="input-email"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="password" className="block text-sm">
            パスワード
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full border border-border rounded px-3 py-2 bg-background"
            data-testid="input-password"
          />
        </div>
        {error && (
          <p
            className="text-sm text-destructive"
            role="alert"
            data-testid="text-login-error"
          >
            ログインに失敗しました：{error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-primary text-primary-foreground py-2 rounded disabled:opacity-50"
          data-testid="button-login-submit"
        >
          {submitting ? "ログイン中…" : "ログイン"}
        </button>
      </form>
    </div>
  );
}
