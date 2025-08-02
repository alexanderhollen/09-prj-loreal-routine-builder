/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const selectedProductsContainer = document.getElementById(
  "selectedProductsList"
); // matches HTML
const generateRoutineBtn = document.getElementById("generateRoutine"); // matches HTML
const productSearch = document.getElementById("productSearch"); // new search input

/* Store selected products in an array */
let selectedProducts = [];
let allProducts = []; // store all loaded products for filtering

/* Load selected products from localStorage if available */
function loadSelectedProducts() {
  const saved = localStorage.getItem("selectedProducts");
  if (saved) {
    selectedProducts = JSON.parse(saved);
  }
}

/* Save selected products to localStorage */
function saveSelectedProducts() {
  localStorage.setItem("selectedProducts", JSON.stringify(selectedProducts));
}

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Load product data from JSON file */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  allProducts = data.products; // store for search
  return data.products;
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  productsContainer.innerHTML = products
    .map((product) => {
      // Check if product is selected
      const isSelected = selectedProducts.some((p) => p.name === product.name);
      return `
    <div class="product-card${isSelected ? " selected" : ""}" data-name="${
        product.name
      }">
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.brand}</p>
        <button class="desc-btn" data-name="${
          product.name
        }">Show Description</button>
      </div>
      <div class="product-desc" style="display:none;">
        <p>${product.description}</p>
        <button class="close-desc-btn" data-name="${
          product.name
        }">Close</button>
      </div>
    </div>
  `;
    })
    .join("");
}

/* Display selected products in the sidebar/list */
function updateSelectedProductsList() {
  if (selectedProducts.length === 0) {
    selectedProductsContainer.innerHTML = `<div>No products selected.</div>`;
    return;
  }
  selectedProductsContainer.innerHTML = `
    <ul>
      ${selectedProducts
        .map(
          (product) => `
        <li>
          <span>${product.name} (${product.brand})</span>
          <button class="remove-selected-btn" data-name="${product.name}">Remove</button>
        </li>
      `
        )
        .join("")}
    </ul>
    <button id="clearAllBtn">Clear All</button>
  `;
}

/* Add or remove a product from selection */
function toggleProductSelection(product) {
  const index = selectedProducts.findIndex((p) => p.name === product.name);
  if (index === -1) {
    selectedProducts.push(product);
  } else {
    selectedProducts.splice(index, 1);
  }
  saveSelectedProducts();
  updateSelectedProductsList();
}

/* Helper to filter and display products by category and search */
async function filterAndDisplayProducts() {
  const selectedCategory = categoryFilter.value;
  const searchTerm = productSearch.value.trim().toLowerCase();

  // Filter by category if selected
  let filtered = allProducts;
  if (selectedCategory) {
    filtered = filtered.filter(
      (product) => product.category === selectedCategory
    );
  }

  // Further filter by search term
  if (searchTerm) {
    filtered = filtered.filter(
      (product) =>
        product.name.toLowerCase().includes(searchTerm) ||
        product.brand.toLowerCase().includes(searchTerm) ||
        (product.description &&
          product.description.toLowerCase().includes(searchTerm))
    );
  }

  displayProducts(filtered);
}

// When category changes, update products
categoryFilter.addEventListener("change", filterAndDisplayProducts);

// When search changes, update products
productSearch.addEventListener("input", filterAndDisplayProducts);

/* Handle product card clicks for selection and description */
productsContainer.addEventListener("click", async (e) => {
  const products = await loadProducts();

  // Show/hide description
  if (e.target.classList.contains("desc-btn")) {
    const name = e.target.getAttribute("data-name");
    const card = e.target.closest(".product-card");
    card.querySelector(".product-desc").style.display = "block";
    return;
  }
  if (e.target.classList.contains("close-desc-btn")) {
    const card = e.target.closest(".product-card");
    card.querySelector(".product-desc").style.display = "none";
    return;
  }

  // Select/unselect product
  const card = e.target.closest(".product-card");
  if (card) {
    const name = card.getAttribute("data-name");
    const product = products.find((p) => p.name === name);
    toggleProductSelection(product);

    // Refresh product cards to update selection highlight
    const selectedCategory = categoryFilter.value;
    const filteredProducts = products.filter(
      (p) => p.category === selectedCategory
    );
    displayProducts(filteredProducts);
  }
});

