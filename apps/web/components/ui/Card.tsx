import clsx from "clsx";

export const UICard = ({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) => <section className={clsx("matte-panel rounded-2xl p-5", className)}>{children}</section>;
