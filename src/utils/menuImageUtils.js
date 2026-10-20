const menuImageAliases = {
  "beef-banh-mi": ["Banh Mi Beef", "Beef Banh Mi"],
  "buttered-rice": ["Buttered Rice"],
  butterscotch: ["Butter Scotch", "Butterscotch"],
  "caramel-machiato": ["Caramel Macchiato", "Caramel Machiato"],
  "chicken-banh-mi": ["Banh Mi Chicken", "Chicken Banh Mi"],
  "chicken-tenders-soup": ["Chicken Tenders with Soup", "Chicken Tenders Soup"],
  "coffee-float": ["Coffee Float"],
  "creamy-vanilla": ["Creamy Vanilla"],
  "drip-coffee": ["Iced Drip Coffee", "Drip Coffee"],
  egg: ["Egg", "Extra Egg"],
  "french-vanilla": ["French Vanilla"],
  "fried-noodles-egg": ["Fried Noodles with Egg"],
  "fried-noodles-siomai": ["Fried Noodles with Siomai", "Fried Noodles with 2 pcs Siomai"],
  "hazelnut-mocha": ["Hazelnut Mocha"],
  "hungarian-banh-mi": ["Banh Mi Hungarian", "Hungarian Banh Mi"],
  "hungarian-sausage-rice-egg-soup": ["Hungarian Sausage Rice with Egg"],
  "matcha-latte": ["Matcha Latte"],
  "pastil-rice-egg-soup": ["Pastil Rice with Egg"],
  "pastil-rice-soup": ["Pastil Rice"],
  "pho-beef": ["Pho Beef"],
  "pho-chicken": ["Pho Chicken"],
  rice: ["Plain Rice", "Extra Plain Rice", "Rice"],
  "salted-caramel": ["Salted Caramel"],
  "shanghai-rice-egg-soup": ["Shanghai Rice with Egg"],
  shanghai: ["Shanghai", "Extra Shanghai"],
  "siomai-rice-egg-soup": ["Siomai Rice with Egg"],
  "siomai-rice-soup": ["Siomai Rice"],
  siomai: ["Siomai", "Extra Siomai"],
  "skinless-longanisa-rice-egg-soup": ["Skinless Longanisa Rice with Egg"],
  "spring-rolls": ["Spring Rolls"],
  "vietnamese-tea": ["Vietnamese Tea"],
};

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const menuImagesByName = new Map();
for (const [fileName, aliases] of Object.entries(menuImageAliases)) {
  const imagePath = `/images/menu/${fileName.replace(/-legacy$/, "")}.png`;
  for (const alias of [fileName.replace(/-/g, " ").replace(/ legacy$/, ""), ...aliases]) {
    menuImagesByName.set(normalizeName(alias), imagePath);
  }
}

export function getLocalMenuImage(name) {
  return menuImagesByName.get(normalizeName(name)) || "";
}
