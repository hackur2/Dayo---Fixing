import { useEffect, useState } from "react";

import { promoService } from "../services/promoService";
import { normalizeMenuItem } from "../adapters/menuAdapter";

export function usePromoItem() {
  const [promoItem, setPromoItem] = useState(null);
  const [isPromoLoading, setIsPromoLoading] = useState(false);

  useEffect(() => {
    async function loadPromoItem() {
      try {
        setIsPromoLoading(true);

        const data = await promoService.getActivePromotionItem();
        const normalizedPromoItem = data ? normalizeMenuItem(data) : null;

        setPromoItem(normalizedPromoItem);
      } catch (error) {
        console.error("Unable to load promo item:", error.message);
        setPromoItem(null);
      } finally {
        setIsPromoLoading(false);
      }
    }

    loadPromoItem();
  }, []);

  return {
    promoItem,
    isPromoLoading,
  };
}
