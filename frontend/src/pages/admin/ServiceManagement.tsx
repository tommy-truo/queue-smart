import { useState, type FormEvent } from 'react'
import { services as mockServices } from '../../mock/data.ts'
import type { Priority, Service } from '../../types.ts'

type FormValues = {
  name: string
  description: string
  expectedDuration: string
  priority: Priority
}

type FormErrors = Partial<Record<keyof FormValues, string>>

const emptyForm: FormValues = { name: '', description: '', expectedDuration: '', priority: 'medium' }

const NAME_MAX = 100

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {}
  const name = values.name.trim()
  if (!name) errors.name = 'Service name is required.'
  else if (name.length > NAME_MAX) errors.name = `Service name must be ${NAME_MAX} characters or less.`

  if (!values.description.trim()) errors.description = 'Description is required.'

  const duration = Number(values.expectedDuration)
  if (!values.expectedDuration) errors.expectedDuration = 'Expected duration is required.'
  else if (!Number.isInteger(duration) || duration < 1)
    errors.expectedDuration = 'Expected duration must be a whole number of minutes (1 or more).'

  return errors
}

export default function ServiceManagement() {
  // UI only: changes are kept in local state, not saved to the mock data.
  const [services, setServices] = useState(mockServices)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [values, setValues] = useState<FormValues>(emptyForm)
  const [errors, setErrors] = useState<FormErrors>({})
  const [message, setMessage] = useState('')

  function startEdit(service: Service) {
    setEditingId(service.id)
    setValues({
      name: service.name,
      description: service.description,
      expectedDuration: String(service.expectedDuration),
      priority: service.priority,
    })
    setErrors({})
    setMessage('')
  }

  function resetForm() {
    setEditingId(null)
    setValues(emptyForm)
    setErrors({})
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const found = validate(values)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    const fields = {
      name: values.name.trim(),
      description: values.description.trim(),
      expectedDuration: Number(values.expectedDuration),
      priority: values.priority,
    }

    if (editingId) {
      setServices(services.map((s) => (s.id === editingId ? { ...s, ...fields } : s)))
      setMessage(`Saved changes to ${fields.name}.`)
    } else {
      setServices([...services, { id: `s${Date.now()}`, open: false, ...fields }])
      setMessage(`Created ${fields.name}. Its queue starts closed.`)
    }
    resetForm()
  }

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues({ ...values, [key]: value })
  }

  return (
    <div className="page">
      <h1>Service Management</h1>

      {message ? <p role="status">{message}</p> : null}

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
                <button type="button" onClick={() => startEdit(s)}>
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>{editingId ? 'Edit service' : 'Create service'}</h2>
      <p>* Required field</p>
      <form noValidate onSubmit={handleSubmit} className="page-form">
        <div>
          <label htmlFor="service-name">Service name *</label>
          <br />
          <input
            id="service-name"
            type="text"
            required
            maxLength={NAME_MAX}
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
            step={1}
            required
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
            value={values.priority}
            onChange={(e) => update('priority', e.target.value as Priority)}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        <div>
          <button type="submit">{editingId ? 'Save changes' : 'Create service'}</button>{' '}
          {editingId ? (
            <button type="button" onClick={resetForm}>
              Cancel
            </button>
          ) : null}
        </div>
      </form>
    </div>
  )
}
