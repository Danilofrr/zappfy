import { useEffect, useState } from "react";

/**
 * Retorna o valor apenas depois que o usuário para de digitar (padrão 350ms).
 * Evita refiltrar/re-renderizar listas grandes a cada tecla.
 */
export function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debounced;
}
