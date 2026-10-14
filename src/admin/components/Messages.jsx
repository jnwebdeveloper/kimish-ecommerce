// Success notice and error message lines used on pages and in dialogs
export default function Messages({ notice, error, errorFirst = false }) {
  const noticeLine = notice && (
    <p role="status" className="success">
      {notice}
    </p>
  )
  const errorLine = error && (
    <p role="alert" className="error">
      {error}
    </p>
  )
  return errorFirst ? (
    <>
      {errorLine}
      {noticeLine}
    </>
  ) : (
    <>
      {noticeLine}
      {errorLine}
    </>
  )
}
