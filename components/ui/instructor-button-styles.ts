import clsx from "clsx";

const sharedActionButtonClass = [
  "font-medium",
  "disabled:cursor-not-allowed",
  "disabled:opacity-100",
  "disabled:shadow-none",
  "data-[disabled=true]:cursor-not-allowed",
  "data-[disabled=true]:opacity-100",
  "data-[disabled=true]:shadow-none",
].join(" ");

export function instructorPrimaryButtonClass(className?: string) {
  return clsx(
    sharedActionButtonClass,
    "bg-linear-to-r from-blue-400 to-indigo-500 text-white shadow-lg shadow-blue-500/25",
    "data-[hover=true]:from-blue-500 data-[hover=true]:to-indigo-600",
    "disabled:from-blue-200 disabled:to-indigo-200 disabled:text-white/90",
    "data-[disabled=true]:from-blue-200 data-[disabled=true]:to-indigo-200 data-[disabled=true]:text-white/90",
    className,
  );
}

export function instructorFlatButtonClass(className?: string) {
  return clsx(
    sharedActionButtonClass,
    "disabled:border-default-200 disabled:bg-default-100 disabled:text-default-400",
    "data-[disabled=true]:border-default-200 data-[disabled=true]:bg-default-100 data-[disabled=true]:text-default-400",
    className,
  );
}

export function instructorLightButtonClass(className?: string) {
  return clsx(
    "font-medium disabled:opacity-100 data-[disabled=true]:opacity-100",
    "disabled:text-default-400 data-[disabled=true]:text-default-400",
    className,
  );
}