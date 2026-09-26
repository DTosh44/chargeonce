import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
} from "react";
import type { ChargerStatus } from "@/domain/types";

export const buttonStyles = (
  variant: "primary" | "secondary" | "quiet" = "primary",
) => `button button-${variant}`;

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "quiet";
}) {
  return (
    <button className={`${buttonStyles(variant)} ${className}`} {...props} />
  );
}

export function Card({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={`card ${className}`} {...props} />;
}

export function Badge({
  tone = "blue",
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: "blue" | "green" | "amber" | "slate";
}) {
  return <span className={`badge badge-${tone} ${className}`} {...props} />;
}

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`field ${className}`} {...props} />;
}

export function Select({
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`field select ${className}`} {...props} />;
}

export function Tabs<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="tabs" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={option === value}
          className={option === value ? "tab active" : "tab"}
          onClick={() => onChange(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export function Progress({ value, label }: { value: number; label: string }) {
  return (
    <div
      className="progress-track"
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: `${Math.max(0, Math.min(value, 100))}%` }} />
    </div>
  );
}

export function StatusBadge({ status }: { status: ChargerStatus }) {
  return (
    <Badge
      tone={
        status === "Available" ? "green" : status === "Busy" ? "amber" : "slate"
      }
    >
      <span className="status-dot" />
      {status}
    </Badge>
  );
}

export function Metric({
  label,
  value,
  detail,
  prominent = false,
}: {
  label: string;
  value: string;
  detail?: string;
  prominent?: boolean;
}) {
  return (
    <div className={prominent ? "metric prominent" : "metric"}>
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="page-heading">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  );
}
