import { User } from "../types/user.types";

declare global {
  namespace Express {
    interface Request {
      user?: User;
      cookies?: Record<string, string>;
    }
  }
}
