const shortcuts = [
  ['Space', 'Play / Pause'],
  ['Enter', 'Mark current / selected Cue'],
  ['Backspace', 'Undo last Mark'],
  ['←', 'Previous Cue'],
  ['→', 'Next Cue'],
] as const

export function ShortcutGuide() {
  return (
    <aside className="shortcut-guide" aria-label="Keyboard shortcuts">
      <strong>Keyboard shortcuts</strong>
      <dl>
        {shortcuts.map(([key, description]) => (
          <div key={key}>
            <dt>
              <kbd>{key}</kbd>
            </dt>
            <dd>{description}</dd>
          </div>
        ))}
      </dl>
    </aside>
  )
}
