export function getItemBasePrice(item) {
  if (item.variants?.length > 0) {
    return item.variants[0].price;
  }

  return item.price;
}

export function getItemDisplayPrice(item) {
  if (item.variants?.length > 0) {
    const prices = item.variants.map((variant) => variant.price);

    return `₱${Math.min(...prices).toFixed(2)} - ₱${Math.max(...prices).toFixed(
      2
    )}`;
  }

  return `₱${item.price.toFixed(2)}`;
}

export function createCartItem(menuItem, selectedVariant = null, quantity = 1) {
  const price = selectedVariant ? selectedVariant.price : menuItem.price;
  const variantLabel = selectedVariant ? selectedVariant.name : null;
  const cartId = selectedVariant
    ? `${menuItem.id}-${selectedVariant.id}`
    : String(menuItem.id);

  return {
    ...menuItem,
    cartId,
    price,
    quantity,
    selectedVariant,
    variantLabel,
  };
}

export function addItemToCart(
  cartItems,
  selectedItem,
  selectedVariant = null,
  quantity = 1
) {
  const newCartItem = createCartItem(selectedItem, selectedVariant, quantity);

  const existingItem = cartItems.find(
    (cartItem) => cartItem.cartId === newCartItem.cartId
  );

  if (existingItem) {
    const nextQuantity = existingItem.quantity + quantity;

    if (nextQuantity > selectedItem.available) {
      return cartItems;
    }

    return cartItems.map((cartItem) =>
      cartItem.cartId === newCartItem.cartId
        ? {
            ...cartItem,
            quantity: nextQuantity,
            recommendationSource: cartItem.recommendationSource || newCartItem.recommendationSource,
          }
        : cartItem
    );
  }

  return [...cartItems, newCartItem];
}

export function decreaseItemQuantity(cartItems, cartId) {
  return cartItems
    .map((cartItem) =>
      cartItem.cartId === cartId
        ? { ...cartItem, quantity: cartItem.quantity - 1 }
        : cartItem
    )
    .filter((cartItem) => cartItem.quantity > 0);
}

export function removeItemFromCart(cartItems, cartId) {
  return cartItems.filter((cartItem) => cartItem.cartId !== cartId);
}

export function getCartItemCount(cartItems) {
  return cartItems.reduce((total, item) => total + item.quantity, 0);
}

export function getCartTotal(cartItems) {
  return cartItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );
}

export function getItemQuantity(cartItems, itemId, variantId = null) {
  return cartItems
    .filter((cartItem) => {
      const sameItem = cartItem.id === itemId;

      if (!variantId) {
        return sameItem;
      }

      return sameItem && cartItem.selectedVariant?.id === variantId;
    })
    .reduce((total, item) => total + item.quantity, 0);
}
