import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { homePath, useAuth } from '../../auth/AuthContext.ts'
import { LIMITS, validateRegister } from '../../auth/validateAuth.ts'
import './auth.css'

type RegisterField = 'fullName' | 'email' | 'password' | 'confirmPassword'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<RegisterField, string>>>({})

  function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const input = {
      fullName,
      email,
      password,
      confirmPassword,
    }

    const errors = validateRegister(input)
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    const result = register(input)
    if (!result.ok) {
      if (result.reason === 'email-taken') {
        setFieldErrors({ email: 'An account with this email already exists.' })
      } else if (result.reason === 'validation') {
        setFieldErrors(result.errors as Partial<Record<RegisterField, string>>)
      }
      return
    }

    navigate(homePath[result.role])
  }

  return (
    <section className="auth">
      <h1>Register</h1>
      <p className="auth-legend">
        <span className="auth-required" aria-hidden="true">
          *
        </span>{' '}
        Required field
      </p>
      <form noValidate onSubmit={handleSubmit}>
        <div className="auth-field">
          <label htmlFor="register-full-name">
            Full name{' '}
            <span className="auth-required" aria-hidden="true">
              *
            </span>
          </label>
          <input
            id="register-full-name"
            name="fullName"
            type="text"
            autoComplete="name"
            required
            maxLength={LIMITS.name.max}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          {fieldErrors.fullName ? <div role="alert">{fieldErrors.fullName}</div> : null}
        </div>
        <div className="auth-field">
          <label htmlFor="register-email">
            Email{' '}
            <span className="auth-required" aria-hidden="true">
              *
            </span>
          </label>
          <input
            id="register-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={LIMITS.email.max}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {fieldErrors.email ? <div role="alert">{fieldErrors.email}</div> : null}
        </div>
        <div className="auth-field">
          <label htmlFor="register-password">
            Password{' '}
            <span className="auth-required" aria-hidden="true">
              *
            </span>
          </label>
          <input
            id="register-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            maxLength={LIMITS.password.max}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {fieldErrors.password ? <div role="alert">{fieldErrors.password}</div> : null}
        </div>
        <div className="auth-field">
          <label htmlFor="register-confirm-password">
            Confirm password{' '}
            <span className="auth-required" aria-hidden="true">
              *
            </span>
          </label>
          <input
            id="register-confirm-password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            maxLength={LIMITS.password.max}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          {fieldErrors.confirmPassword ? (
            <div role="alert">{fieldErrors.confirmPassword}</div>
          ) : null}
        </div>
        <button type="submit">Create account</button>
      </form>
      <p>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </section>
  )
}
