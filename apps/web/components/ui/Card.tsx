import clsx from "clsx";

export const UICard = ({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) => <section className={clsx("surface rounded-xl", className)}>{children}</section>;

