import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";

type StaffMeResponse = {
  staff: {
    id: string;
    name: string | null;
    role: "owner" | "staff" | "reception";
    clinic_id: string;
  };
  clinic: {
    id: string;
    name: string | null;
  };
};

type StaffCheckState =
  | { kind: "checking" }
  | { kind: "allowed"; me: StaffMeResponse }
  | { kind: "denied"; reason: "not_staff" | "unauthenticated" | "error" };

export function StaffProtected({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [check, setCheck] = useState<StaffCheckState>({ kind: "checking" });

  // 1. 未ログインなら /clinic/login へ
  useEffect(() => {
    if (!loading && !session) {
      setLocation("/clinic/login");
    }
  }, [loading, session, setLocation]);

  // 2. ログイン済みなら /api/staff/me で staff membership 確認
  useEffect(() => {
    if (loading || !session) return;

    let active = true;
    setCheck({ kind: "checking" });

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          if (active) setCheck({ kind: "denied", reason: "unauthenticated" });
          return;
        }
        const res = await fetch("/api/staff/me", {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        if (!active) return;
        if (res.status === 200) {
          const me = (await res.json()) as StaffMeResponse;
          setCheck({ kind: "allowed", me });
        } else if (res.status === 401) {
          setCheck({ kind: "denied", reason: "unauthenticated" });
        } else if (res.status === 403) {
          setCheck({ kind: "denied", reason: "not_staff" });
        } else {
          setCheck({ kind: "denied", reason: "error" });
        }
      } catch {
        if (active) setCheck({ kind: "denied", reason: "error" });
      }
    })();

    return () => {
      active = false;
    };
  }, [session, loading]);

  if (loading || check.kind === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!session) {
    return null; // useEffect が /clinic/login へリダイレクト中
  }
  if (check.kind === "denied") {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-4 text-foreground"
        data-testid="staff-denied"
      >
        <p
          className="text-sm text-destructive mb-3"
          data-testid="text-staff-denied"
        >
          スタッフ権限がありません
        </p>
        <button
          className="px-4 py-2 bg-primary text-primary-foreground rounded"
          onClick={async () => {
            await supabase.auth.signOut();
            setLocation("/clinic/login");
          }}
          data-testid="button-staff-denied-signout"
        >
          ログアウトして再ログイン
        </button>
      </div>
    );
  }
  return <>{children}</>;
}
