import { useState } from 'react'
import { categoryPath, categoryGroup, categoryOptions } from '../../data/categoryHierarchy'

export default function ProductCategoryFields({ categories = [], groups = [], value, onChange }) {
  const path = categoryPath(categories, value)
  const [groupId, setGroupId] = useState(() => categoryGroup(categories, groups, value))
  return (
    <div className="admin-category-fields admin-field-wide">
      <label>
        Category group *
        <select
          required
          value={groupId}
          onChange={(e) => {
            setGroupId(e.target.value)
            onChange('')
          }}
        >
          <option value="">Select group</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
              {g.active === false ? ' (unpublished)' : ''}
            </option>
          ))}
        </select>
      </label>
      {[0, 1, 2].map((level) => {
        const parent = path[level - 1]
        const available = groupId && (level === 0 || parent)
        const options = available ? categoryOptions(categories, groups, groupId, parent?.id) : []
        return (
          <label key={level}>
            {['Category (level 1) *', 'Subcategory (level 2)', 'Subcategory (level 3)'][level]}
            <select
              required={level === 0}
              disabled={!available || !options.length}
              value={path[level]?.id || ''}
              onChange={(e) => onChange(e.target.value || parent?.id || '')}
            >
              <option value="">
                {!available
                  ? level === 0
                    ? 'Select group first'
                    : 'Select previous level first'
                  : !options.length
                    ? 'No subcategories'
                    : level === 0
                      ? 'Select category'
                      : 'None — use parent category'}
              </option>
              {options.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.active === false ? ' (unpublished)' : ''}
                </option>
              ))}
            </select>
          </label>
        )
      })}
      <small className="admin-field-wide">
        {path.length
          ? path.map((c) => c.name).join(' › ')
          : 'Choose a group and category. Select subcategories where applicable.'}
      </small>
      {groupId && !categoryOptions(categories, groups, groupId, null).length && (
        <small className="admin-field-wide">
          This group has no categories. Add one in Categories before assigning a product.
        </small>
      )}
    </div>
  )
}
