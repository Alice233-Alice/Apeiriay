type SizingProperty = 'height' | 'max-height';
type SavedProperty = { value: string; priority: string; applied: string };
const SIZING_PROPERTIES: SizingProperty[] = ['height', 'max-height'];

// Moving UI scales saved coordinates separately from the native CSS height cap.
// Correct the vertical fit on viewport changes while keeping manual resizing available.
export const createMovingPanelFit = () => {
  let current: { panel: HTMLElement; properties: Map<SizingProperty, SavedProperty> } | null = null;

  const dispose = () => {
    if (!current) return;
    const { style } = current.panel;
    current.properties.forEach((saved, property) => {
      if (style.getPropertyValue(property) !== saved.applied) return;
      if (saved.value) style.setProperty(property, saved.value, saved.priority);
      else style.removeProperty(property);
    });
    current = null;
  };

  const sync = (panel: HTMLElement | null, viewportBottom: number, viewportChanged: boolean) => {
    // Reset clears the inline height; release our cap and leave native layout in charge.
    if (!panel || !panel.style.getPropertyValue('height')) {
      dispose();
      return;
    }
    if (current && current.panel !== panel) dispose();
    if (!viewportChanged) {
      // A subsequent manual drag owns the new size until the viewport changes again.
      if (current && panel.style.getPropertyValue('height') !== current.properties.get('height')?.applied) dispose();
      return;
    }

    const height = viewportBottom - panel.getBoundingClientRect().top;
    if (!Number.isFinite(height) || height <= 0) return;
    current ??= { panel, properties: new Map() };
    const value = `${height}px`;
    SIZING_PROPERTIES.forEach(property => {
      const previous = current!.properties.get(property);
      const actual = panel.style.getPropertyValue(property);
      const saved =
        previous && actual === previous.applied
          ? previous
          : { value: actual, priority: panel.style.getPropertyPriority(property), applied: '' };
      panel.style.setProperty(property, value, saved.priority);
      saved.applied = panel.style.getPropertyValue(property);
      current!.properties.set(property, saved);
    });
  };

  return { sync, dispose };
};
