import test from 'node:test'
import assert from 'node:assert/strict'
import { categoryPath, categoryGroup, categoryOptions } from '../src/data/categoryHierarchy.js'
const groups = [
  { id: 1, name: 'Food' },
  { id: 2, name: 'Gifts' },
]
const categories = [
  { id: 10, name: 'Nuts', group_id: 1, parent_id: null },
  { id: 11, name: 'Cashews', group_id: 1, parent_id: 10 },
  { id: 12, name: 'Roasted', group_id: 1, parent_id: 11 },
  { id: 20, name: 'Boxes', group_id: 2, parent_id: null },
]
test('editing a third-level category restores every ancestor and group', () => {
  assert.deepEqual(
    categoryPath(categories, '12').map((c) => c.id),
    [10, 11, 12],
  )
  assert.equal(categoryGroup(categories, groups, '12'), '1')
})
test('category choices stay within the selected group and parent branch', () => {
  assert.deepEqual(
    categoryOptions(categories, groups, '1', null).map((c) => c.id),
    [10],
  )
  assert.deepEqual(
    categoryOptions(categories, groups, '1', '10').map((c) => c.id),
    [11],
  )
  assert.deepEqual(
    categoryOptions(categories, groups, '1', '11').map((c) => c.id),
    [12],
  )
  assert.deepEqual(
    categoryOptions(categories, groups, '2', null).map((c) => c.id),
    [20],
  )
})
test('clearing a child retains its parent path; legacy groups and cycles are handled', () => {
  assert.deepEqual(
    categoryPath(categories, 10).map((c) => c.id),
    [10],
  )
  assert.deepEqual(
    categoryPath(categories, '').map((c) => c.id),
    [],
  )
  assert.equal(categoryGroup([{ id: 1, name: 'Legacy', group_name: 'Food' }], groups, 1), '1')
  assert.equal(
    categoryPath(
      [
        { id: 1, parent_id: 2 },
        { id: 2, parent_id: 1 },
      ],
      1,
    ).length,
    2,
  )
})
