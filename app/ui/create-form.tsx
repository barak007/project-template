/**
 * The form that makes one thing. Creating is a rare action, so this is never
 * permanent furniture on the page: a caller shows it as an empty list's whole
 * content, or behind the page's primary button — see `openForm` in the client's
 * state.ts.
 *
 * It autofocuses because it was just asked for, and Escape closes it: a
 * disclosure that can only be opened is a trap.
 */
export function CreateForm({
  label,
  placeholder,
  value,
  pending,
  submitLabel,
  onChange,
  onSubmit,
  onCancel,
}: {
  label: string;
  placeholder: string;
  value: string;
  pending: boolean;
  submitLabel: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const empty = value.trim() === "";
  return (
    <form
      className="create-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        onCancel();
      }}
    >
      <label>
        {label}
        <input
          value={value}
          placeholder={placeholder}
          disabled={pending}
          // The field exists because the user just asked for it: anything else
          // costs a second click to reach what they already chose.
          autoFocus
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
      </label>
      <button type="submit" disabled={empty || pending} aria-busy={pending}>
        {pending ? "Working…" : submitLabel}
      </button>
      <button type="button" className="ghost" onClick={onCancel}>
        Cancel
      </button>
    </form>
  );
}
