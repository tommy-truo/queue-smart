import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { homePath, useAuth } from '../../auth/AuthContext.ts'
import { LIMITS, validateLogin } from '../../auth/validateAuth.ts'
import './auth.css'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<'email' | 'password', string>>>({})
  const [formError, setFormError] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError('')

    const errors = validateLogin({ email, password })
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    const result = login(email, password)
    if (!result.ok) {
      setFormError('Email or password is incorrect.')
      return
    }

    navigate(homePath[result.role])
  }

  return (
    <section className="auth">
      <h1>Login</h1>
      <form noValidate onSubmit={handleSubmit}>
        <div className="auth-field">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={LIMITS.email.max}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {fieldErrors.email ? <div role="alert">{fieldErrors.email}</div> : null}
        </div>
        <div className="auth-field">
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            maxLength={LIMITS.password.max}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {fieldErrors.password ? <div role="alert">{fieldErrors.password}</div> : null}
        </div>
        {formError ? <div role="alert">{formError}</div> : null}
        <button type="submit">Log in</button>
      </form>
      <p>
        Don&apos;t have an account? <Link to="/register">Register</Link>
      </p>
    </section>
  )
}
