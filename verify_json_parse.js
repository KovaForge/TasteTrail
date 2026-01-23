
const input = `
{
  "restaurant": {
    "name": "Pizzeria Tiramisu",
    "cuisine": "Italian",
    "addressSuburb": "Parkwood",
    "notes": "Italian restaurant offering pizzas and pastas. Menu imported from online ordering page"
  },
  "items": [
    {
      "name": "Carnivora Pizza",
      "category": "Pizza",
      "price": 29.00,
      "description": "Tomato sauce, fior di latte, ham, hot cacciatore and mild pepperoni",
      "tags": ["meat"],
      "tried": false,
      "notes": ""
    },
    {
      "name": "Pizza Tiramisu",
      "category": "Pizza",
      "price": 32.00,
      "description": "Tomato sauce, fresh mozzarella, hot cacciatore, mushrooms, sundried tomatoes, cherry tomatoes, red onion, fresh chilli, garlic oil",
      "tags": ["spicy"],
      "tried": false,
      "notes": ""
    },
    {
      "name": "Iron Man Pizza",
      "category": "Pizza",
      "price": 29.00,
      "description": "Tomato sauce, fresh mozzarella, salami, red onion, capsicum, anchovies, gorgonzola, cherry tomatoes",
      "tags": ["anchovies"],
      "tried": false,
      "notes": ""
    },
    {
      "name": "Margherita Pizza",
      "category": "Pizza",
      "price": 24.00,
      "description": "Tomato sauce, fior di latte, fresh basil",
      "tags": ["vegetarian"],
      "tried": false,
      "notes": ""
    },
    {
      "name": "Lasagna",
      "category": "Pasta",
      "price": null,
      "description": "Baked layers of fresh pasta with bechamel sauce and slow cooked beef ragu",
      "tags": [],
      "tried": false,
      "notes": ""
    },
    {
      "name": "Spaghetti Bolognese",
      "category": "Pasta",
      "price": null,
      "description": "Spaghetti with slow cooked beef ragu and parmesan",
      "tags": [],
      "tried": false,
      "notes": ""
    },
    {
      "name": "Gnocchi Gorgonzola",
      "category": "Pasta",
      "price": null,
      "description": "Potato gnocchi in a creamy gorgonzola sauce",
      "tags": ["vegetarian"],
      "tried": false,
      "notes": ""
    },
    {
      "name": "Tiramisu",
      "category": "Dessert",
      "price": null,
      "description": "Classic Italian dessert with mascarpone, espresso and cocoa",
      "tags": ["vegetarian"],
      "tried": false,
      "notes": ""
    }
  ],
  "warnings": [
    "Some prices were not clearly displayed on the online ordering page and have been left as null",
    "Menu items and prices may vary by size or availability"
  ]
}
`;

function tryParseMenuJson(content) {
  try {
    const data = JSON.parse(content);

    if (!data.restaurant?.name || !data.restaurant?.cuisine) {
        console.log("Fail: Missing restaurant name or cuisine");
        return null;
    }
    if (!Array.isArray(data.items) || data.items.length === 0) {
        console.log("Fail: No items array or empty");
        return null;
    }

    // Validate at least the first item has a name
    if (!data.items[0].name) {
        console.log("Fail: First item missing name");
        return null;
    }

    return {
      restaurant: {
        name: data.restaurant.name,
        cuisine: data.restaurant.cuisine,
        addressSuburb: data.restaurant.addressSuburb,
        notes: data.restaurant.notes,
      },
      items: data.items.map((item) => ({
        name: item.name || 'Unknown Item',
        category: item.category,
        price: typeof item.price === 'number' ? item.price : undefined,
        description: item.description,
        tags: Array.isArray(item.tags) ? item.tags : [],
        tried: false,
        notes: '',
      })),
      warnings: Array.isArray(data.warnings) ? data.warnings : [],
    };
  } catch (e) {
    console.log("Exception:", e.message);
    return null;
  }
}

const result = tryParseMenuJson(input);
if (result) {
    console.log("SUCCESS: Parsed correctly");
    console.log("Items count:", result.items.length);
} else {
    console.log("FAILURE: Returned null");
}
