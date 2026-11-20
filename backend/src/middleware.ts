import type { NextFunction, Request, Response } from 'express'
import { HttpError } from './errors.ts'
import { findUserById } from './modules/auth.ts'
import type { Role, User } from './types.ts'
import { sessionUserId } from './sessions.ts'

/**
 * Looks up the signed-in user from a server-validated session cookie.
 * With no roles given, any signed-in user is allowed.
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const id = sessionUserId(req)
    const user = id ? findUserById(id) : undefined
    if (!user) throw new HttpError(401, 'Sign in required.')
    if (roles.length > 0 && !roles.includes(user.role)) {
      throw new HttpError(403, 'You do not have access to this action.')
    }
    res.locals.user = user
    next()
  }
}

export function currentUser(res: Response): User {
  return res.locals.user as User
}

/** Reject cross-site browser mutations, including login/logout session changes. */
export function protectMutations(req: Request, _res: Response, next: NextFunction): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) { next(); return }
  const origin = req.get('origin')
  const expected = process.env.APP_ORIGIN ?? `${req.protocol}://${req.get('host')}`
  if (req.get('sec-fetch-site') === 'cross-site' || (origin && origin !== expected)) {
    throw new HttpError(403, 'Cross-site requests are not allowed.')
  }
  next()
}
