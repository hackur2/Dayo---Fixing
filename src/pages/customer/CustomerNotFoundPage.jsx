import CustomerPageLayout from "../../components/layout/CustomerPageLayout";
import EmptyState from "../../components/common/EmptyState";

import { CUSTOMER_ROUTES } from "../../constants/routes";

function CustomerNotFoundPage() {
  return (
    <CustomerPageLayout>
      <EmptyState
        title="Page Not Found"
        message="The page you are looking for does not exist."
        actionLabel="Back to Menu"
        actionTo={CUSTOMER_ROUTES.MENU}
      />
    </CustomerPageLayout>
  );
}

export default CustomerNotFoundPage;