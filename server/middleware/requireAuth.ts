import type { Request, Response, NextFunction } from "express";
import { getUserFromToken } from "../lib/supabaseService";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      authUser?: {
        id: string;
        email: string | null;
      };
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = await getUserFromToken(req.headers.authorization);
  if (!user) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  req.authUser = { id: user.id, email: user.email };
  next();
}
