import { LocalDB } from '../db/localDb';

// Backend API URL (Default 127.0.0.1:8000 / localhost:8000; can be set via env or config)
export const API_BASE_URL = "http://127.0.0.1:8000";

class ApiClient {
  constructor(baseUrl = API_BASE_URL) {
    this.baseUrl = baseUrl;
    this.isOnline = true;
  }

  async _request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout for quick fallback

      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      this.isOnline = true;
      return await response.json();
    } catch (err) {
      this.isOnline = false;
      throw err;
    }
  }

  // --- Vendor Authentication & Profile ---
  async registerVendor(data) {
    try {
      const res = await this._request('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      if (res && res.user) {
        await LocalDB.setAuthUser(res.user);
      }
      return res;
    } catch (e) {
      // Local fallback for offline account creation
      const localUser = {
        id: Date.now(),
        name: data.name,
        shop_name: data.shop_name,
        phone: data.phone,
        language: data.language || 'ta',
        onboarding_completed: false
      };
      await LocalDB.setAuthUser(localUser);
      return {
        status: 'success_offline',
        user: localUser,
        message_en: `Welcome ${data.name}! Created offline.`,
        message_ta: `வணக்கம் ${data.name}! ஆஃப்லைனில் பதிவு செய்யப்பட்டது.`
      };
    }
  }

  async loginVendor(data) {
    try {
      const res = await this._request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      if (res && res.user) {
        await LocalDB.setAuthUser(res.user);
      }
      return res;
    } catch (e) {
      // Offline fallback: check local user
      const localUser = await LocalDB.getAuthUser();
      if (localUser && localUser.phone === data.phone) {
        return {
          status: 'success_offline',
          user: localUser,
          message_en: `Welcome back to ${localUser.shop_name}!`,
          message_ta: `மீண்டும் வருக ${localUser.shop_name}!`
        };
      }
      throw e;
    }
  }

  async getVendorProfile(userId = 1) {
    try {
      const user = await this._request(`/api/auth/me?user_id=${userId}`);
      await LocalDB.setAuthUser(user);
      return user;
    } catch (e) {
      return await LocalDB.getAuthUser();
    }
  }

  async updateVendorProfile(profileData, userId = 1) {
    try {
      const user = await this._request(`/api/auth/profile?user_id=${userId}`, {
        method: 'PUT',
        body: JSON.stringify(profileData)
      });
      await LocalDB.setAuthUser(user);
      return user;
    } catch (e) {
      const localUser = (await LocalDB.getAuthUser()) || {};
      const updated = { ...localUser, ...profileData };
      await LocalDB.setAuthUser(updated);
      return updated;
    }
  }

  async logoutVendor() {
    await LocalDB.clearAuthUser();
  }

  // --- Items ---
  async getItems() {
    try {
      const items = await this._request('/api/items');
      await LocalDB.saveItems(items);
      return items;
    } catch (e) {
      return await LocalDB.getItems();
    }
  }

  // --- Sales ---
  async createSale(saleData) {
    // 1. Always write locally first for immediate offline responsiveness
    const localSaved = await LocalDB.addSale(saleData);

    // 2. If online, attempt to push immediately to server
    try {
      const serverResult = await this._request('/api/sales', {
        method: 'POST',
        body: JSON.stringify({
          ...saleData,
          sync_id: localSaved.sync_id
        })
      });
      // Remove from offline queue since server received it
      const queue = await LocalDB.getOfflineSalesQueue();
      const filtered = queue.filter(q => q.sync_id !== localSaved.sync_id);
      await LocalDB.clearOfflineSalesQueue();
      for (const item of filtered) {
        await LocalDB.queueOfflineSale(item);
      }
      return serverResult;
    } catch (e) {
      // Stays safely in offline queue
      return localSaved;
    }
  }

  async undoLastSale() {
    try {
      const serverResult = await this._request('/api/sales/undo-last', {
        method: 'POST'
      });
      await LocalDB.undoLastSale();
      return serverResult;
    } catch (e) {
      const localUndone = await LocalDB.undoLastSale();
      return {
        status: 'success',
        deleted_sale_id: localUndone ? localUndone.id : null,
        amount: localUndone ? localUndone.amount : 0,
        message_en: localUndone ? `Undid sale of ₹${localUndone.amount}` : "No recent sales",
        message_ta: localUndone ? `₹${localUndone.amount} விற்பனை ரத்து செய்யப்பட்டது` : "விற்பனை இல்லை"
      };
    }
  }

  async getTodaySummary() {
    try {
      return await this._request('/api/sales/today-summary');
    } catch (e) {
      return await LocalDB.getTodaySummary();
    }
  }

  // --- Purchases ---
  async createPurchase(purchaseData) {
    const localSaved = await LocalDB.addPurchase(purchaseData);

    try {
      const serverResult = await this._request('/api/purchases', {
        method: 'POST',
        body: JSON.stringify({
          ...purchaseData,
          sync_id: localSaved.sync_id
        })
      });
      const queue = await LocalDB.getOfflinePurchasesQueue();
      const filtered = queue.filter(q => q.sync_id !== localSaved.sync_id);
      await LocalDB.clearOfflinePurchasesQueue();
      for (const item of filtered) {
        await LocalDB.queueOfflinePurchase(item);
      }
      return serverResult;
    } catch (e) {
      return localSaved;
    }
  }

  async getPurchases() {
    try {
      return await this._request('/api/purchases');
    } catch (e) {
      return await LocalDB.getPurchases();
    }
  }

  // --- Reports ---
  async getReports(period = 'daily') {
    try {
      return await this._request(`/api/reports?period=${period}`);
    } catch (e) {
      return await LocalDB.getPeriodReport(period);
    }
  }

  // --- Smart Pricing ---
  async getSmartPricing() {
    try {
      return await this._request('/api/pricing');
    } catch (e) {
      // Generate default offline pricing
      const items = await LocalDB.getItems();
      return items.map(it => ({
        item_id: it.id,
        name_en: it.name_en,
        name_ta: it.name_ta,
        category: it.category,
        unit: it.default_unit,
        wholesale_cost: 30.0,
        vendor_margin_pct: 25.0,
        suggested_selling_price: 38.0,
        festival_tag: null,
        price_trend: "stable",
        icon: it.icon,
        color: it.color
      }));
    }
  }

  // --- Markets ---
  async getMarkets() {
    try {
      return await this._request('/api/markets');
    } catch (e) {
      return await LocalDB.getMarkets();
    }
  }

  async getWhereToBuy(itemId, batchKg = 25) {
    try {
      return await this._request(`/api/markets/where-to-buy/${itemId}?batch_kg=${batchKg}`);
    } catch (e) {
      const markets = await LocalDB.getMarkets();
      return markets.map((m, idx) => ({
        market_id: m.id,
        name_en: m.name_en,
        name_ta: m.name_ta,
        location: m.location,
        distance_km: m.distance_km,
        wholesale_price: 30.0 + idx * 2,
        transport_cost_estimate: m.distance_km * 15,
        total_estimated_landed_cost: 30.0 + (m.distance_km * 15 / batchKg),
        rank: idx + 1,
        map_url: m.map_url,
        opening_hours: m.opening_hours,
        is_best_deal: idx === 0
      }));
    }
  }

  // --- Voice Parsing ---
  async parseVoice(text, language = 'auto') {
    try {
      return await this._request('/api/voice/parse', {
        method: 'POST',
        body: JSON.stringify({ text, language })
      });
    } catch (e) {
      // Client-side regex fallback for offline voice parsing!
      return this._localParseVoice(text);
    }
  }

  async executeVoiceAction(actionPayload) {
    try {
      return await this._request('/api/voice/execute', {
        method: 'POST',
        body: JSON.stringify(actionPayload)
      });
    } catch (e) {
      if (actionPayload.action === 'sale') {
        const s = await this.createSale(actionPayload);
        const sum = await LocalDB.getTodaySummary();
        return {
          status: 'success',
          action: 'sale',
          record_id: s.id,
          spoken_confirmation_en: `Recorded sale of ₹${s.amount}. Today's profit: ₹${sum.net_profit}.`,
          spoken_confirmation_ta: `₹${s.amount} விற்பனை பதிவு செய்யப்பட்டது. இன்றைய லாபம்: ₹${sum.net_profit}.`,
          today_summary: sum
        };
      } else if (actionPayload.action === 'undo') {
        return await this.undoLastSale();
      }
      return { status: 'offline_saved' };
    }
  }

  _localParseVoice(text) {
    const lower = text.toLowerCase();
    let action = "sale";
    if (lower.includes("undo") || lower.includes("ரத்து") || lower.includes("திரும்ப")) action = "undo";
    else if (lower.includes("profit") || lower.includes("லாபம்")) action = "query_profit";
    else if (lower.includes("price") || lower.includes("விலை")) action = "query_price";
    else if (lower.includes("market") || lower.includes("எங்கே")) action = "query_market";
    else if (lower.includes("bought") || lower.includes("வாங்கினேன்")) action = "purchase";

    // Extract numbers
    const nums = lower.match(/\d+(\.\d+)?/g);
    const qty = nums && nums[0] ? parseFloat(nums[0]) : 1.0;
    const amount = nums && nums[1] ? parseFloat(nums[1]) : (qty * 40);

    return {
      action,
      item_id: 1,
      item_name_en: "Tomato",
      item_name_ta: "தக்காளி",
      quantity: qty,
      unit: "kg",
      amount: amount,
      confidence: 0.9,
      spoken_confirmation_en: `Recorded sale: ${qty} kg Tomato for ₹${amount}.`,
      spoken_confirmation_ta: `${qty} kg தக்காளி ₹${amount}-க்கு விற்பனை பதிவு செய்யப்பட்டது.`,
      raw_text: text,
      can_execute: true
    };
  }

  // --- Offline Batch Sync ---
  async syncOfflineData() {
    const sales = await LocalDB.getOfflineSalesQueue();
    const purchases = await LocalDB.getOfflinePurchasesQueue();
    const daily_entries = await LocalDB.getOfflineDailyEntriesQueue();

    if (sales.length === 0 && purchases.length === 0 && daily_entries.length === 0) {
      return { synced_sales_count: 0, synced_purchases_count: 0, synced_daily_entries_count: 0, status: "nothing_to_sync" };
    }

    try {
      const result = await this._request('/api/sync', {
        method: 'POST',
        body: JSON.stringify({ sales, purchases, daily_entries })
      });
      await LocalDB.clearOfflineSalesQueue();
      await LocalDB.clearOfflinePurchasesQueue();
      await LocalDB.clearOfflineDailyEntriesQueue();
      return result;
    } catch (e) {
      throw e;
    }
  }

  // --- Onboarding & Products Catalog ---
  async getOnboardingCatalog() {
    try {
      return await this._request('/api/onboarding/catalog');
    } catch (e) {
      // Fallback offline catalog from LocalDB
      const items = await LocalDB.getItems();
      return {
        categories: [
          { id: "vegetables", name_en: "Vegetables", name_ta: "காய்கறிகள்", icon: "carrot" },
          { id: "fruits", name_en: "Fruits", name_ta: "பழங்கள்", icon: "food-apple" },
          { id: "fruits_vegetables", name_en: "Fruits & Vegetables", name_ta: "பழங்கள் மற்றும் காய்கறிகள்", icon: "fruit-grapes" },
          { id: "flowers", name_en: "Flowers", name_ta: "பூக்கள்", icon: "flower" },
          { id: "street_food", name_en: "Street Food", name_ta: "தெரு உணவு / சிற்றுண்டி", icon: "food" },
          { id: "tea_coffee", name_en: "Tea / Coffee", name_ta: "தேநீர் / காபி", icon: "coffee" },
          { id: "groceries", name_en: "Groceries", name_ta: "மளிகை பொருட்கள்", icon: "store" },
          { id: "clothes", name_en: "Clothes", name_ta: "துணிகள் / ஆபரணங்கள்", icon: "tshirt-crew" },
          { id: "other", name_en: "Other", name_ta: "மற்றவை", icon: "dots-horizontal-circle" }
        ],
        predefined_products: items,
        all_predefined_items: items
      };
    }
  }

  async submitOnboarding(data) {
    const u = await LocalDB.getAuthUser();
    const payload = {
      user_id: data.user_id || u?.id || 1,
      ...data
    };

    // 1. Save locally first
    await LocalDB.setOnboardingCompleted(true);
    await LocalDB.setSelectedCategories(data.selected_categories || []);

    try {
      const res = await this._request('/api/onboarding', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      // Refresh vendor products from backend
      const vProducts = await this.getVendorProducts(payload.user_id);
      await LocalDB.saveVendorProducts(vProducts);
      return res;
    } catch (e) {
      const allItems = await LocalDB.getItems();
      const selected = allItems.filter(it => (data.product_ids || []).includes(it.id));
      if (data.custom_products && data.custom_products.length > 0) {
        data.custom_products.forEach(cp => {
          selected.push({
            id: Date.now() + Math.floor(Math.random() * 1000),
            name_en: cp.name_en,
            name_ta: cp.name_ta || cp.name_en,
            category: cp.category,
            default_unit: cp.default_unit || 'kg',
            is_active: true,
            is_custom: true
          });
        });
      }
      await LocalDB.saveVendorProducts(selected);
      return {
        status: "saved_offline",
        vendor_products_count: selected.length,
        message_en: "Onboarding saved offline",
        message_ta: "ஆஃப்லைனில் பதிவு செய்யப்பட்டது"
      };
    }
  }

  async getVendorProducts(userId = null) {
    try {
      let uid = userId;
      if (!uid) {
        const u = await LocalDB.getAuthUser();
        uid = u?.id || 1;
      }
      const products = await this._request(`/api/vendor/products?user_id=${uid}`);
      await LocalDB.saveVendorProducts(products);
      return products;
    } catch (e) {
      return await LocalDB.getVendorProducts();
    }
  }

  async addCustomProduct(product) {
    try {
      const res = await this._request('/api/vendor/custom-product', {
        method: 'POST',
        body: JSON.stringify(product)
      });
      await LocalDB.addCustomVendorProduct(res);
      return res;
    } catch (e) {
      return await LocalDB.addCustomVendorProduct(product);
    }
  }

  async toggleVendorProduct(itemId, isActive) {
    try {
      await this._request(`/api/vendor/products/${itemId}?is_active=${isActive}`, {
        method: 'PUT'
      });
    } catch (e) {
      // ignore
    }
    return await LocalDB.toggleVendorProduct(itemId, isActive);
  }

  // --- Daily Sales Entry & Automatic Report ---
  async submitDailyEntry(entryData) {
    // Save locally
    const localSaved = await LocalDB.saveDailyEntry(entryData);

    try {
      const serverResult = await this._request('/api/daily-sales', {
        method: 'POST',
        body: JSON.stringify({
          ...entryData,
          sync_id: localSaved.sync_id
        })
      });
      // Store calculated report in local entry
      localSaved.calculated_report = serverResult.report;
      await LocalDB.saveDailyEntry(localSaved);

      // Remove from offline queue
      const q = await LocalDB.getOfflineDailyEntriesQueue();
      const filtered = q.filter(item => item.sync_id !== localSaved.sync_id);
      await LocalDB.clearOfflineDailyEntriesQueue();
      for (const item of filtered) {
        await LocalDB.queueOfflineDailyEntry(item);
      }

      return serverResult;
    } catch (e) {
      // Calculate local fallback report
      const rev = (entryData.items || []).reduce((acc, it) => acc + ((it.quantity_sold || 0) * (it.selling_price || 0)), 0);
      const cogs = (entryData.items || []).reduce((acc, it) => acc + ((it.quantity_sold || 0) * (it.purchase_cost || 0)), 0);
      const exp = (entryData.transport_cost || 0) + (entryData.rent_cost || 0) + (entryData.packaging_cost || 0) + (entryData.other_expenses || 0);
      const gross = rev - cogs;
      const net = gross - exp;
      const margin = rev > 0 ? (net / rev) * 100 : 0;
      const unsoldVal = (entryData.items || []).reduce((acc, it) => acc + ((it.unsold_quantity || 0) * (it.purchase_cost || 0)), 0);
      const wastage = (entryData.items || []).reduce((acc, it) => acc + ((it.damaged_quantity || 0) * (it.purchase_cost || 0)), 0);

      const fallbackReport = {
        date: entryData.entry_date || new Date().toISOString().split('T')[0],
        total_sales_revenue: Math.round(rev * 100) / 100,
        total_cost_of_goods_sold: Math.round(cogs * 100) / 100,
        gross_profit: Math.round(gross * 100) / 100,
        total_daily_expenses: Math.round(exp * 100) / 100,
        net_profit: Math.round(net * 100) / 100,
        cash_collection: entryData.cash_collection || 0,
        upi_collection: entryData.upi_collection || 0,
        other_digital_collection: entryData.other_digital_collection || 0,
        pending_credit: entryData.pending_credit || 0,
        profit_margin_pct: Math.round(margin * 10) / 10,
        total_unsold_stock_value: Math.round(unsoldVal * 100) / 100,
        total_wastage_loss: Math.round(wastage * 100) / 100,
        items_sold_count: (entryData.items || []).length,
        items_breakdown: (entryData.items || []).map(it => ({
          item_id: it.item_id,
          name_en: it.name_en || `Item ${it.item_id}`,
          name_ta: it.name_ta || `பொருள் ${it.item_id}`,
          category: it.category || 'general',
          unit: it.unit || 'kg',
          quantity_sold: it.quantity_sold || 0,
          selling_price: it.selling_price || 0,
          purchase_cost: it.purchase_cost || 0,
          unsold_quantity: it.unsold_quantity || 0,
          damaged_quantity: it.damaged_quantity || 0,
          revenue: (it.quantity_sold || 0) * (it.selling_price || 0),
          cogs: (it.quantity_sold || 0) * (it.purchase_cost || 0),
          gross_profit: ((it.quantity_sold || 0) * (it.selling_price || 0)) - ((it.quantity_sold || 0) * (it.purchase_cost || 0)),
          unsold_stock_value: (it.unsold_quantity || 0) * (it.purchase_cost || 0),
          wastage_loss: (it.damaged_quantity || 0) * (it.purchase_cost || 0)
        })),
        best_selling_products: [],
        lowest_selling_products: []
      };

      localSaved.calculated_report = fallbackReport;
      await LocalDB.saveDailyEntry(localSaved);

      return {
        status: "saved_offline",
        message: "Saved offline. Sync when internet returns.",
        report: fallbackReport
      };
    }
  }

  async getDailySalesReport(date) {
    try {
      const url = date ? `/api/daily-sales/report?entry_date=${date}` : '/api/daily-sales/report';
      return await this._request(url);
    } catch (e) {
      return await LocalDB.getDailyReport(date);
    }
  }

  async getDailyReportsHistory(limit = 30) {
    try {
      return await this._request(`/api/daily-sales/history?limit=${limit}`);
    } catch (e) {
      const entries = await LocalDB.getDailyEntries();
      return entries.map(e => e.calculated_report || {
        date: e.entry_date,
        total_sales_revenue: 0,
        net_profit: 0,
        profit_margin_pct: 0
      });
    }
  }

  async getAISalesInsights() {
    try {
      return await this._request('/api/daily-sales/insights');
    } catch (e) {
      return {
        stocking_suggestions: [
          { item_name_en: "Tomato", item_name_ta: "தக்காளி", advice: "stock_more", reason_en: "High turnover and consistent demand", reason_ta: "அதிக விற்பனை மற்றும் நிலையான தேவை" }
        ],
        tomorrow_demand_forecast: [
          { item_name_en: "Tomato", item_name_ta: "தக்காளி", expected_demand_kg: 28.0, reason_en: "Weekend festival demand uptick", reason_ta: "வார இறுதி மற்றும் பண்டிகை தேவை அதிகரிப்பு" }
        ],
        highest_profit_products: [
          { item_name_en: "Tomato", item_name_ta: "தக்காளி", profit: 300, profit_margin_pct: 33.3 }
        ],
        wastage_reduction_tips: [
          { item_name_en: "Tomato", item_name_ta: "தக்காளி", tip_en: "Keep in shaded, aerated bamboo baskets to prevent heat spoiling", tip_ta: "வெப்பத்தால் அழுகாமல் இருக்க நிழலான, காற்றோட்டமான மூங்கில் கூடைகளில் வைக்கவும்" }
        ],
        sales_improvement_suggestions: [
          { suggestion_en: "Package small trial packs of coriander and green chilli with high-margin items", suggestion_ta: "அதிக லாபமுள்ள பொருட்களுடன் கொத்தமல்லி மற்றும் பச்சை மிளகாய் காம்போவாக வழங்கவும்" }
        ],
        promotional_offers: [
          { offer_title_en: "Combo Deal: 2kg Tomato + 1kg Onion for ₹125", offer_title_ta: "காம்போ ஆஃபர்: 2 கிலோ தக்காளி + 1 கிலோ வெங்காயம் ₹125 மட்டும்" }
        ],
        audio_script_en: "Tip for tomorrow: Stock up on Tomato. Offer combos with onion to increase profit and reduce wastage.",
        audio_script_ta: "நாளைக்கான ஆலோசனை: தக்காளி அதிகம் வாங்கவும். லாபத்தை கூட்ட வெங்காயத்துடன் காம்போ ஆஃபர் வழங்கவும்."
      };
    }
  }

  // --- Settings ---
  async getUserSettings() {
    try {
      return await this._request('/api/settings/user');
    } catch (e) {
      return await LocalDB.getSettings();
    }
  }

  async updateUserSettings(settings) {
    await LocalDB.saveSettings(settings);
    try {
      return await this._request('/api/settings/user', {
        method: 'PUT',
        body: JSON.stringify(settings)
      });
    } catch (e) {
      return settings;
    }
  }
}

export const api = new ApiClient();
