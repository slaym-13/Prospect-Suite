/** Join class names, dropping anything falsy. */
export const cn = (...parts) => parts.filter(Boolean).join(' ');
