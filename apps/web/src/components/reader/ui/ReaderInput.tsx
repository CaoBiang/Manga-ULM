import { forwardRef, useImperativeHandle, useRef } from 'react'

export type ReaderInputHandle = {
  focus: () => void
  select: () => void
}

export type ReaderInputProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  maxLength?: number
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  className?: string
  onPressEnter?: () => void
}

const joinClass = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ')

const ReaderInput = forwardRef<ReaderInputHandle, ReaderInputProps>(function ReaderInput(
  { value, onChange, placeholder = '', disabled = false, maxLength, inputMode, className, onPressEnter },
  ref
) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  useImperativeHandle(
    ref,
    () => ({
      focus: () => inputRef.current?.focus(),
      select: () => inputRef.current?.select()
    }),
    []
  )

  return (
    <div className={joinClass('reader-input', disabled ? 'is-disabled' : '', className)}>
      <input
        ref={inputRef}
        className="reader-input__control"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={maxLength}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        onKeyUp={(event) => {
          if (event.key === 'Enter') {
            onPressEnter?.()
          }
        }}
      />
    </div>
  )
})

export default ReaderInput