/* Handle remove button in selected products list */
selectedProductsContainer.addEventListener("click", (e) => {
  if (e.target.classList.contains("remove-selected-btn")) {
    const name = e.target.getAttribute("data-name");
    selectedProducts = selectedProducts.filter((p) => p.name !== name);
    saveSelectedProducts();
    updateSelectedProductsList();
    // Also update product cards highlight
    categoryFilter.dispatchEvent(new Event("change"));
  }
  if (e.target.id === "clearAllBtn") {
    selectedProducts = [];
    saveSelectedProducts();
    updateSelectedProductsList();
    categoryFilter.dispatchEvent(new Event("change"));
  }
});

/* Generate routine using OpenAI via Cloudflare Worker */
generateRoutineBtn.addEventListener("click", async () => {
  if (selectedProducts.length === 0) {
    chatWindow.innerHTML = "Please select at least one product.";
    return;
  }

  chatWindow.innerHTML = "Generating your personalized routine...";

  // Prepare messages for OpenAI API
  const messages = [
    {
      role: "system",
      content:
        "You are a helpful beauty expert. Create a personalized routine using the provided products. Only use the products listed.",
    },
    {
      role: "user",
      content: `Here are the selected products:\n${selectedProducts
        .map(
          (p) => `- ${p.name} (${p.brand}) [${p.category}]: ${p.description}`
        )
        .join("\n")}\nPlease generate a step-by-step routine.`,
    },
  ];

  // Send request to your Cloudflare Worker endpoint
  try {
    const response = await fetch(
      "https://lucky-surf-9f32.alexlh2003.workers.dev/a",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, model: "gpt-4o" }),
      }
    );
    const data = await response.json();
    if (
      data &&
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content
    ) {
      chatWindow.innerHTML = `<div class="ai-message">${data.choices[0].message.content}</div>`;
      // Save conversation history for follow-up
      window.conversationHistory = [...messages, data.choices[0].message];
    } else {
      chatWindow.innerHTML = "Sorry, no response from AI.";
    }
  } catch (err) {
    chatWindow.innerHTML = "Error connecting to AI service.";
  }
});

/* Chat form submission handler for follow-up questions */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  // Use the correct input name from your HTML
  const userInput = chatForm.elements["userInput"].value.trim();
  if (!userInput) return;

  // Show user message
  chatWindow.innerHTML += `<div class="user-message">${userInput}</div>`;

  // Add to conversation history
  if (!window.conversationHistory) window.conversationHistory = [];
  window.conversationHistory.push({ role: "user", content: userInput });

  // Send to Cloudflare Worker
  try {
    const response = await fetch(
      "https://lucky-surf-9f32.alexlh2003.workers.dev/a",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: window.conversationHistory,
          model: "gpt-4o",
        }),
      }
    );
    const data = await response.json();
    if (
      data &&
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content
    ) {
      chatWindow.innerHTML += `<div class="ai-message">${data.choices[0].message.content}</div>`;
      window.conversationHistory.push(data.choices[0].message);
    } else {
      chatWindow.innerHTML += "<div>Sorry, no response from AI.</div>";
    }
  } catch (err) {
    chatWindow.innerHTML += "<div>Error connecting to AI service.</div>";
  }

  chatForm.reset();
});

/* On page load, restore selected products and update UI */
window.addEventListener("DOMContentLoaded", async () => {
  loadSelectedProducts();
  updateSelectedProductsList();
  await loadProducts();
  filterAndDisplayProducts();
});
