/**
 * WorkspaceNav.jsx
 * -----------------
 * Section buttons for the video workspace (a sidebar on desktop, a
 * scrollable row on small screens).
 */

function WorkspaceNav({ tabs, active, onChange }) {
  return (
    <nav className="workspace-nav" aria-label="Sections">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`nav-button${active === tab.id ? " nav-button--active" : ""}`}
          aria-current={active === tab.id ? "page" : undefined}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

export default WorkspaceNav;