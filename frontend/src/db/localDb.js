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
  LAST_SYNC: '@vv_last_sync',
  AUTH_USER: '@vv_auth_user',
  AUTH_TOKEN: '@vv_auth_token'
};

// Initial offline bootstrap dataset covering all vendor categories
export const SEED_ITEMS = [
  // Vegetables: ["Tomato", "Onion", "Brinjal", "Drumstick", "Okra"]
  { id: 1, name_en: "Tomato", name_ta: "தக்காளி", category: "vegetables", default_unit: "kg", icon: "food-apple", color: "#E53935" },
  { id: 2, name_en: "Onion", name_ta: "வெங்காயம்", category: "vegetables", default_unit: "kg", icon: "circle-outline", color: "#8E24AA" },
  { id: 3, name_en: "Brinjal", name_ta: "கத்தரிக்காய்", category: "vegetables", default_unit: "kg", icon: "eggplant", color: "#5E35B1" },
  { id: 4, name_en: "Drumstick", name_ta: "முருங்கைக்காய்", category: "vegetables", default_unit: "kg", icon: "leaf", color: "#2E7D32" },
  { id: 5, name_en: "Okra", name_ta: "வெண்டைக்காய்", category: "vegetables", default_unit: "kg", icon: "leaf", color: "#43A047" },
  { id: 6, name_en: "Potato", name_ta: "உருளைக்கிழங்கு", category: "vegetables", default_unit: "kg", icon: "circle-slice-8", color: "#BCAAA4" },
  { id: 8, name_en: "Green Chilli", name_ta: "பச்சை மிளகாய்", category: "vegetables", default_unit: "kg", icon: "chili-mild", color: "#2E7D32" },
  { id: 9, name_en: "Ginger", name_ta: "இஞ்சி", category: "vegetables", default_unit: "kg", icon: "seed", color: "#8D6E63" },
  { id: 10, name_en: "Coriander", name_ta: "கொத்தமல்லி", category: "vegetables", default_unit: "bunch", icon: "leaf", color: "#43A047" },

  // Fruits: ["Banana", "Mango", "Guava", "Papaya", "Sapota"]
  { id: 11, name_en: "Banana", name_ta: "வாழைப்பழம்", category: "fruits", default_unit: "dozen", icon: "fruit-grapes", color: "#FDD835" },
  { id: 12, name_en: "Mango", name_ta: "மாம்பழம்", category: "fruits", default_unit: "kg", icon: "fruit-cherries", color: "#FBC02D" },
  { id: 13, name_en: "Guava", name_ta: "கொய்யா", category: "fruits", default_unit: "kg", icon: "circle", color: "#8BC34A" },
  { id: 14, name_en: "Papaya", name_ta: "பப்பாளி", category: "fruits", default_unit: "piece", icon: "fruit-watermelon", color: "#FF9800" },
  { id: 15, name_en: "Sapota", name_ta: "சப்போட்டா", category: "fruits", default_unit: "kg", icon: "circle-slice-8", color: "#795548" },
  { id: 7, name_en: "Apple", name_ta: "ஆப்பிள்", category: "fruits", default_unit: "kg", icon: "food-apple-outline", color: "#D32F2F" },
  { id: 17, name_en: "Orange", name_ta: "ஆரஞ்சு", category: "fruits", default_unit: "kg", icon: "fruit-citrus", color: "#FF9800" },
  { id: 35, name_en: "Grapes", name_ta: "திராட்சை", category: "fruits", default_unit: "kg", icon: "fruit-grapes", color: "#7B1FA2" },

  // Flowers: ["Jasmine", "Rose", "Marigold", "Kanakambaram", "Flower Garland"]
  { id: 20, name_en: "Jasmine", name_ta: "மல்லிகைப்பூ", category: "flowers", default_unit: "kg", icon: "flower", color: "#FFF59D" },
  { id: 21, name_en: "Rose", name_ta: "ரோஜாப்பூ", category: "flowers", default_unit: "bunch", icon: "flower-poppy", color: "#E91E63" },
  { id: 22, name_en: "Marigold", name_ta: "சாமந்திப்பூ", category: "flowers", default_unit: "kg", icon: "flower-tulip", color: "#FFA000" },
  { id: 23, name_en: "Kanakambaram", name_ta: "கனகாம்பரம்", category: "flowers", default_unit: "kg", icon: "flower-outline", color: "#FF5722" },
  { id: 24, name_en: "Flower Garland", name_ta: "பூ மாலை", category: "flowers", default_unit: "piece", icon: "necklace", color: "#9C27B0" },

  // Street Food: ["Bajji", "Bonda", "Vadai", "Sundal", "Pani Puri"]
  { id: 25, name_en: "Bajji", name_ta: "பஜ்ஜி", category: "street_food", default_unit: "piece", icon: "food", color: "#E65100" },
  { id: 26, name_en: "Bonda", name_ta: "போண்டா", category: "street_food", default_unit: "piece", icon: "circle", color: "#FF9800" },
  { id: 27, name_en: "Vadai", name_ta: "வடை", category: "street_food", default_unit: "piece", icon: "circle-slice-8", color: "#D84315" },
  { id: 28, name_en: "Sundal", name_ta: "சுண்டல்", category: "street_food", default_unit: "cup", icon: "bowl-mix", color: "#8D6E63" },
  { id: 29, name_en: "Pani Puri", name_ta: "பானி பூரி", category: "street_food", default_unit: "plate", icon: "bowl-mix", color: "#43A047" },

  // TeaCoffee: ["Tea", "Filter Coffee", "Ginger Tea", "Sukku Coffee", "Badam Milk"]
  { id: 31, name_en: "Tea", name_ta: "டீ", category: "tea_coffee", default_unit: "cup", icon: "tea", color: "#795548" },
  { id: 32, name_en: "Filter Coffee", name_ta: "பில்டர் காபி", category: "tea_coffee", default_unit: "cup", icon: "coffee", color: "#6D4C41" },
  { id: 33, name_en: "Ginger Tea", name_ta: "இஞ்சி டீ", category: "tea_coffee", default_unit: "cup", icon: "cup-water", color: "#A1887F" },
  { id: 34, name_en: "Sukku Coffee", name_ta: "சுக்கு காபி", category: "tea_coffee", default_unit: "cup", icon: "coffee-outline", color: "#5D4037" },
  { id: 36, name_en: "Badam Milk", name_ta: "பாதாம் பால்", category: "tea_coffee", default_unit: "cup", icon: "cup", color: "#FFE082" },

  // Groceries: ["Rice", "Dal", "Sugar", "Cooking Oil", "Tamarind"]
  { id: 37, name_en: "Rice", name_ta: "அரிசி", category: "groceries", default_unit: "kg", icon: "grain", color: "#F5F5F5" },
  { id: 38, name_en: "Dal", name_ta: "பருப்பு", category: "groceries", default_unit: "kg", icon: "seed", color: "#FBC02D" },
  { id: 39, name_en: "Sugar", name_ta: "சர்க்கரை", category: "groceries", default_unit: "kg", icon: "cube-outline", color: "#ECEFF1" },
  { id: 40, name_en: "Cooking Oil", name_ta: "சமையல் எண்ணெய்", category: "groceries", default_unit: "litre", "icon": "bottle-tonic", color: "#FFC107" },
  { id: 41, name_en: "Tamarind", name_ta: "புளி", category: "groceries", default_unit: "kg", icon: "seed-outline", color: "#4E342E" },

  // Clothes: ["Saree", "Nighty", "Lungi", "Leggings", "Bangles"]
  { id: 42, name_en: "Saree", name_ta: "சேலை", category: "clothes", default_unit: "piece", icon: "tshirt-crew", color: "#C2185B" },
  { id: 43, name_en: "Nighty", name_ta: "நைட்டி", category: "clothes", default_unit: "piece", icon: "tshirt-v", color: "#8E24AA" },
  { id: 44, name_en: "Lungi", name_ta: "லுங்கி", category: "clothes", default_unit: "piece", icon: "hanger", color: "#388E3C" },
  { id: 45, name_en: "Leggings", name_ta: "லெக்கின்ஸ்", category: "clothes", default_unit: "piece", icon: "tshirt-crew", color: "#00897B" },
  { id: 46, name_en: "Bangles", name_ta: "வளையல்கள்", category: "clothes", default_unit: "set", icon: "circle-outline", color: "#FFB300" }
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
  async _getUserId(userId) {
    if (userId) return userId;
    const u = await this.getAuthUser();
    return u?.id || 1;
  },

  async getOnboardingCompleted(userId) {
    try {
      const uid = await this._getUserId(userId);
      const val = await AsyncStorage.getItem(`${KEYS.ONBOARDING_COMPLETED}_${uid}`);
      return val === 'true';
    } catch (e) {
      return false;
    }
  },

  async setOnboardingCompleted(completed, userId) {
    const uid = await this._getUserId(userId);
    await AsyncStorage.setItem(`${KEYS.ONBOARDING_COMPLETED}_${uid}`, completed ? 'true' : 'false');
  },

  async getSelectedCategories(userId) {
    try {
      const uid = await this._getUserId(userId);
      const raw = await AsyncStorage.getItem(`${KEYS.SELECTED_CATEGORIES}_${uid}`);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },

  async setSelectedCategories(categories, userId) {
    const uid = await this._getUserId(userId);
    await AsyncStorage.setItem(`${KEYS.SELECTED_CATEGORIES}_${uid}`, JSON.stringify(categories));
  },

  async getVendorProducts(userId) {
    try {
      const uid = await this._getUserId(userId);
      const raw = await AsyncStorage.getItem(`${KEYS.VENDOR_PRODUCTS}_${uid}`);
      if (raw) return JSON.parse(raw);
      return [];
    } catch (e) {
      return [];
    }
  },

  async saveVendorProducts(products, userId) {
    const uid = await this._getUserId(userId);
    await AsyncStorage.setItem(`${KEYS.VENDOR_PRODUCTS}_${uid}`, JSON.stringify(products));
  },

  async addCustomVendorProduct(product, userId) {
    const uid = await this._getUserId(userId);
    const products = await this.getVendorProducts(uid);
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
    await this.saveVendorProducts(products, uid);
    return newProduct;
  },

  async toggleVendorProduct(itemId, isActive, userId) {
    const uid = await this._getUserId(userId);
    const products = await this.getVendorProducts(uid);
    const updated = products.map(p => (p.item_id === itemId || p.id === itemId) ? { ...p, is_active: isActive } : p);
    await this.saveVendorProducts(updated, uid);
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

  // Authentication & Vendor Profile
  async getAuthUser() {
    try {
      const raw = await AsyncStorage.getItem(KEYS.AUTH_USER);
      if (raw) return JSON.parse(raw);
      return null;
    } catch (e) {
      return null;
    }
  },

  async setAuthUser(user) {
    if (!user) {
      await AsyncStorage.removeItem(KEYS.AUTH_USER);
      await AsyncStorage.removeItem(KEYS.AUTH_TOKEN);
    } else {
      await AsyncStorage.setItem(KEYS.AUTH_USER, JSON.stringify(user));
      await AsyncStorage.setItem(KEYS.AUTH_TOKEN, `vv_token_${user.id}_${user.phone}`);
    }
  },

  async clearAuthUser() {
    await AsyncStorage.removeItem(KEYS.AUTH_USER);
    await AsyncStorage.removeItem(KEYS.AUTH_TOKEN);
  },

  // Offline Period Reports Aggregation
  async getPeriodReport(period = 'daily') {
    const dailyEntries = await this.getDailyEntries();
    const todaySummary = await this.getTodaySummary();

    if (dailyEntries.length === 0) {
      return {
        period,
        total_sales: todaySummary.total_sales,
        total_purchases: todaySummary.total_purchases,
        net_profit: todaySummary.net_profit,
        profit_margin_pct: todaySummary.total_sales > 0 ? Math.round((todaySummary.net_profit / todaySummary.total_sales) * 1000) / 10 : 0,
        chart_data: [
          { label: "Today", sales: todaySummary.total_sales, purchases: todaySummary.total_purchases, profit: todaySummary.net_profit }
        ],
        top_selling_items: []
      };
    }

    // Build chart data from last 7 days of daily entries
    const chart_data = dailyEntries.slice(0, 7).reverse().map(e => ({
      label: (e.entry_date || 'Day').slice(5),
      date: e.entry_date,
      sales: Math.round(e.calculated_report?.total_sales_revenue || e.total_revenue || 0),
      purchases: Math.round((e.calculated_report?.total_cost_of_goods_sold || e.total_cogs || 0) + (e.calculated_report?.total_daily_expenses || e.total_expenses || 0)),
      profit: Math.round(e.calculated_report?.net_profit || e.net_profit || 0)
    }));

    const total_sales = chart_data.reduce((acc, c) => acc + c.sales, 0);
    const total_purchases = chart_data.reduce((acc, c) => acc + c.purchases, 0);
    const net_profit = total_sales - total_purchases;
    const profit_margin_pct = total_sales > 0 ? Math.round((net_profit / total_sales) * 1000) / 10 : 0;

    return {
      period,
      total_sales,
      total_purchases,
      net_profit,
      profit_margin_pct,
      chart_data,
      top_selling_items: []
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
