/**
 * Maps menu items to beautiful, optimized, high-resolution Unsplash food photography 
 * based on item name keywords and category fallbacks.
 */
export function getMenuItemImage(name: string, categoryName: string): string {
  const n = name.toLowerCase();
  const cat = categoryName.toLowerCase();

  // Curated high-quality, high-contrast dish imagery from Unsplash CDN
  if (n.includes("sekuwa")) {
    if (n.includes("chicken")) {
      return "https://images.unsplash.com/photo-1608897013039-887f21d8c804?w=300&auto=format&fit=crop&q=80"; // Grilled chicken skewers
    }
    if (n.includes("mutton") || n.includes("buff") || n.includes("pork")) {
      return "https://images.unsplash.com/photo-1544025162-d76694265947?w=300&auto=format&fit=crop&q=80"; // Roasted meats / ribs / skewers
    }
    return "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=300&auto=format&fit=crop&q=80"; // BBQ grill mixed meats
  }
  
  if (n.includes("chilli") || n.includes("chile") || n.includes("chcken chilli")) {
    return "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=300&auto=format&fit=crop&q=80"; // Crispy chicken chilli / pepper chicken
  }

  if (n.includes("roti") || n.includes("nan") || n.includes("bread") || n.includes("paratha")) {
    return "https://images.unsplash.com/photo-1533777857889-4be7c70b33f7?w=300&auto=format&fit=crop&q=80"; // Indian flatbread / Naan
  }

  if (n.includes("rice") || n.includes("biryani") || n.includes("pulao")) {
    return "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=300&auto=format&fit=crop&q=80"; // Styled rice bowl
  }

  if (n.includes("momo") || n.includes("dumpling")) {
    return "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=300&auto=format&fit=crop&q=80"; // Momos / Dumplings
  }

  if (n.includes("fries") || n.includes("potato") || n.includes("aloo")) {
    return "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=300&auto=format&fit=crop&q=80"; // French fries
  }

  if (n.includes("sandheko") || n.includes("peanut") || n.includes("salad") || n.includes("appetizer")) {
    return "https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?w=300&auto=format&fit=crop&q=80"; // Peanut salad snacks
  }

  if (n.includes("beer") || n.includes("ice beer") || n.includes("tuborg") || n.includes("carlsberg")) {
    return "https://images.unsplash.com/photo-1600788886242-5c96aabe3757?w=300&auto=format&fit=crop&q=80"; // Fresh draft beer glasses
  }

  if (n.includes("coke") || n.includes("cola") || n.includes("fanta") || n.includes("sprite") || n.includes("soda")) {
    return "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=300&auto=format&fit=crop&q=80"; // Coca cola cans / bottles
  }

  if (n.includes("water") || n.includes("mineral") || n.includes("juice")) {
    return "https://images.unsplash.com/photo-1523362628745-0c100150b504?w=300&auto=format&fit=crop&q=80"; // Water decanters / fresh beverages
  }

  if (n.includes("ice cream") || n.includes("dessert") || n.includes("sweet") || n.includes("cake")) {
    return "https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=300&auto=format&fit=crop&q=80"; // Styled vanilla / waffle desserts
  }

  if (n.includes("surya") || n.includes("smoke") || n.includes("cigarette") || n.includes("tobacco")) {
    return "https://images.unsplash.com/photo-1542838132-92c53300491e?w=300&auto=format&fit=crop&q=80"; // Dark elegant minimalist concept
  }

  // Fallbacks by Category Name
  if (cat.includes("drink") || cat.includes("beverage")) {
    return "https://images.unsplash.com/photo-1497534446932-c925b458314e?w=300&auto=format&fit=crop&q=80";
  }
  if (cat.includes("dessert") || cat.includes("sweet")) {
    return "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=300&auto=format&fit=crop&q=80";
  }
  if (cat.includes("starter") || cat.includes("snack") || cat.includes("appetizer")) {
    return "https://images.unsplash.com/photo-1541532713592-79a0317b6b77?w=300&auto=format&fit=crop&q=80";
  }
  
  return "https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=300&auto=format&fit=crop&q=80"; // Standard food board
}
