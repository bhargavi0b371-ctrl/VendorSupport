import AsyncStorage from '@react-native-async-storage/async-storage';

// Local storage keys
const KEYS = {
  ITEMS: '@vv_items',
  SALES: '@vv_sales',
  PURCHASES: '@vv_purchases',
  OFFLINE_SALES_QUEUE: '@vv_offline_sales_queue',
  OFFLINE_PURCHASES_QUEUE: '@vv_offline_purchases_queue',
  OFFLINE_DAILY_ENTRIES_QUEUE: '@vv_offline_daily_entries_queue',
  DAILY_ENTRIES: '@vv_daily_entries',
  ONBOARDING_COMPLETED: '@vv_onboarding_completed',
  SELECTED_CATEGORIES: '@vv_selected_categories',
  VENDOR_PRODUCTS: '@vv_vendor_products',
  MARKET_PRICES: '@vv_market_prices',
  MARKETS: '@vv_markets',
  FESTIVALS: '@vv_festivals',
  SETTINGS: '@vv_settings',
  LAST_SYNC: '@vv_last_sync'
};

// Initial offline bootstrap dataset (10 items, 3 markets, 5 festivals)
export const SEED_ITEMS = [
  { id: 1, name_en: "Tomato", name_ta: "தக்காளி", category: "vegetable", default_unit: "kg", icon: "food-apple", color: "#E53935" },
  { id: 2, name_en: "Onion", name_ta: "வெங்காயம்", category: "vegetable", default_unit: "kg", icon: "circle-outline", color: "#8E24AA" },
  { id: 3, name_en: "Potato", name_ta: "உருளைக்கிழங்கு", category: "vegetable", default_unit: "kg", icon: "circle-slice-8", color: "#BCAAA4" },
  { id: 4, name_en: "Jasmine Flower", name_ta: "மல்லிகைப்பூ", category: "flower", default_unit: "kg", icon: "flower", color: "#FFF59D" },
  { id: 5, name_en: "Marigold", name_ta: "சாமந்திப்பூ", category: "flower", default_unit: "kg", icon: "flower-tulip", color: "#FFA000" },
  { id: 6, name_en: "Banana", name_ta: "வாழைப்பழம்", category: "fruit", default_unit: "kg", icon: "fruit-grapes", color: "#FDD835" },
  { id: 7, name_en: "Apple", name_ta: "ஆப்பிள்", category: "fruit", default_unit: "kg", icon: "food-apple-outline", color: "#D32F2F" },
  { id: 8, name_en: "Green Chilli", name_ta: "பச்சை மிளகாய்", category: "vegetable", default_unit: "kg", icon: "chili-mild", color: "#2E7D32" },
  { id: 9, name_en: "Ginger", name_ta: "இஞ்சி", category: "vegetable", default_unit: "kg", icon: "seed", color: "#8D6E63" },
  { id: 10, name_en: "Coriander", name_ta: "கொத்தமல்லி", category: "herb", default_unit: "bunch", icon: "leaf", color: "#43A047" }
];

export const SEED_MARKETS = [
  {
    id: 1,
    name_en: "Koyambedu Wholesale Market",
    name_ta: "கோயம்பேடு மொத்த சந்தை",
    location: "Koyambedu, Chennai",
    distance_km: 4.5,
    transport_cost_per_km: 15.0,
    map_url: "https://maps.google.com/?q=Koyambedu+Wholesale+Market+Complex+Chennai",
    opening_hours: "03:00 AM - 11:00 AM"
  },
  {
    id: 2,
    name_en: "Madhavaram Wholesale Market",
    name_ta: "மாதவரம் மொத்த சந்தை",
    location: "Madhavaram, Chennai",
    distance_km: 9.8,
    transport_cost_per_km: 15.0,
    map_url: "https://maps.google.com/?q=Madhavaram+Market+Chennai",
    opening_hours: "04:00 AM - 12:00 PM"
  },
  {
    id: 3,
    name_en: "Kothawal Chavadi Market",
    name_ta: "கொத்தவால் சாவடி சந்தை",
    location: "George Town, Chennai",
    distance_km: 13.2,
    transport_cost_per_km: 18.0,
    map_url: "https://maps.google.com/?q=Kothawal+Chavadi+Chennai",
    opening_hours: "02:30 AM - 10:30 AM"
  }
];

