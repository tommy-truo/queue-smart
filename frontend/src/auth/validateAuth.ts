export const LIMITS = {
  email: { max: 254 },
  password: { min: 8, max: 64 },
  name: { min: 1, max: 50 },
} as const

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NAME_PATTERN = /^[A-Za-z][A-Za-z' -]{0,49}$/

export type FieldErrors = Partial<Record<string, string>>

export type LoginFields = {
  email: string
  password: string
}

export type RegisterFields = {
  fullName: string
  email: string
  password: string
  confirmPassword: string
}

function isBlank(value: string): boolean {
  return value.trim().length === 0
}

/** Shared email format check (trim + max length + pattern). Does not check required or uniqueness. */
export function validateEmailFormat(email: string): string | undefined {
  const trimmed = email.trim()
  if (trimmed.length > LIMITS.email.max) {
    return `Email must be at most ${LIMITS.email.max} characters.`
  }
  if (!EMAIL_PATTERN.test(trimmed)) {
    return 'Enter a valid email address.'
  }
  return undefined
}

function validatePasswordPolicy(password: string): string | undefined {
  if (password.length < LIMITS.password.min) {
    return `Password must be at least ${LIMITS.password.min} characters.`
  }
  if (password.length > LIMITS.password.max) {
    return `Password must be at most ${LIMITS.password.max} characters.`
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must include at least one uppercase letter.'
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must include at least one lowercase letter.'
  }
  if (!/\d/.test(password)) {
    return 'Password must include at least one digit.'
  }
  return undefined
}

function validateNameField(value: string, label: string): string | undefined {
  const trimmed = value.trim()
  if (trimmed.length < LIMITS.name.min) {
    return `${label} is required.`
  }
  if (trimmed.length > LIMITS.name.max) {
    return `${label} must be at most ${LIMITS.name.max} characters.`
  }
  if (!NAME_PATTERN.test(trimmed)) {
    return `${label} must start with a letter and contain only letters, spaces, hyphens, or apostrophes.`
  }
  return undefined
}

export function validateLogin(fields: LoginFields): FieldErrors {
  const errors: FieldErrors = {}

  if (isBlank(fields.email)) {
    errors.email = 'Email is required.'
  } else {
    const formatError = validateEmailFormat(fields.email)
    if (formatError) errors.email = formatError
  }

  if (fields.password.length === 0) {
    errors.password = 'Password is required.'
  } else if (fields.password.length > LIMITS.password.max) {
    errors.password = `Password must be at most ${LIMITS.password.max} characters.`
  }

  return errors
}

export function validateRegister(fields: RegisterFields): FieldErrors {
  const errors: FieldErrors = {}

  const fullNameError = validateNameField(fields.fullName, 'Full name')
  if (fullNameError) errors.fullName = fullNameError

  if (isBlank(fields.email)) {
    errors.email = 'Email is required.'
  } else {
    const formatError = validateEmailFormat(fields.email)
    if (formatError) errors.email = formatError
  }

  if (fields.password.length === 0) {
    errors.password = 'Password is required.'
  } else {
    const passwordError = validatePasswordPolicy(fields.password)
    if (passwordError) errors.password = passwordError
  }

  if (fields.confirmPassword.length === 0) {
    errors.confirmPassword = 'Confirm password is required.'
  } else if (fields.confirmPassword !== fields.password) {
    errors.confirmPassword = 'Passwords do not match.'
  }

  return errors
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}
