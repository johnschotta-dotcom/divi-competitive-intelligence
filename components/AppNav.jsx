import Link from 'next/link';

const NAV_CSS = `
.divi-topbar {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(255, 252, 245, 0.86);
  border-bottom: 1px solid rgba(29, 21, 41, 0.08);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  font-family: Inter, system-ui, sans-serif;
  color: #212121;
}
.divi-topbar-inner {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 32px;
  min-height: 64px;
  display: flex;
  align-items: center;
  gap: 28px;
}
.divi-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #212121;
  text-decoration: none;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  flex-shrink: 0;
}
.divi-brand img {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  object-fit: cover;
  display: block;
}
.divi-tabs {
  display: flex;
  align-items: stretch;
  gap: 22px;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
}
.divi-tab {
  display: inline-flex;
  align-items: center;
  height: 64px;
  padding: 0 1px;
  margin: 0;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #5a5564;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: -0.01em;
  text-decoration: none;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
  box-sizing: border-box;
}
.divi-tab:hover { color: #212121; }
.divi-tab.is-active {
  color: #212121;
  font-weight: 600;
  border-bottom-color: #c523a1;
}
.divi-actions {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;
  margin-left: auto;
}
.divi-quiet {
  display: inline-flex;
  align-items: center;
  margin: 0;
  padding: 8px 4px;
  border: none;
  background: transparent;
  color: #212121;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
}
.divi-quiet:hover { opacity: 0.7; }
.divi-quiet:disabled {
  opacity: 0.4;
  cursor: default;
}
.divi-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #212121;
  color: #fffcf5;
  border: none;
  padding: 10px 22px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  text-decoration: none;
  white-space: nowrap;
  font-family: inherit;
  line-height: 1.2;
}
.divi-cta:hover { background: #000; }
@media (max-width: 820px) {
  .divi-topbar-inner {
    flex-wrap: wrap;
    padding: 0 20px 8px;
    gap: 8px 16px;
  }
  .divi-tabs { order: 3; width: 100%; gap: 16px; }
  .divi-tab, .divi-tab.is-active { height: 42px; }
  .divi-actions { margin-left: 0; }
}
`;

function Tab({ href, active, onClick, children }) {
  const className = `divi-tab${active ? ' is-active' : ''}`;
  if (href) {
    return (
      <Link href={href} className={className} onClick={onClick}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  );
}

export default function AppNav({
  active = 'landscape',
  onHome,
  onScoring,
  onAdd,
  onRunAnalysis,
  analyzing = false,
  analysisLabel = 'Run analysis',
  runDisabled = false,
}) {
  return (
    <header className="divi-topbar">
      <style>{NAV_CSS}</style>
      <div className="divi-topbar-inner">
        <Link href="/" className="divi-brand" onClick={onHome}>
          <img src="/divi-logo.png" alt="" />
          <span>Divi</span>
        </Link>

        <nav className="divi-tabs" aria-label="Primary">
          <Tab href="/" active={active === 'landscape'} onClick={onHome}>
            Landscape
          </Tab>
          <Tab href="/positioning" active={active === 'market'}>
            Positioning
          </Tab>
          <Tab active={active === 'scoring'} onClick={onScoring}>
            Scoring
          </Tab>
        </nav>

        <div className="divi-actions">
          {onRunAnalysis ? (
            <button
              type="button"
              className="divi-quiet"
              onClick={onRunAnalysis}
              disabled={runDisabled}
              title={analyzing ? analysisLabel : 'Analyze each company in its own request'}
            >
              {analysisLabel}
            </button>
          ) : null}
          {onAdd ? (
            <button type="button" className="divi-cta" onClick={onAdd}>
              Add competitor
            </button>
          ) : (
            <Link href="/?add=1" className="divi-cta">
              Add competitor
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
