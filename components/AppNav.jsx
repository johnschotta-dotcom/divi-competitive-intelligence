import Link from 'next/link';

const NAV_CSS = `
.divi-topbar {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(12, 12, 12, 0.88);
  border-bottom: 1px solid #2a2a2a;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}
.divi-topbar-inner {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 32px;
  min-height: 60px;
  display: flex;
  align-items: center;
  gap: 28px;
}
.divi-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #f5f5f5;
  text-decoration: none;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.02em;
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
  height: 60px;
  padding: 0 1px;
  margin: 0;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #9a9a9a;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: -0.01em;
  text-decoration: none;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
  box-sizing: border-box;
}
.divi-tab:hover { color: #f5f5f5; }
.divi-tab.is-active {
  color: #ffffff;
  font-weight: 600;
  border-bottom-color: #C523A1;
}
.divi-actions {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;
  margin-left: auto;
}
.divi-actions::before {
  content: "";
  width: 1px;
  height: 16px;
  background: #333;
}
.divi-quiet {
  display: inline-flex;
  align-items: center;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: #8a8a8a;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: -0.01em;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
}
.divi-quiet:hover { color: #f5f5f5; }
.divi-quiet:disabled {
  opacity: 0.45;
  cursor: default;
}
.divi-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #C523A1;
  color: #fff;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13.5px;
  font-weight: 600;
  letter-spacing: -0.01em;
  cursor: pointer;
  text-decoration: none;
  white-space: nowrap;
  font-family: inherit;
  line-height: 1.2;
}
.divi-cta:hover { background: #d12aab; }
@media (max-width: 820px) {
  .divi-topbar-inner {
    flex-wrap: wrap;
    padding: 0 20px 8px;
    gap: 8px 16px;
  }
  .divi-tabs { order: 3; width: 100%; gap: 16px; }
  .divi-tab, .divi-tab.is-active { height: 42px; }
  .divi-actions { margin-left: 0; }
  .divi-actions::before { display: none; }
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
          <span>Divi Intelligence</span>
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
