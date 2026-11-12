import { readSpecifications } from '../../utils/specifications'
import './ProductSpecifications.css'

export default function ProductSpecifications({ value, onChange }) {
  const rows = readSpecifications(value)
  const save = (next) => onChange(JSON.stringify(next))
  const update = (index, field, text) =>
    save(rows.map((row, i) => (i === index ? { ...row, [field]: text } : row)))
  return (
    <div className="admin-field-wide product-specification-editor">
      <h3>Product specifications</h3>
      <p>Add a specification name and value to display on the product detail page.</p>
      {rows.map((row, index) => (
        <div className="product-specification-row" key={index}>
          <label>
            Specification name
            <input
              required
              value={row.name}
              placeholder={`Specification ${index + 1}`}
              onChange={(e) => update(index, 'name', e.target.value)}
            />
          </label>
          <label>
            Specification value
            <input
              required
              value={row.value}
              placeholder="Enter value"
              onChange={(e) => update(index, 'value', e.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn btn-outline"
            aria-label={`Remove specification ${index + 1}`}
            onClick={() => save(rows.filter((_, i) => i !== index))}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-outline"
        onClick={() => save([...rows, { name: '', value: '' }])}
      >
        + Add specification
      </button>
    </div>
  )
}
