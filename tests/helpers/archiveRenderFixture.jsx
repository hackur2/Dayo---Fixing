import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import ArchivePage from "../../src/pages/superAdmin/SuperAdminInventoryArchivePage";

export function renderArchiveView(view) {
  return renderToStaticMarkup(<MemoryRouter initialEntries={[`/super-admin/inventory/archive?view=${view}`]}><ArchivePage /></MemoryRouter>);
}
