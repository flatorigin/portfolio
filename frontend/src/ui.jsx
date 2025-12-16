// =======================================
// file: frontend/src/ui.jsx
// Small, reusable building blocks
// =======================================

export function Container({ className = "", ...props }) {
  return <div {...props} className={"mx-auto w-full max-w-5xl px-4 " + className} />;
}

export function SectionTitle({ children, className = "", ...props }) {
  return (
    <h2 {...props} className={"mb-4 text-2xl font-bold tracking-tight text-slate-900 " + className}>
      {children}
    </h2>
  );
}

export function Input(props) {
  return (
    <input
      {...props}
      className={
        "w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 " +
        (props.className || "")
      }
    />
  );
}

export function Textarea(props) {
  return (
    <textarea
      {...props}
      className={
        "w-full min-h-32 rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 " +
        (props.className || "")
      }
    />
  );
}

export function Button({ className = "",as: Component = "button", ...props }) {
  return (
    <Component
      {...props}
      className={
        "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium " +
        "bg-slate-900 text-white hover:opacity-90 disabled:opacity-60 " +
        className
      }
    />
  );
}

export function GhostButton({ className = "", as:Component = "button", ...props }) {
  return (
    <Component
      {...props}
      className={
        "inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white " +
        "px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 " +
        className
      }
    />
  );
}

export function Badge({ children, className = "", ...props }) {
  return (
    <span
      {...props}
      className={
        "inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-700 " +
        className
      }
    >
      {children}
    </span>
  );
}

export function Card({ className = "", ...props }) {
  return (
    <div
      {...props}
      className={
        "rounded-2xl border border-slate-200 bg-white shadow-sm " +
        className
      }
    />
  );
}