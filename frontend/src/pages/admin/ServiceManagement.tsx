import { useEffect, useState, type FormEvent } from 'react'
import { api, ApiError } from '../../api.ts'
import type { Priority, Service } from '../../types.ts'

type FormValues = {
  name: string
  description: string
  expectedDuration: string
  priority: Priority
  notification?: string
}

type FormErrors = Partial<Record<keyof FormValues, string>>

const emptyForm: FormValues = { name: '', description: '', expectedDuration: '', priority: 'medium' }

const NAME_MAX = 100
const DESCRIPTION_MAX = 500

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {}
  const name = values.name.trim()
  if (!name) errors.name = 'Service name is required.'
  else if (name.length > NAME_MAX) errors.name = `Service name must be ${NAME_MAX} characters or less.`

  if (!values.description.trim()) errors.description = 'Description is required.'
  else if (values.description.trim().length > DESCRIPTION_MAX)
    errors.description = `Description must be ${DESCRIPTION_MAX} characters or less.`

  const duration = Number(values.expectedDuration)
  if (!values.expectedDuration) errors.expectedDuration = 'Expected duration is required.'
  else if (!Number.isInteger(duration) || duration < 1 || duration > 480)
    errors.expectedDuration = 'Expected duration must be a whole number of minutes from 1 to 480.'

  if (!['low', 'medium', 'high'].includes(values.priority)) errors.priority = 'Choose low, medium, or high.'

  if (!(values.notification === undefined))
    if (values.notification.trim().length > DESCRIPTION_MAX)
      errors.notification = `Notification must be ${DESCRIPTION_MAX} characters or less.`
  
  return errors
}

export default function ServiceManagement() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reload, setReload] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [values, setValues] = useState<FormValues>(emptyForm)
  const [errors, setErrors] = useState<FormErrors>({})
  const [message, setMessage] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    api<Service[]>('/services')
      .then(data => { if (active) setServices(data) })
      .catch(error => { if (active) setLoadError(error instanceof Error ? error.message : 'Could not load services.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reload])

  function retry() {
    setLoading(true)
    setLoadError('')
    setReload(value => value + 1)
  }

  function startEdit(service: Service) {
    setEditingId(service.id)
    setValues({
      name: service.name,
      description: service.description,
      expectedDuration: String(service.expectedDuration),
      priority: service.priority,
      notification: service.notification
    })
    setErrors({})
    setMessage('')
    setSaveError('')
  }

  function resetForm() {
    setEditingId(null)
    setValues(emptyForm)
    setErrors({})
    setSaveError('')
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (saving) return
    setMessage('')
    setSaveError('')
    const found = validate(values)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    const fields = {
      name: values.name.trim(),
      description: values.description.trim(),
      expectedDuration: Number(values.expectedDuration),
      priority: values.priority,
      notification: values.notification,
    }

    setSaving(true)
    try {
      const saved = await api<Service>(editingId ? `/services/${encodeURIComponent(editingId)}` : '/services', {
        method: editingId ? 'PUT' : 'POST',
        body: fields,
      })
      setServices(previous => editingId
        ? previous.map(service => service.id === saved.id ? saved : service)
        : [...previous, saved])
      setMessage(editingId
        ? `Saved changes to ${saved.name}.`
        : `Created ${saved.name}. Its queue starts ${saved.open ? 'open' : 'closed'}.`)
      resetForm()
    } catch (error) {
      if (error instanceof ApiError && error.fields) setErrors(error.fields)
      setSaveError(error instanceof Error ? error.message : 'Could not save the service.')
    } finally {
      setSaving(false)
    }
  }

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues({ ...values, [key]: value })
  }

  if (loading) return <div className="page"><h1>Service Management</h1><p role="status">Loading services…</p></div>
  if (loadError) return <div className="page"><h1>Service Management</h1><p role="alert">{loadError}</p><button type="button" onClick={retry}>Retry</button></div>

  return (
    <div className="page">
      <h1>Service Management</h1>

      {message ? <p role="status">{message}</p> : null}
      {services.length === 0 ? <p>No services yet. Create one below.</p> : null}

      <table>
        <thead>
          <tr>
            <th>Service</th>
            <th>Description</th>
            <th>Duration (min)</th>
            <th>Priority</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {services.map((s) => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td>{s.description}</td>
              <td>{s.expectedDuration}</td>
              <td>{s.priority}</td>
              <td>
                <button type="button" disabled={saving} onClick={() => startEdit(s)}>
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>{editingId ? 'Edit service' : 'Create service'}</h2>
      <p>* Required field</p>
      {saveError ? <p role="alert">{saveError}</p> : null}
      <form noValidate onSubmit={handleSubmit} className="page-form">
        <div>
          <label htmlFor="service-name">Service name *</label>
          <br />
          <input
            id="service-name"
            type="text"
            required
            maxLength={NAME_MAX}
            disabled={saving}
            value={values.name}
            onChange={(e) => update('name', e.target.value)}
          />{' '}
          <small>
            {values.name.length}/{NAME_MAX}
          </small>
          {errors.name ? <div role="alert">{errors.name}</div> : null}
        </div>

        <div>
          <label htmlFor="service-description">Description *</label>
          <br />
          <textarea
            id="service-description"
            required
            rows={3}
            maxLength={DESCRIPTION_MAX}
            disabled={saving}
            cols={40}
            value={values.description}
            onChange={(e) => update('description', e.target.value)}
          />
          {errors.description ? (
            <div role="alert">{errors.description}</div>
          ) : null}
        </div>

        <div>
          <label htmlFor="service-duration">Expected duration (minutes) *</label>
          <br />
          <input
            id="service-duration"
            type="number"
            min={1}
            max={480}
            step={1}
            required
            disabled={saving}
            value={values.expectedDuration}
            onChange={(e) => update('expectedDuration', e.target.value)}
          />
          {errors.expectedDuration ? (
            <div role="alert">{errors.expectedDuration}</div>
          ) : null}
        </div>

        <div>
          <label htmlFor="service-priority">Priority level *</label>
          <br />
          <select
            id="service-priority"
            disabled={saving}
            value={values.priority}
            onChange={(e) => update('priority', e.target.value as Priority)}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          {errors.priority ? <div role="alert">{errors.priority}</div> : null}
        </div>

        <div>
          <label htmlFor="service-notification">Notification Message</label>
          <br />
          <textarea
            id="service-notification"
            rows={3}
            maxLength={DESCRIPTION_MAX}
            disabled={saving}
            cols={40}
            value={values.notification}
            onChange={(e) => update('notification', e.target.value)}
          />
          {errors.notification ? (
            <div role="alert">{errors.notification}</div>
          ) : null}
        </div>

        <div>
          <button type="submit" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Create service'}</button>{' '}
          {editingId ? (
            <button type="button" disabled={saving} onClick={resetForm}>
              Cancel
            </button>
          ) : null}
        </div>
      </form>
    </div>
  )
}
