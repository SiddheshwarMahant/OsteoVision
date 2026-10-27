import { useEffect } from "react";

const Icon = ({ name }) => {
  const paths = {
    fullscreen: <><path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5" /></>,
    reset: <><path d="M3 11a9 9 0 1 0 2.7-6.4L3 7" /><path d="M3 3v4h4M12 7v5l3 2" /></>,
    rotate: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.5 9a7 7 0 0 1 11.6-2L20 12M4 12l2.9 5a7 7 0 0 0 11.6-2" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></>
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
};

function ViewerActions() {
  return (
    <div className="viewer-actions" aria-label="Viewer controls">
      <button id="autoRotateToggle" className="tool-button" aria-pressed="false" title="Toggle automatic rotation">
        <Icon name="rotate" /><span>Auto rotate</span>
      </button>
      <button id="resetView" className="tool-button" title="Reset camera view"><Icon name="reset" /><span>Reset view</span></button>
      <button id="fullscreenToggle" className="tool-button" title="Toggle fullscreen (F)" aria-label="Toggle fullscreen">
        <Icon name="fullscreen" /><span id="fullscreenLabel">Fullscreen</span><span id="fullscreenIcon" hidden />
      </button>
    </div>
  );
}

function Viewer() {
  return (
    <section className="viewer-panel" aria-labelledby="viewerTitle">
      <div className="viewer-heading">
        <div className="viewer-title"><span className="eyebrow">SKELETAL SYSTEM <span className="heading-divider">·</span> INTERACTIVE VIEW</span><h2 id="viewerTitle">Human skeleton</h2></div>
        <ViewerActions />
      </div>
      <div id="viewer">
        <div id="boneTooltip" className="bone-tooltip" role="tooltip" hidden />
        <div id="loading" className="message-card"><div className="spinner" /><h3>Loading skeleton</h3><p id="loadingText">Preparing the 3D model…</p></div>
        <div id="error" className="message-card error-card" hidden><h3>Unable to load the model</h3><p id="errorText" /></div>
      </div>
      <div className="viewer-caption"><span>Drag to rotate <i /> Scroll to zoom <i /> Right click to reset</span><span className="caption-code">OSTEOVISION&nbsp; / &nbsp;01</span></div>
    </section>
  );
}

function InfoPanel() {
  return (
    <aside className="info-panel" aria-label="Anatomy navigation and selected structure">
      <section className="navigator-section" aria-labelledby="navigatorTitle">
        <div className="section-heading"><div><p className="eyebrow">ANATOMICAL INDEX</p><h2 id="navigatorTitle">Skeletal structures</h2></div><span id="searchResultCount" className="result-count" aria-live="polite">Loading</span></div>
        <label className="search-field"><Icon name="search" /><span className="sr-only">Search bones</span><input id="boneSearch" type="search" placeholder="Search structures…" autoComplete="off" /></label>
        <div id="boneSearchResults" className="bone-search-results" aria-label="Bones" />
      </section>
      <section className="structure-panel" aria-live="polite">
        <div className="section-heading compact-heading"><div><p className="eyebrow">SELECTED STRUCTURE</p><h2>Anatomical reference</h2></div><span className="selection-mark" aria-hidden="true" /></div>
        <div id="boneInfo" className="bone-info" hidden>
          <h3 id="selectedName">No bone selected</h3><p id="boneDescription" className="bone-description" />
        </div>
        <div id="boneInfoEmpty" className="empty-selection"><span className="empty-mark" aria-hidden="true">+</span><p>Select a bone in the viewer or choose one from the structure index.</p></div>
      </section>
      <p className="footer-note">OSTEOVISION <span>·</span> SKELETAL ANATOMY</p>
    </aside>
  );
}

export default function App() {
  useEffect(() => { import("../app.js"); }, []);
  return <><header className="topbar">
    <div className="brand"><div className="brand-icon" aria-hidden="true"><svg viewBox="0 0 28 28" fill="none"><path d="M9 5.5a3.3 3.3 0 1 0-3.5 5.4v6.2A3.3 3.3 0 1 0 9 22.5h10a3.3 3.3 0 1 0 3.5-5.4v-6.2A3.3 3.3 0 1 0 19 5.5H9Z" stroke="currentColor" strokeWidth="1.6"/><path d="M10 8h8M10 20h8" stroke="currentColor" strokeWidth="1.4"/></svg></div><div><h1>OsteoVision</h1><p>SKELETAL ANATOMY ATLAS</p></div></div>
    <div className="header-status"><span className="status-label">MODEL STATUS</span><span className="status-separator" /><span id="modelStatus" className="status-indicator model-status" data-state="loading"><i className="status-dot" /> <span id="modelStatusText">Loading model</span></span></div>
  </header><main className="workspace"><Viewer /><InfoPanel /></main></>;
}
