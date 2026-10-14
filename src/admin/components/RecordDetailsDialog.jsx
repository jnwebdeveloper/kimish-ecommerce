import { AdminDetails, singular } from './adminPresentation'
import Modal, { DialogHeading } from './Modal'

export default function RecordDetailsDialog({
  module,
  moduleMeta,
  title,
  row,
  references,
  valueFor,
  readOnly,
  onEdit,
  onClose,
}) {
  return (
    <Modal onClose={onClose} className="admin-detail-modal" aria-label="Record details">
      <DialogHeading
        eyebrow={`${moduleMeta?.label || title} · #${row.id}`}
        title={
          row.name || row.title || row.order_number || row.label || row.code || 'Record details'
        }
        onClose={onClose}
        closeLabel="Close details"
      />
      <AdminDetails
        row={row}
        module={module}
        meta={moduleMeta}
        references={references}
        valueFor={valueFor}
      />
      <div className="admin-modal-actions">
        <button className="btn btn-outline" onClick={onClose}>
          Close
        </button>
        {!readOnly && (
          <button className="btn btn-primary" onClick={onEdit}>
            Edit {singular[module] || 'record'}
          </button>
        )}
      </div>
    </Modal>
  )
}
