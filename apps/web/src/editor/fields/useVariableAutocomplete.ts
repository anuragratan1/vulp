import { useState, useCallback, useEffect } from 'react';
import {
  DiscoveredVariable,
  StepVariableGroup,
} from './dynamicVariableDiscovery.js';

export interface UseVariableAutocompleteOptions {
  groups: StepVariableGroup[];
}

export function useVariableAutocomplete({
  groups,
}: UseVariableAutocompleteOptions) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [coords, setCoords] = useState<{ top: number; left: number; bottom?: number; elementTop?: number }>({
    top: 0,
    left: 0,
  });
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Flattened matching items for keyboard navigation count
  const matchingVariables = useCallback(
    (q: string) => {
      const clean = q.trim().toLowerCase();
      const list: DiscoveredVariable[] = [];
      for (const group of groups) {
        for (const v of group.variables) {
          if (
            !clean ||
            v.label.toLowerCase().includes(clean) ||
            v.path.toLowerCase().includes(clean) ||
            v.nodeKey.toLowerCase().includes(clean) ||
            v.stepName.toLowerCase().includes(clean)
          ) {
            list.push(v);
          }
        }
      }
      return list;
    },
    [groups]
  );

  const flatList = matchingVariables(query);

  // Keep selected index within bounds when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    setQuery('');
  }, []);

  return {
    isOpen,
    setIsOpen,
    query,
    setQuery,
    coords,
    setCoords,
    selectedIndex,
    setSelectedIndex,
    flatList,
    closeMenu,
  };
}
