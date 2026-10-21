import { useEffect, useRef, useState } from 'react'
import {
  contentHtml,
  contentText,
  isRichText,
  richValue,
  sanitizeRichText,
} from '../../utils/richText'
import PageContent from '../../components/PageContent'
import './RichTextEditor.css'
const tools = [
  ['bold', 'B', 'Bold'],
  ['italic', 'I', 'Italic'],
  ['underline', 'U', 'Underline'],
  ['insertUnorderedList', '• List', 'Bulleted list'],
  ['insertOrderedList', '1. List', 'Numbered list'],
  ['undo', '↶', 'Undo'],
  ['redo', '↷', 'Redo'],
]
export default function RichTextEditor({ value = '', onChange, disabled = false }) {
  const [mode, setMode] = useState(isRichText(value) || !value ? 'rich' : 'plain')
  const [error, setError] = useState('')
  const editor = useRef(null),
    selection = useRef(null),
    lastEmitted = useRef(null)
  useEffect(() => {
    if (mode === 'rich' && editor.current && value !== lastEmitted.current)
      editor.current.innerHTML = contentHtml(value)
  }, [value, mode])
  const emit = () => {
    const next = richValue(editor.current.innerHTML)
    lastEmitted.current = next
    onChange(next)
  }
  const remember = () => {
    const current = window.getSelection()
    if (
      current?.rangeCount &&
      editor.current?.contains(current.anchorNode) &&
      editor.current?.contains(current.focusNode)
    )
      selection.current = current.getRangeAt(0).cloneRange()
  }
  const command = (name, argument) => {
    editor.current?.focus()
    if (selection.current && editor.current?.contains(selection.current.commonAncestorContainer)) {
      const current = window.getSelection()
      current.removeAllRanges()
      current.addRange(selection.current)
    }
    document.execCommand(name, false, argument)
    remember()
    emit()
  }
  const link = () => {
    const url = window.prompt('Enter a link beginning with https://, http:// or mailto:')
    if (url === null) return
    if (!/^(https?:\/\/|mailto:)[^\s]+$/i.test(url.trim())) {
      setError('Enter a valid http, https or email link.')
      return
    }
    setError('')
    command('createLink', url.trim())
  }
  return (
    <div className="page-editor">
      <div className="page-editor-modes" role="group" aria-label="Content editing mode">
        {[
          ['rich', 'Rich text'],
          ['plain', 'Plain text'],
          ['preview', 'Preview'],
        ].map(([id, label]) => (
          <button
            type="button"
            key={id}
            aria-pressed={mode === id}
            disabled={disabled}
            onClick={() => {
              lastEmitted.current = null
              selection.current = null
              setMode(id)
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === 'rich' && (
        <>
          <div className="page-editor-toolbar" role="toolbar" aria-label="Text formatting">
            <select
              aria-label="Paragraph style"
              disabled={disabled}
              defaultValue=""
              onChange={(e) => {
                command('formatBlock', e.target.value)
                e.target.value = ''
              }}
            >
              <option value="" disabled>
                Paragraph style
              </option>
              <option value="p">Paragraph</option>
              <option value="h2">Heading</option>
              <option value="h3">Subheading</option>
              <option value="blockquote">Quote</option>
            </select>
            {tools.map(([cmd, label, title]) => (
              <button
                key={cmd}
                type="button"
                title={title}
                aria-label={title}
                disabled={disabled}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => command(cmd)}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              disabled={disabled}
              onMouseDown={(e) => e.preventDefault()}
              onClick={link}
            >
              Link
            </button>
            <button
              type="button"
              disabled={disabled}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => command('unlink')}
            >
              Unlink
            </button>
          </div>
          <div
            ref={editor}
            className="page-editor-surface page-prose"
            role="textbox"
            aria-label="Page content rich text"
            aria-multiline="true"
            aria-required="true"
            aria-disabled={disabled}
            contentEditable={!disabled}
            suppressContentEditableWarning
            tabIndex={0}
            onInput={emit}
            onKeyUp={remember}
            onMouseUp={remember}
            onBlur={remember}
            onPaste={(e) => {
              e.preventDefault()
              const html = e.clipboardData.getData('text/html')
              const text = e.clipboardData.getData('text/plain')
              command('insertHTML', html ? sanitizeRichText(html) : contentHtml(text))
            }}
            onDrop={(e) => e.preventDefault()}
          />
        </>
      )}
      {mode === 'plain' && (
        <>
          <p className="page-editor-hint">
            Use the text area for simple copy. Editing here removes rich-text formatting.
          </p>
          <textarea
            aria-label="Page content plain text"
            value={contentText(value)}
            maxLength={20000}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            rows={12}
            placeholder="Enter your page content…"
          />
        </>
      )}
      {mode === 'preview' && (
        <div className="page-editor-preview">
          <PageContent value={value} />
        </div>
      )}
      <div className="page-editor-footer">
        <span>Headings, lists and links are supported. Save changes to update the page.</span>
        <span>{value.length.toLocaleString()} / 20,000</span>
      </div>
      {value.length > 20000 && (
        <p role="alert" className="page-editor-error">
          Content is too long. Shorten it before saving.
        </p>
      )}
      {error && (
        <p role="alert" className="page-editor-error">
          {error}
        </p>
      )}
    </div>
  )
}
