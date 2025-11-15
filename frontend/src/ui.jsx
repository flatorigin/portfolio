// file: src/ui.jsx
// Minimal class merge (avoids trailing spaces)
const cx = (...xs) => xs.filter(Boolean).join(" ");

export function Input({ className = "", ...props }) {
  // keep focus ring strong so it's noticeable
  return (
    <input
      {...props}
      className={cx(
        "w-full rounded-xl border border-slate-300 px-3 py-2",
        "focus:outline-none focus:ring-2 focus:ring-blue-500",
        className
      )}
    />
  );
}

export function Textarea({ className = "", ...props }) {
  return (
    <textarea
      {...props}
      className={cx(
        "w-full rounded-xl border border-slate-300 px-3 py-2",
        "min-h-[8rem]", // v4: arbitrary value; `min-h-32` is not a core class
        "focus:outline-none focus:ring-2 focus:ring-blue-500",
        className
      )}
    />
  );
}

export function Button({ className = "", type = "button", ...props }) {
  // type default prevents accidental form submissions
  return (
    <button
      {...props}
      type={type}
      className={cx(
        "inline-flex items-center rounded-xl px-4 py-2",
        "bg-gray-400 text-white hover:bg-blue-700",
        "disabled:opacity-60",
        className
      )}
    />
  );
}

export function Card({ className = "", ...props }) {
  return (
    <div
      {...props}
      className={cx(
        "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm",
        className
      )}
    />
  );
}
