function SearchBar({ value, onChange }) {
  return (
    <div className="menu-search-bar">
      <span>⌕</span>

      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search menu items"
        aria-label="Search menu items"
      />
    </div>
  );
}

export default SearchBar;