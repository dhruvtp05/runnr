import type { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export default function FormSection({ title, description, children, className = "" }: Props) {
  return (
    <section className={`form-section ${className}`.trim()}>
      <div className="form-section-header">
        <h3 className="form-section-title">{title}</h3>
        {description ? <p className="form-section-desc">{description}</p> : null}
      </div>
      <div className="form-section-body">{children}</div>
    </section>
  );
}
