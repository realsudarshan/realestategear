import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges conditional class names using clsx and resolves
 * conflicting Tailwind CSS utility classes with tailwind-merge.
 */
export function cn(...classInputs: ClassValue[]): string {
  return twMerge(clsx(classInputs));
}
