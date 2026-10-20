function TopHeader({ onOpenMenu }) {
  return (
    <header className="top-header">
      <button
        type="button"
        className="top-menu-button"
        onClick={onOpenMenu}
        aria-label="Open categories"
      >
        ☰
      </button>

      <div className="top-header-brand">
        <h1>DaYo!</h1>
        <p>DADDYOW &amp; YO CÀPHÊ</p>
      </div>
    </header>
  );
}

export default TopHeader;