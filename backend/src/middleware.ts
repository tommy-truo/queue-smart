import type { NextFunction, Request, Response } from 'express'
import { HttpError } from './errors.ts'
import { findUserById } from './modules/auth.ts'
import type { Role, User } from './types.ts'

/**
 * Looks up the signed-in user from the `x-user-id` header (returned by login).
 * With no roles given, any signed-in user is allowed.
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const id = req.header('x-user-id')
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
