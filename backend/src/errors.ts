export type FieldErrors = Record<string, string>

export class HttpError extends Error {
  status: number
  fields?: FieldErrors

  constructor(status: number, message: string, fields?: FieldErrors) {
    super(message)
    this.status = status
    this.fields = fields
  }
}
