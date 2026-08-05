import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { NoTimeChecklist } from './NoTimeChecklist'
import type { ChecklistItem } from '../../domain/ao1k/notimerChecklist'

function Harness({ initial }: { initial: ChecklistItem[] }) {
  const [items, setItems] = useState(initial)
  let counter = 0
  return (
    <NoTimeChecklist
      items={items}
      location="pre"
      onChange={setItems}
      makeId={() => `generated-${++counter}`}
    />
  )
}

describe('NoTimeChecklist', () => {
  it('renders only items for its location', () => {
    const items: ChecklistItem[] = [
      { id: 'a', checked: false, text: 'Breathe', templateId: 't1', location: 'pre' },
      { id: 'b', checked: false, text: 'Note time', templateId: 't2', location: 'post' }
    ]
    render(<Harness initial={items} />)
    expect(screen.getByText('Breathe')).toBeInTheDocument()
    expect(screen.queryByText('Note time')).not.toBeInTheDocument()
  })

  it('toggles a checkbox item on click', async () => {
    const items: ChecklistItem[] = [{ id: 'a', checked: false, text: 'Breathe', templateId: 't1', location: 'pre' }]
    const user = userEvent.setup()
    render(<Harness initial={items} />)

    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).not.toBeChecked()

    await user.click(screen.getByRole('button', { name: 'Toggle Breathe' }))
    expect(screen.getByRole('checkbox')).toBeChecked()
  })

  it('adds a new blank item at this location when "+ Add item" is clicked', async () => {
    const user = userEvent.setup()
    render(<Harness initial={[]} />)

    await user.click(screen.getByRole('button', { name: '+ Add item' }))
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
  })

  it('calls onChange with the item removed after confirming delete', async () => {
    const items: ChecklistItem[] = [{ id: 'a', checked: false, text: 'Breathe', templateId: 't1', location: 'pre' }]
    const onChange = vi.fn()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()

    render(<NoTimeChecklist items={items} location="pre" onChange={onChange} makeId={() => 'x'} />)
    await user.click(screen.getByRole('button', { name: 'Delete item' }))

    expect(onChange).toHaveBeenCalledWith([])
  })
})
