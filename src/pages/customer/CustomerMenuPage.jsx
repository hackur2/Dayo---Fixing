import { useState } from "react";
import { Link } from "react-router";

import { CUSTOMER_ROUTES } from "../../constants/routes";

import TopHeader from "../../components/layout/TopHeader";
import FloatingBagButton from "../../components/layout/FloatingBagButton";
import BottomCheckoutBar from "../../components/layout/BottomCheckoutBar";
import CollapsibleCategorySidebar from "../../components/layout/CollapsibleCategorySidebar";

import MenuCard from "../../components/menu/MenuCard";
import SubCategoryTabs from "../../components/menu/SubCategoryTabs";
import ItemDetailsModal from "../../components/menu/ItemDetailsModal";
import PromoBannerCard from "../../components/menu/PromoBannerCard";
import SearchBar from "../../components/menu/SearchBar";
import CustomerAiAssistant from "../../components/customer/CustomerAiAssistant";

import EmptyState from "../../components/common/EmptyState";
import LoadingState from "../../components/common/LoadingState";
import AlertMessage from "../../components/common/AlertMessage";

import { useMenuItems } from "../../hooks/useMenuItems";
import { usePromoItem } from "../../hooks/usePromoItem";


import {
  getCartItemCount,
  getCartTotal,
  getItemQuantity,
} from "../../utils/cartUtils";

import "../../styles/customerMenu.css";

const ALL_ITEMS_PAGE_SIZE = 15;
// Ads stay dismissed for this browser tab, even when navigating away and back.
const DISMISSED_PROMOS_KEY = "dayo_dismissed_promo_ids";

function readDismissedPromoIds() {
  try {
    const savedIds = JSON.parse(sessionStorage.getItem(DISMISSED_PROMOS_KEY) || "[]");
    return Array.isArray(savedIds) ? savedIds.map(String) : [];
  } catch {
    return [];
  }
}

