import { contentHtml, isRichText } from '../utils/richText'
import './PageContent.css'
export default function PageContent({ value = '', className = '' }) {
  return isRichText(value) ? (
    <div
      className={`page-prose ${className}`}
      dangerouslySetInnerHTML={{ __html: contentHtml(value) }}
    />
  ) : (
    <div className={`page-prose page-prose-plain ${className}`}>{value}</div>
  )
}
