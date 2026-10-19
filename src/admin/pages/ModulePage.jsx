import { useState } from 'react'
import { listColumns, singular } from '../components/adminPresentation'
import DeleteDialog from '../components/DeleteDialog'
import Messages from '../components/Messages'
import RecordDetailsDialog from '../components/RecordDetailsDialog'
import RecordEditor from '../components/RecordEditor'
import RecordTable from '../components/RecordTable'
import { makeFieldValue } from '../data/fieldValue'
import { menuLabel, moduleOptions } from '../data/menu'
import { useModuleData } from '../data/useModuleData'
import { usePageTitle } from '../layout/usePageTitle'
import { useAdminSession } from '../session/AdminSession'

// List + view/add/edit/delete for one module, generated from its field definitions.
// Dedicated pages (Products, Orders, Settings) pass extras:
//   help, intro       text and content above the list
//   formatters        column display overrides: { column: (row) => value }, or (references) => that
//   fieldOverrides    editor input overrides: { field: (record, set) => element }, or (references) => that
//   validate          (record) => error message that blocks saving
//   renderEditorExtras  ({ record, busy, setBusy, setError, setNotice, references, reload }) => element
//   AddDialog         replaces the Add editor: ({ references, onClose, onCreated }) => element
//   renderDetailsExtras  ({ row, reload }) => element shown in the record details dialog
export default function ModulePage({
  module,
  help,
  intro,
  formatters,
  fieldOverrides,
  validate,
  renderEditorExtras,
  AddDialog,
  renderDetailsExtras,
}) {
  const { meta } = useAdminSession()
  const options = moduleOptions[module] || {}
  const moduleMeta = meta[module]
  const title = options.title || moduleMeta?.label || menuLabel(module)
  usePageTitle(title)
  const { rows, references, error, reload } = useModuleData(module)
  const [search, setSearch] = useState(''),
    [notice, setNotice] = useState('')
  // Open dialog: { type: 'add' | 'edit' | 'view' | 'delete', row }
  const [dialog, setDialog] = useState(null)
  const close = () => setDialog(null)
  // The details dialog shows the freshest copy of its record, so a reload (e.g. after Ship saves
  // a tracking number) updates it instead of leaving the values from when it was opened
  const viewRow =
    dialog?.type === 'view' ? rows.find((r) => r.id === dialog.row.id) || dialog.row : null
  const done = (message) => {
    setDialog(null)
    setNotice(message)
    return reload()
  }

  // formatters and fieldOverrides may be functions of the loaded reference lists
  const withReferences = (value) => (typeof value === 'function' ? value(references) : value)
  const valueFor = makeFieldValue(moduleMeta, references, withReferences(formatters))
  const filtered = rows.filter((row) =>
    JSON.stringify(row).toLowerCase().includes(search.toLowerCase()),
  )
  const helpText = help || options.help

  return (
    <>
      <h2>{title}</h2>
      {helpText && <p className="admin-module-help">{helpText}</p>}
      {intro}
      <Messages notice={notice} error={error} errorFirst />
      <div className="admin-toolbar">
        <input
          aria-label="Search records"
          placeholder="Search records…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {!options.readOnly && (
          <button
            className="btn btn-primary"
            disabled={!moduleMeta}
            onClick={() => setDialog({ type: 'add' })}
          >
            Add {singular[module] || 'record'}
          </button>
        )}
        <button className="btn btn-outline" onClick={reload}>
          Refresh
        </button>
      </div>
      <p>{filtered.length} records</p>
      <RecordTable
        rows={filtered}
        columns={listColumns[module] || []}
        moduleMeta={moduleMeta}
        valueFor={valueFor}
        readOnly={options.readOnly}
        onView={(row) => setDialog({ type: 'view', row })}
        onEdit={(row) => setDialog({ type: 'edit', row })}
        onDelete={(row) => setDialog({ type: 'delete', row })}
      />

      {dialog?.type === 'add' && AddDialog && (
        <AddDialog references={references} onClose={close} onCreated={done} />
      )}
      {((dialog?.type === 'add' && !AddDialog) || dialog?.type === 'edit') && (
        <RecordEditor
          // A new editor for each record, so its form state starts fresh
          key={dialog.row?.id ?? 'new'}
          module={module}
          moduleMeta={moduleMeta}
          row={dialog.row}
          references={references}
          hiddenFields={options.hiddenFields}
          fieldOverrides={withReferences(fieldOverrides)}
          validate={validate}
          renderExtras={
            renderEditorExtras &&
            ((editor) => renderEditorExtras({ ...editor, references, reload }))
          }
          onClose={close}
          onSaved={done}
        />
      )}
      {dialog?.type === 'view' && (
        <RecordDetailsDialog
          module={module}
          moduleMeta={moduleMeta}
          title={title}
          row={viewRow}
          references={references}
          valueFor={valueFor}
          readOnly={options.readOnly}
          extras={renderDetailsExtras?.({ row: viewRow, reload })}
          onEdit={() => setDialog({ type: 'edit', row: dialog.row })}
          onClose={close}
        />
      )}
      {dialog?.type === 'delete' && (
        <DeleteDialog module={module} row={dialog.row} onClose={close} onDeleted={done} />
      )}
    </>
  )
}
