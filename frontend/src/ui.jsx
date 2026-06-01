// =======================================
// file: frontend/src/ui.jsx
// Small, reusable building blocks
// =======================================
import { useState } from "react";

export function Container({ className = "", ...props }) {
  return <div {...props} className={"mx-auto w-full max-w-5xl px-4 " + className} />;
}

export function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

export function SectionTitle({ children, className = "", ...props }) {
  return (
    <h2 {...props} className={"mb-0 text-2xl font-semibold tracking-tight text-slate-950 " + className}>
      {children}
    </h2>
  );
}

export function SymbolIcon({
  name,
  className = "",
  fill = 0,
  weight = 400,
  grade = 0,
  opticalSize = 24,
  style,
  ...props
}) {
  return (
    <span
      aria-hidden="true"
      {...props}
      className={"material-symbols-rounded " + className}
      style={{
        fontVariationSettings: `"FILL" ${fill}, "wght" ${weight}, "GRAD" ${grade}, "opsz" ${opticalSize}`,
        ...style,
      }}
    >
      {name}
    </span>
  );
}

export function Input(props) {
  const { className = "", ...rest } = props;
  return (
    <input
      {...rest}
      className={
        "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs transition " +
        "placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60 " +
        className
      }
    />
  );
}

export function Select({ className = "", children, ...props }) {
  return (
    <select
      {...props}
      className={
        "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs transition " +
        "focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60 " +
        className
      }
    >
      {children}
    </select>
  );
}

export function PasswordInput({ className = "", onChange, onKeyDown, ...props }) {
  const [visible, setVisible] = useState(false);
  const [hasTyped, setHasTyped] = useState(false);
  const showToggle = hasTyped && !!props.value;

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        onKeyDown={(e) => {
          setHasTyped(true);
          onKeyDown?.(e);
        }}
        onChange={(e) => {
          if (!e.target.value) {
            setVisible(false);
            setHasTyped(false);
          }
          onChange?.(e);
        }}
        className={
          "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs transition " +
          "placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60 " +
          (showToggle ? "pr-11 " : "") +
          className
        }
      />

      {showToggle ? (
        <button
          type="button"
          onClick={() => setVisible((prev) => !prev)}
          className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          <SymbolIcon name={visible ? "visibility_off" : "visibility"} className="text-[20px]" />
        </button>
      ) : null}
    </div>
  );
}

export function Textarea(props) {
  const { className = "", ...rest } = props;
  return (
    <textarea
      {...rest}
      className={
        "w-full min-h-32 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs transition " +
        "placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60 " +
        className
      }
    />
  );
}

export function Button({ className = "", ...props }) {
  return (
    <button
      {...props}
      className={
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium shadow-xs transition " +
        "bg-slate-950 text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:pointer-events-none disabled:opacity-60 " +
        className
      }
    />
  );
}

export function GhostButton({ className = "", ...props }) {
  return (
    <button
      {...props}
      className={
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-xs transition " +
        "hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200 disabled:pointer-events-none disabled:opacity-60 " +
        className
      }
    />
  );
}

export function Badge({ children, className = "", ...props }) {
  const hasCustomBg = /\b(?:!?)bg-[^\s]+/.test(className);
  const hasCustomText = /\b(?:!?)text-[^\s]+/.test(className);
  const hasCustomBorder = /\b(?:!?)border-[^\s]+/.test(className);

  return (
    <span
      {...props}
      className={
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs " +
        (hasCustomBorder ? "" : "border-slate-200 ") +
        (hasCustomBg ? "" : "bg-slate-100 ") +
        (hasCustomText ? "" : "font-medium text-slate-700 ") +
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
        "rounded-xl border border-slate-200/90 bg-white shadow-sm " +
        className
      }
    />
  );
}

export function CardHeader({ className = "", ...props }) {
  return <div {...props} className={"border-b border-slate-100 px-5 py-4 sm:px-6 " + className} />;
}

export function CardContent({ className = "", ...props }) {
  return <div {...props} className={"px-5 py-4 sm:px-6 " + className} />;
}

export function CardFooter({ className = "", ...props }) {
  return <div {...props} className={"border-t border-slate-100 px-5 py-4 sm:px-6 " + className} />;
}

export function PageHeader({
  eyebrow,
  title,
  children,
  actions,
  className = "",
  ...props
}) {
  return (
    <header
      {...props}
      className={
        "rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm sm:p-6 " +
        className
      }
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {eyebrow}
            </p>
          ) : null}
          {title ? (
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              {title}
            </h1>
          ) : null}
          {children ? (
            <div className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {children}
            </div>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function Field({ label, hint, error, children, className = "" }) {
  return (
    <label className={"block " + className}>
      {label ? (
        <span className="mb-1 block text-xs font-semibold text-slate-600">
          {label}
        </span>
      ) : null}
      {children}
      {hint && !error ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : null}
    </label>
  );
}

export function EmptyState({
  icon = "info",
  title,
  children,
  action,
  className = "",
  ...props
}) {
  return (
    <Card
      {...props}
      className={
        "flex min-h-56 flex-col items-center justify-center border-dashed p-6 text-center sm:p-10 " +
        className
      }
    >
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
        <SymbolIcon name={icon} className="text-[24px]" />
      </div>
      {title ? <div className="text-lg font-semibold tracking-tight text-slate-950">{title}</div> : null}
      {children ? <div className="mt-2 max-w-sm text-sm leading-6 text-slate-600">{children}</div> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </Card>
  );
}

export function StickySurface({ className = "", children, ...props }) {
  return (
    <div
      {...props}
      className={
        "sticky top-16 z-20 rounded-xl border border-slate-200/90 bg-white/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/80 " +
        className
      }
    >
      {children}
    </div>
  );
}

export function SegmentedControl({ options = [], value, onChange, className = "" }) {
  return (
    <div className={"inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1 " + className}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange?.(option.value)}
            className={
              "rounded-md px-3 py-1.5 text-sm font-medium transition " +
              (active
                ? "bg-white text-slate-950 shadow-xs"
                : "text-slate-600 hover:text-slate-950")
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
