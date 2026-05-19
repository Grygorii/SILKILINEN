'use client';

import { createContext, useContext, useState } from 'react';

type Ctx = {
  selectedColour: string;
  setSelectedColour: (c: string) => void;
  selectedSize: string;
  setSelectedSize: (s: string) => void;
  qty: number;
  setQty: (q: number | ((prev: number) => number)) => void;
};

const SelectionCtx = createContext<Ctx | null>(null);

export function ProductSelectionProvider({
  children,
  defaultColour = '',
  defaultSize = '',
}: {
  children: React.ReactNode;
  defaultColour?: string;
  defaultSize?: string;
}) {
  const [selectedColour, setSelectedColour] = useState(defaultColour);
  const [selectedSize, setSelectedSize] = useState(defaultSize);
  const [qty, setQty] = useState(1);
  return (
    <SelectionCtx.Provider value={{ selectedColour, setSelectedColour, selectedSize, setSelectedSize, qty, setQty }}>
      {children}
    </SelectionCtx.Provider>
  );
}

export function useProductSelection() {
  const ctx = useContext(SelectionCtx);
  if (!ctx) throw new Error('useProductSelection must be inside ProductSelectionProvider');
  return ctx;
}
