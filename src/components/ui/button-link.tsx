import type { ReactNode } from "react";

type ButtonLinkProps = {
  href: string;
  children: ReactNode;
};

export function ButtonLink({ href, children }: ButtonLinkProps) {
  return (
    <a className="button-link" href={href}>
      <span>{children}</span>
      <span className="button-link__arrow" aria-hidden="true">
        ↘
      </span>
    </a>
  );
}