export const LocalDB = {
  async init() {
    try {
      const items = await AsyncStorage.getItem(KEYS.ITEMS);
      if (!items) {
        await AsyncStorage.setItem(KEYS.ITEMS, JSON.stringify(SEED_ITEMS));
      }
      const markets = await AsyncStorage.getItem(KEYS.MARKETS);
      if (!markets) {
        await AsyncStorage.setItem(KEYS.MARKETS, JSON.stringify(SEED_MARKETS));
      }
      const settings = await AsyncStorage.getItem(KEYS.SETTINGS);
      if (!settings) {
        await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify({ default_margin_pct: 25.0, language: 'ta' }));
      }
    } catch (e) {
      console.warn("LocalDB init error", e);
    }
  },

  async getItems() {
    try {
      const raw = await AsyncStorage.getItem(KEYS.ITEMS);
      return raw ? JSON.parse(raw) : SEED_ITEMS;
    } catch (e) {
      return SEED_ITEMS;
    }
  },

  async saveItems(items) {
    await AsyncStorage.setItem(KEYS.ITEMS, JSON.stringify(items));
  },

  async getMarkets() {
    try {
      const raw = await AsyncStorage.getItem(KEYS.MARKETS);
      return raw ? JSON.parse(raw) : SEED_MARKETS;
    } catch (e) {
      return SEED_MARKETS;
    }
  },

  async getSales() {
    try {
      const raw = await AsyncStorage.getItem(KEYS.SALES);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },

  async addSale(sale) {
    const sales = await this.getSales();
    const todayStr = new Date().toISOString().split('T')[0];
    const newSale = {
      id: Date.now(),
      sync_id: sale.sync_id || `offline-sale-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      user_id: sale.user_id || 1,
      item_id: sale.item_id,
      quantity: sale.quantity,
      unit: sale.unit || "kg",
      amount: sale.amount,
      unit_price: sale.unit_price || (sale.amount / (sale.quantity || 1)),
      sale_date: sale.sale_date || todayStr,
      voice_raw_text: sale.voice_raw_text || null,
      created_at: new Date().toISOString()
    };
    sales.unshift(newSale);
    await AsyncStorage.setItem(KEYS.SALES, JSON.stringify(sales));

    // Also push to offline sync queue
    await this.queueOfflineSale(newSale);
    return newSale;
  },

  async undoLastSale() {
    const sales = await this.getSales();
    if (sales.length === 0) return null;
    const removed = sales.shift();
    await AsyncStorage.setItem(KEYS.SALES, JSON.stringify(sales));

    // Also remove from offline queue if present
    const queue = await this.getOfflineSalesQueue();
    const updatedQueue = queue.filter(s => s.sync_id !== removed.sync_id);
    await AsyncStorage.setItem(KEYS.OFFLINE_SALES_QUEUE, JSON.stringify(updatedQueue));
    return removed;
  },

  async getPurchases() {
    try {
      const raw = await AsyncStorage.getItem(KEYS.PURCHASES);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },

  async addPurchase(purchase) {
    const purchases = await this.getPurchases();
    const todayStr = new Date().toISOString().split('T')[0];
    const newPur = {
      id: Date.now(),
      sync_id: purchase.sync_id || `offline-pur-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      user_id: purchase.user_id || 1,
      item_id: purchase.item_id,
      market_id: purchase.market_id || null,
      quantity: purchase.quantity,
      unit: purchase.unit || "kg",
      total_cost: purchase.total_cost,
      unit_cost: purchase.total_cost / (purchase.quantity || 1),
      purchase_date: purchase.purchase_date || todayStr,
      notes: purchase.notes || null,
      created_at: new Date().toISOString()
    };
    purchases.unshift(newPur);
    await AsyncStorage.setItem(KEYS.PURCHASES, JSON.stringify(purchases));

    await this.queueOfflinePurchase(newPur);
    return newPur;
  },

  // Offline Sync Queue management
  async queueOfflineSale(sale) {
    const q = await this.getOfflineSalesQueue();
    q.push(sale);
    await AsyncStorage.setItem(KEYS.OFFLINE_SALES_QUEUE, JSON.stringify(q));
  },

  async getOfflineSalesQueue() {
    try {
      const raw = await AsyncStorage.getItem(KEYS.OFFLINE_SALES_QUEUE);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },

  async clearOfflineSalesQueue() {
    await AsyncStorage.setItem(KEYS.OFFLINE_SALES_QUEUE, JSON.stringify([]));
  },

  async queueOfflinePurchase(purchase) {
    const q = await this.getOfflinePurchasesQueue();
    q.push(purchase);
    await AsyncStorage.setItem(KEYS.OFFLINE_PURCHASES_QUEUE, JSON.stringify(q));
  },

  async getOfflinePurchasesQueue() {
    try {
      const raw = await AsyncStorage.getItem(KEYS.OFFLINE_PURCHASES_QUEUE);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },

  async clearOfflinePurchasesQueue() {
    await AsyncStorage.setItem(KEYS.OFFLINE_PURCHASES_QUEUE, JSON.stringify([]));
  },

  async getPendingCount() {
    const salesQ = await this.getOfflineSalesQueue();
    const purQ = await this.getOfflinePurchasesQueue();
    const dailyQ = await this.getOfflineDailyEntriesQueue();
    return salesQ.length + purQ.length + dailyQ.length;
  },

  // --- Onboarding & Vendor Products ---
  async getOnboardingCompleted() {
    try {
      const val = await AsyncStorage.getItem(KEYS.ONBOARDING_COMPLETED);
      return val === 'true';
    } catch (e) {
      return false;
    }
  },

  async setOnboardingCompleted(completed) {
    await AsyncStorage.setItem(KEYS.ONBOARDING_COMPLETED, completed ? 'true' : 'false');
  },

  async getSelectedCategories() {
    try {
      const raw = await AsyncStorage.getItem(KEYS.SELECTED_CATEGORIES);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },

  async setSelectedCategories(categories) {
    await AsyncStorage.setItem(KEYS.SELECTED_CATEGORIES, JSON.stringify(categories));
  },

  async getVendorProducts() {
    try {
      const raw = await AsyncStorage.getItem(KEYS.VENDOR_PRODUCTS);
      if (raw) return JSON.parse(raw);
      // Fallback: convert SEED_ITEMS into initial vendor products
      return SEED_ITEMS.slice(0, 6).map(it => ({
        id: it.id,
        name_en: it.name_en,
        name_ta: it.name_ta,
        category: it.category,
        default_unit: it.default_unit,
        icon: it.icon,
        color: it.color,
        is_active: true,
        is_custom: false
      }));
    } catch (e) {
      return [];
    }
  },

  async saveVendorProducts(products) {
    await AsyncStorage.setItem(KEYS.VENDOR_PRODUCTS, JSON.stringify(products));
  },

  async addCustomVendorProduct(product) {
    const products = await this.getVendorProducts();
    const newProduct = {
      id: product.id || Date.now(),
      name_en: product.name_en,
      name_ta: product.name_ta || product.name_en,
      category: product.category,
      default_unit: product.default_unit || 'kg',
      icon: product.icon || 'tag-outline',
      color: product.color || '#4CAF50',
      is_active: true,
      is_custom: true
    };
    products.push(newProduct);
    await this.saveVendorProducts(products);
    return newProduct;
  },

  async toggleVendorProduct(itemId, isActive) {
    const products = await this.getVendorProducts();
    const updated = products.map(p => p.id === itemId ? { ...p, is_active: isActive } : p);
    await this.saveVendorProducts(updated);
    return updated;
  },

  // --- Daily Sales Entries & Reports ---
  async getDailyEntries() {
    try {
      const raw = await AsyncStorage.getItem(KEYS.DAILY_ENTRIES);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },

  async saveDailyEntry(entry) {
    const entries = await this.getDailyEntries();
    const todayStr = entry.entry_date || new Date().toISOString().split('T')[0];
    const newEntry = {
      ...entry,
      id: entry.id || Date.now(),
      sync_id: entry.sync_id || `offline-daily-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      entry_date: todayStr,
      created_at: new Date().toISOString()
    };
    // Replace if exists for same date, or prepend
    const existingIdx = entries.findIndex(e => e.entry_date === todayStr);
    if (existingIdx >= 0) {
      entries[existingIdx] = newEntry;
    } else {
      entries.unshift(newEntry);
    }
    await AsyncStorage.setItem(KEYS.DAILY_ENTRIES, JSON.stringify(entries));
    await this.queueOfflineDailyEntry(newEntry);
    return newEntry;
  },

  async queueOfflineDailyEntry(entry) {
    const queue = await this.getOfflineDailyEntriesQueue();
    queue.push(entry);
    await AsyncStorage.setItem(KEYS.OFFLINE_DAILY_ENTRIES_QUEUE, JSON.stringify(queue));
  },

  async getOfflineDailyEntriesQueue() {
    try {
      const raw = await AsyncStorage.getItem(KEYS.OFFLINE_DAILY_ENTRIES_QUEUE);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },

  async clearOfflineDailyEntriesQueue() {
    await AsyncStorage.setItem(KEYS.OFFLINE_DAILY_ENTRIES_QUEUE, JSON.stringify([]));
  },

  async getDailyReport(targetDate) {
    const dateStr = targetDate || new Date().toISOString().split('T')[0];
    const entries = await this.getDailyEntries();
    const entry = entries.find(e => e.entry_date === dateStr);
    if (entry && entry.calculated_report) {
      return entry.calculated_report;
    }
    // Return empty fallback structure
    return {
      date: dateStr,
      total_sales_revenue: 0,
      total_cost_of_goods_sold: 0,
      gross_profit: 0,
      total_daily_expenses: 0,
      net_profit: 0,
      cash_collection: 0,
      upi_collection: 0,
      other_digital_collection: 0,
      pending_credit: 0,
      profit_margin_pct: 0,
      total_unsold_stock_value: 0,
      total_wastage_loss: 0,
      items_sold_count: 0,
      items_breakdown: [],
      best_selling_products: [],
      lowest_selling_products: []
    };
  },

  // Compute local today summary
  async getTodaySummary() {
    const todayStr = new Date().toISOString().split('T')[0];
    const sales = await this.getSales();
    const purchases = await this.getPurchases();

    const todaySales = sales.filter(s => s.sale_date === todayStr);
    const todayPurchases = purchases.filter(p => p.purchase_date === todayStr);

    const total_sales = todaySales.reduce((acc, s) => acc + (parseFloat(s.amount) || 0), 0);
    const total_purchases = todayPurchases.reduce((acc, p) => acc + (parseFloat(p.total_cost) || 0), 0);
    const net_profit = total_sales - total_purchases;

    return {
      date: todayStr,
      total_sales: Math.round(total_sales),
      total_purchases: Math.round(total_purchases),
      net_profit: Math.round(net_profit),
      sales_count: todaySales.length,
      purchases_count: todayPurchases.length
    };
  },

  // Settings
  async getSettings() {
    try {
      const raw = await AsyncStorage.getItem(KEYS.SETTINGS);
      return raw ? JSON.parse(raw) : { default_margin_pct: 25.0, language: 'ta' };
    } catch (e) {
      return { default_margin_pct: 25.0, language: 'ta' };
    }
  },

  async saveSettings(settings) {
    await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
  }
};
