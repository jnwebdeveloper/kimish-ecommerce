import { Fragment, useState } from 'react'
import { apiRequest } from '../../data/StoreContext'
import { acceptImages, isAllowedImage, uploadImage } from '../data/uploads'
import { sectionFor, singular } from './adminPresentation'
import Messages from './Messages'
import Modal, { DialogHeading } from './Modal'

const blankRecord = (moduleMeta) =>
  Object.fromEntries(
    moduleMeta.fields.map((f) => [
      f.name,
      f.type === 'boolean'
        ? ['active'].includes(f.name)
        : f.options
          ? f.options[0]
          : f.type === 'number'
            ? 0
            : '',
    ]),
  )

// Add/edit dialog generated from the module's field definitions.
// fieldOverrides: { fieldName: (record, setRecord) => element } replaces a field's input.
// validate(record) returns an error message to block saving. renderExtras adds content below the fields.
export default function RecordEditor({
  module,
  moduleMeta,
  row,
  references,
  hiddenFields = [],
  fieldOverrides = {},
  validate,
  renderExtras,
  onClose,
  onSaved,
}) {
  const [record, setRecord] = useState(() => (row ? { ...row } : blankRecord(moduleMeta))),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('')
  const set = (name, value) => setRecord((prev) => ({ ...prev, [name]: value }))

  const sections = Object.entries(
    moduleMeta.fields
      .filter((f) => f.name !== 'slug' && !hiddenFields.includes(f.name))
      .reduce((groups, f) => {
        ;(groups[sectionFor(f)] ||= []).push(f)
        return groups
      }, {}),
  )

  async function save(e) {
    e.preventDefault()
    const problem = validate?.(record)
    if (problem) {
      setError(problem)
      return
    }
    setBusy(true)
    setError('')
    try {
      await apiRequest(
        `/api/admin/${module}${record.id ? '/' + record.id : ''}`,
        record,
        record.id ? 'PUT' : 'POST',
      )
      onSaved('Changes saved successfully.')
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  async function uploadField(file, field) {
    if (!file) return
    setError('')
    if (!isAllowedImage(file)) {
      setError('Select a JPG, PNG, WebP or AVIF image smaller than 8 MB.')
      return
    }
    setBusy(true)
    try {
      const url = await uploadImage(
        file,
        'Image upload failed. Check your Cloudflare R2 CORS settings.',
      )
      set(field, url)
      setNotice('Image uploaded successfully. Save this record to keep it.')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const input = (f) => {
    const onChange = (e) => set(f.name, e.target.value)
    if (f.type === 'boolean')
      return (
        <input
          type="checkbox"
          checked={!!record[f.name]}
          onChange={(e) => set(f.name, e.target.checked)}
        />
      )
    if (f.type === 'textarea')
      return <textarea value={record[f.name] || ''} required={f.required} onChange={onChange} />
    if (f.type === 'select' || references[f.type])
      return (
        <select required={f.required} value={record[f.name] ?? ''} onChange={onChange}>
          <option value="">Select…</option>
          {(
            f.options || references[f.type].map((r) => ({ id: r.id, label: r.name || r.phone }))
          ).map((o) => (
            <option key={o.id || o} value={o.id || o}>
              {o.label || o}
            </option>
          ))}
        </select>
      )
    return (
      <input
        type={['number', 'password', 'email'].includes(f.type) ? f.type : 'text'}
        min={f.type === 'number' ? 0 : undefined}
        step={f.type === 'number' ? 'any' : undefined}
        value={record[f.name] ?? ''}
        required={f.required}
        onChange={onChange}
      />
    )
  }

  return (
    <Modal onClose={onClose} busy={busy} aria-labelledby="editor-title">
      <DialogHeading
        eyebrow={moduleMeta.label}
        title={`${record.id ? 'Edit' : 'Add'} ${singular[module] || 'record'}`}
        titleId="editor-title"
        subtitle="Required fields are marked *."
        onClose={onClose}
        busy={busy}
        closeLabel="Close editor"
      />
      <form onSubmit={save}>
        {sections.map(([title, fields]) => (
          <fieldset className="admin-form-section" key={title}>
            <legend>{title}</legend>
            <div className="admin-form-grid">
              {fields.map((f) =>
                fieldOverrides[f.name] ? (
                  <Fragment key={f.name}>{fieldOverrides[f.name](record, set)}</Fragment>
                ) : (
                  <label
                    className={
                      ['content', 'body', 'seo_description'].includes(f.name)
                        ? 'admin-field-wide'
                        : f.type === 'boolean'
                          ? 'admin-toggle'
                          : ''
                    }
                    key={f.name}
                  >
                    {f.label}
                    {f.required ? ' *' : ''}
                    {input(f)}
                    {f.name === 'image' && (
                      <>
                        <input
                          aria-label={`Upload ${f.label}`}
                          type="file"
                          accept={acceptImages}
                          onChange={(e) => uploadField(e.target.files?.[0], f.name)}
                        />
                        <small>
                          Choose a JPG, PNG, WebP or AVIF image up to 8 MB, or paste an image link.
                        </small>
                        {record[f.name] && (
                          <img
                            src={record[f.name]}
                            alt="Image preview"
                            style={{ width: 110, height: 110, objectFit: 'contain' }}
                          />
                        )}
                      </>
                    )}
                  </label>
                ),
              )}
            </div>
          </fieldset>
        ))}
        {renderExtras?.({ record, busy, setBusy, setError, setNotice })}
        <Messages notice={notice} error={error} />
        <div className="admin-modal-actions">
          <button disabled={busy} className="btn btn-primary">
            Save changes
          </button>
          <button type="button" disabled={busy} className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  )
}
