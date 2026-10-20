import { useState } from "react";
import { getLocalMenuImage } from "../../utils/menuImageUtils";

function MenuItemImage({
  src,
  alt,
  fallbackText = "?",
  className = "",
  loading = "lazy",
}) {
  // Remember the failed URL, so a later image can still load normally.
  const [failedSrc, setFailedSrc] = useState(null);
  const localImage = getLocalMenuImage(alt);
  const imageSrc = src && src !== failedSrc
    ? src
    : localImage && localImage !== failedSrc
      ? localImage
      : "";

  return (
    <div className={`menu-image-wrapper ${className}`}>
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={alt}
          loading={loading}
          decoding="async"
          onError={() => setFailedSrc(imageSrc)}
        />
      ) : (
        <span className="menu-image-fallback">{fallbackText}</span>
      )}
    </div>
  );
}

export default MenuItemImage;