function CustomerMenuPage({ cartItems, currentOrder, onAddToCart, onDecreaseQuantity }) {
  const [activeMainCategory, setActiveMainCategory] = useState("All");
  const [activeSubCategory, setActiveSubCategory] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [dismissedPromoIds, setDismissedPromoIds] = useState(readDismissedPromoIds);

  const { menuItems, expiringIngredientContext, isLoading, errorMessage } = useMenuItems();
  const { promoItem } = usePromoItem();

  const cartItemCount = getCartItemCount(cartItems);
  const cartTotal = getCartTotal(cartItems);
  // Featured items are the menu's manually selected trending items. Keep them
  // at the top in every category (and on the first All page) to reduce scrolling.
  const availableMenuItems = menuItems
    .filter((item) => item.isAvailable && Number(item.available) > 0)
    .map((item, index) => ({ item, index }))
    .sort((a, b) => Number(Boolean(b.item.isFeatured)) - Number(Boolean(a.item.isFeatured)) || a.index - b.index)
    .map(({ item }) => item);

  const mainCategories = ["All", ...new Set(availableMenuItems.map((item) => item.mainCategory).filter(Boolean))];
  const currentSubCategories = [...new Set(availableMenuItems
    .filter((item) => activeMainCategory === "All" || item.mainCategory === activeMainCategory)
    .map((item) => item.subCategory)
    .filter(Boolean))];
  const subCategories = Object.fromEntries(mainCategories
    .filter((category) => category !== "All")
    .map((category) => [category, [...new Set(availableMenuItems
      .filter((item) => item.mainCategory === category)
      .map((item) => item.subCategory)
      .filter(Boolean))]]));

  const filteredMenuItems = availableMenuItems.filter((item) => {
    const searchValue = searchTerm.trim().toLowerCase();

    const matchesSearch =
      searchValue === "" ||
      item.name.toLowerCase().includes(searchValue) ||
      item.brand.toLowerCase().includes(searchValue) ||
      item.subCategory.toLowerCase().includes(searchValue);

    const matchesMainCategory =
      activeMainCategory === "All" || item.mainCategory === activeMainCategory;

    const matchesSubCategory =
      activeSubCategory === "" || item.subCategory === activeSubCategory;

    return matchesSearch && matchesMainCategory && matchesSubCategory;
  });

  const shouldPaginate = activeMainCategory === "All";
  const totalPages = shouldPaginate
    ? Math.max(1, Math.ceil(filteredMenuItems.length / ALL_ITEMS_PAGE_SIZE))
    : 1;
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * ALL_ITEMS_PAGE_SIZE;
  const visibleMenuItems = shouldPaginate
    ? filteredMenuItems.slice(
        pageStartIndex,
        pageStartIndex + ALL_ITEMS_PAGE_SIZE
      )
    : filteredMenuItems;

  const pageTitle = activeSubCategory || activeMainCategory;

  function handleMainCategoryChange(category) {
    setActiveMainCategory(category);
    setActiveSubCategory("");
    setSelectedItem(null);
    setCurrentPage(1);
  }

  function handleSubCategoryChange(subCategory) {
    setActiveSubCategory(subCategory);
    setSelectedItem(null);
    setCurrentPage(1);
  }

  function handleSearchChange(value) {
    setSearchTerm(value);
    setCurrentPage(1);
  }

  function handlePageChange(pageNumber) {
    setCurrentPage(pageNumber);

    document.querySelector(".menu-section-heading")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function handleOpenDetails(item) {
    setSelectedItem(item);
  }

  function handleDismissPromo(item) {
    const nextIds = [...new Set([...dismissedPromoIds, String(item.id)])];
    setDismissedPromoIds(nextIds);

    try {
      sessionStorage.setItem(DISMISSED_PROMOS_KEY, JSON.stringify(nextIds));
    } catch {
      // The close button still works even if browser storage is unavailable.
    }
  }

  function handleCloseDetails() {
    setSelectedItem(null);
  }

  return (
    <div className="app-shell">

      <TopHeader onOpenMenu={() => setIsSidebarOpen(true)} />

      <FloatingBagButton cartItemCount={cartItemCount} />
      <CustomerAiAssistant
        menuItems={availableMenuItems}
        expiringIngredientContext={expiringIngredientContext}
        cartItems={cartItems}
        onAddToCart={onAddToCart}
        itemDetailsOpen={Boolean(selectedItem)}
      />

      <CollapsibleCategorySidebar
        isOpen={isSidebarOpen}
        categories={mainCategories}
        subCategories={subCategories}
        activeMainCategory={activeMainCategory}
        activeSubCategory={activeSubCategory}
        onSelectMainCategory={handleMainCategoryChange}
        onSelectSubCategory={handleSubCategoryChange}
        onClose={() => setIsSidebarOpen(false)}
      />

      <main className="menu-content">
        <SearchBar value={searchTerm} onChange={handleSearchChange} />

        {currentOrder && (
          <section className="active-order-card">
            <span>Order History</span>

            <div className="active-order-actions">
              <Link to={CUSTOMER_ROUTES.ORDER_STATUS}>View Order History</Link>
            </div>
          </section>
        )}

        {promoItem && promoItem.isAvailable && Number(promoItem.available) > 0 && !dismissedPromoIds.includes(String(promoItem.id)) && (
          <PromoBannerCard
            item={promoItem}
            onOpenDetails={handleOpenDetails}
            onDismiss={handleDismissPromo}
          />
        )}

        <SubCategoryTabs
          subCategoryList={currentSubCategories}
          activeSubCategory={activeSubCategory}
          onSubCategoryChange={handleSubCategoryChange}
        />

        <div className="menu-section-heading">
          <div>
            <h2>{pageTitle}</h2>
            <p>
              {shouldPaginate && filteredMenuItems.length > 0
                ? `${pageStartIndex + 1}-${Math.min(
                    pageStartIndex + ALL_ITEMS_PAGE_SIZE,
                    filteredMenuItems.length
                  )} of ${filteredMenuItems.length} items`
                : `${filteredMenuItems.length} items`}
            </p>
          </div>

          <div className="menu-section-actions">
            <button type="button" onClick={() => setIsSidebarOpen(true)}>
              Filter
            </button>
          </div>
        </div>

        <AlertMessage message={errorMessage} type="info" />

        {isLoading ? (
          <LoadingState message="Loading menu items..." />
        ) : filteredMenuItems.length > 0 ? (
          <section className="menu-list">
            {visibleMenuItems.map((item, index) => (
              <MenuCard
                key={item.id}
                item={item}
                onOpenDetails={handleOpenDetails}
                onAddToCart={onAddToCart}
                quantityInCart={getItemQuantity(cartItems, item.id)}
                cartIdInCart={cartItems.find((cartItem) => cartItem.id === item.id)?.cartId}
                onDecreaseFromCart={onDecreaseQuantity}
                imageLoading={index < 2 ? "eager" : "lazy"}
              />
            ))}
          </section>
        ) : (
          <EmptyState
            title="No menu items found"
            message="Try another category or search keyword."
          />
        )}

          {shouldPaginate && totalPages > 1 && (
            <nav className="menu-pagination" aria-label="Menu pages">
              <button
                type="button"
                className="menu-pagination-arrow"
                onClick={() => handlePageChange(safeCurrentPage - 1)}
                disabled={safeCurrentPage === 1}
              >
                Previous
              </button>

              <div className="menu-pagination-pages">
                {Array.from({ length: totalPages }, (_, index) => {
                  const pageNumber = index + 1;

                  return (
                    <button
                      key={pageNumber}
                      type="button"
                      className={
                        safeCurrentPage === pageNumber
                          ? "menu-pagination-page active"
                          : "menu-pagination-page"
                      }
                      onClick={() => handlePageChange(pageNumber)}
                      aria-current={
                        safeCurrentPage === pageNumber ? "page" : undefined
                      }
                    >
                      {pageNumber}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                className="menu-pagination-arrow"
                onClick={() => handlePageChange(safeCurrentPage + 1)}
                disabled={safeCurrentPage === totalPages}
              >
                Next
              </button>
            </nav>
          )}
      </main>

      <BottomCheckoutBar cartItemCount={cartItemCount} cartTotal={cartTotal} />

      <ItemDetailsModal
        item={selectedItem}
        cartItems={cartItems}
        onClose={handleCloseDetails}
        onAddToCart={onAddToCart}
      />
    </div>

    
  );
}

export default CustomerMenuPage;
