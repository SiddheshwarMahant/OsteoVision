import { useEffect } from "react";

function ViewerActions() {
  return (
    <div className="viewer-actions">
      <button id="fullscreenToggle" className="secondary-button" title="Toggle fullscreen (F)">
        <span id="fullscreenIcon">⛶</span>
        <span id="fullscreenLabel">Fullscreen</span>
      </button>
      <button id="resetView" className="secondary-button">Reset View</button>
      <button id="autoRotateToggle" className="secondary-button" aria-pressed="false" title="Slowly rotate the model">
        <span aria-hidden="true">↻</span> Auto rotate
      </button>
    </div>
  );
}

function Viewer() {
  return (
    <section className="viewer-panel">
      <div className="viewer-heading">
        <div><p className="eyebrow">3D WORKSPACE</p><h2>Human Skeleton</h2></div>
        <ViewerActions />
      </div>
      <div id="viewer">
        <div className="anatomy-atmosphere" aria-hidden="true">
          <svg className="ambient-bone ambient-bone-one" viewBox="0 0 120 34"><path d="M13 9c-4-5-11 1-7 6-3 6 4 11 9 6l90-2c5 5 12 0 8-6 3-5-4-11-9-6z" /></svg>
          <svg className="ambient-bone ambient-bone-two" viewBox="0 0 120 34"><path d="M13 9c-4-5-11 1-7 6-3 6 4 11 9 6l90-2c5 5 12 0 8-6 3-5-4-11-9-6z" /></svg>
          <span className="ambient-node node-one" /><span className="ambient-node node-two" />
          <span className="ambient-node node-three" /><span className="ambient-cross">＋</span>
        </div>
        <div id="boneTooltip" className="bone-tooltip" role="tooltip" hidden />
        <div id="loading" className="message-card">
          <div className="spinner" />
          <h3>Loading skeleton</h3>
          <p id="loadingText">Preparing your 3D model...</p>
        </div>
        <div id="error" className="message-card error-card" hidden>
          <h3>Unable to load the model</h3><p id="errorText" />
        </div>
        <section id="boneInfo" className="bone-info" hidden aria-live="polite">
          <p className="eyebrow">SELECTED STRUCTURE</p>
          <h3 id="selectedName">No bone selected</h3>
          <p id="boneDescription" className="bone-description" />
        </section>
      </div>
    </section>
  );
}

function InfoPanel() {
  return (
    <aside className="info-panel">
      <p className="eyebrow">MODEL INFORMATION</p>
      <h2>Your Anatomy Model</h2>
      <p className="description">Explore individual bones of the human skeletal system. Select a bone to inspect it.</p>
      <section className="navigator-section" aria-labelledby="navigatorTitle">
        <div className="navigator-heading">
          <p className="eyebrow" id="navigatorTitle">ALL BONES</p>
          <span id="searchResultCount" className="result-count" aria-live="polite">Search the model</span>
        </div>
        <label className="sr-only" htmlFor="boneSearch">Search bones</label>
        <input id="boneSearch" type="search" placeholder="Try “femur” or “rib”…" autoComplete="off" />
        <div id="boneSearchResults" className="bone-search-results" />
      </section>
      <p className="footer-note">OsteoVision · Community Engagement Project</p>
    </aside>
  );
}

export default function App() {
  useEffect(() => {
    import("../app.js");
  }, []);

  return (
    <>
      <header className="topbar">
        <div className="brand"><div className="brand-icon">O</div><div><h1>OsteoVision</h1><p>INTERACTIVE ANATOMY EXPLORER</p></div></div>
        <div className="header-status"><span className="status-dot" />LOCAL 3D VIEWER</div>
      </header>
      <main className="workspace"><Viewer /><InfoPanel /></main>
    </>
  );
}
