import MenuItemImage from "../common/MenuItemImage";
import { getItemDisplayPrice } from "../../utils/cartUtils";

function PromoBannerCard({ item, onOpenDetails, onDismiss }) {
  if (!item) {
    return null;
  }

  const fallbackText = item.name.charAt(0).toUpperCase();

  return (
    <section className="promo-banner-card" aria-label="Featured menu item">
      <button
        type="button"
        className="promo-banner-action"
        onClick={() => onOpenDetails(item)}
        aria-label={`View ${item.name} details`}
      >
        <div className="promo-copy">
          <span>Try it now!</span>
          <h2>{item.name}</h2>
          <p>{getItemDisplayPrice(item)}</p>
        </div>

        <MenuItemImage
          src={item.imageUrl}
          alt={item.name}
          fallbackText={fallbackText}
          className="promo-image"
          loading="eager"
        />
      </button>

      <button
        type="button"
        className="promo-banner-close"
        onClick={() => onDismiss(item)}
        aria-label={`Close advertisement for ${item.name}`}
        title="Close advertisement"
      >
        <span aria-hidden="true" className="promo-close-icon" />
      </button>
    </section>
  );
}

export default PromoBannerCard;
