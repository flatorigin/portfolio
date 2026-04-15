// =======================================
// file: frontend/src/ui.jsx
// Small, reusable building blocks
// =======================================
import { useState } from "react";

export function Container({ className = "", ...props }) {
  return <div {...props} className={"mx-auto w-full max-w-5xl px-4 " + className} />;
}

export function SectionTitle({ children, className = "", ...props }) {
  return (
    <h2 {...props} className={"mb-0 text-2xl font-bold tracking-tight text-slate-900 " + className}>
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
          "w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 " +
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

export function Button({ className = "", ...props }) {
  return (
    <button
      {...props}
      className={
        "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium " +
        "bg-slate-900 text-white hover:opacity-90 disabled:opacity-60 " +
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
        "inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white " +
        "px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 " +
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
        (hasCustomBg ? "" : "bg-slate-50 ") +
        (hasCustomText ? "" : "text-slate-700 ") +
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
