import type { Request, Response, NextFunction } from "express";
import { getUserFromToken, serviceClient } from "../lib/supabaseService";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      staffContext?: {
        userId: string;
        staffId: string;
        clinicId: string;
        role: "owner" | "staff" | "reception";
        staffName: string | null;
        clinicName: string | null;
      };
    }
  }
}

export async function requireStaffAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // 1. JWT 検証（既存ヘルパー再利用）
  const user = await getUserFromToken(req.headers.authorization);
  if (!user) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  // 2. staffs.user_id でログイン user の staff レコードを検索
  const { data: staff, error: staffErr } = await serviceClient
    .from("staffs")
    .select("id, clinic_id, role, name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (staffErr) {
    res.status(500).json({ error: staffErr.message });
    return;
  }
  if (!staff) {
    res.status(403).json({ error: "not a staff" });
    return;
  }

  // 3. role の妥当性（想定外値を弾く）
  if (
    staff.role !== "owner" &&
    staff.role !== "staff" &&
    staff.role !== "reception"
  ) {
    res.status(403).json({ error: "invalid staff role" });
    return;
  }

  // 4. clinic を取得し、owner_id NULL を Default Deny とする
  const { data: clinic, error: clinicErr } = await serviceClient
    .from("clinics")
    .select("id, name, owner_id")
    .eq("id", staff.clinic_id)
    .maybeSingle();

  if (clinicErr) {
    res.status(500).json({ error: clinicErr.message });
    return;
  }
  if (!clinic) {
    res.status(403).json({ error: "clinic not found" });
    return;
  }
  if (!clinic.owner_id) {
    // VLUXデモクリニックのように owner_id NULL のクリニックはアクセス不可
    res.status(403).json({ error: "clinic not accessible" });
    return;
  }

  req.staffContext = {
    userId: user.id,
    staffId: staff.id,
    clinicId: staff.clinic_id,
    role: staff.role as "owner" | "staff" | "reception",
    staffName: (staff.name as string | null) ?? null,
    clinicName: (clinic.name as string | null) ?? null,
  };
  next();
}
