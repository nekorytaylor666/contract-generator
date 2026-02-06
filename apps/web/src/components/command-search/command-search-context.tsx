import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

interface CommandSearchContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const CommandSearchContext = createContext<CommandSearchContextValue | null>(
  null
);

export function CommandSearchProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        toggle();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [toggle]);

  const value = useMemo(
    () => ({ isOpen, open, close, toggle }),
    [isOpen, open, close, toggle]
  );

  return (
    <CommandSearchContext.Provider value={value}>
      {children}
    </CommandSearchContext.Provider>
  );
}

export function useCommandSearch() {
  const context = useContext(CommandSearchContext);
  if (!context) {
    throw new Error(
      "useCommandSearch must be used within a CommandSearchProvider"
    );
  }
  return context;
}
