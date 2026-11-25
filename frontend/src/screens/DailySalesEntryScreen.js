import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { useVoice } from '../hooks/useVoice';
import { api } from '../api/client';
import { LocalDB } from '../db/localDb';
import { Header } from '../components/Header';

export const DailySalesEntryScreen = ({ onNavigate, onReportGenerated }) => {
  const { t, language } = useLanguage();
  const { isListening, transcript, startListening, stopListening, speak } = useVoice();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [vendorProducts, setVendorProducts] = useState([]);

  // Product-wise entry state map: { [itemId]: { quantity_sold, selling_price, purchase_cost, unsold_quantity, damaged_quantity, included } }
  const [itemEntries, setItemEntries] = useState({});

  // Expenses - default to 0
  const [transportCost, setTransportCost] = useState('0');
  const [rentCost, setRentCost] = useState('0');
  const [packagingCost, setPackagingCost] = useState('0');
  const [otherExpenses, setOtherExpenses] = useState('0');

  // Payments - default to 0
  const [cashCollection, setCashCollection] = useState('0');
  const [upiCollection, setUpiCollection] = useState('0');
  const [otherDigital, setOtherDigital] = useState('0');
  const [pendingCredit, setPendingCredit] = useState('0');

  // Voice raw text feedback
  const [voiceHint, setVoiceHint] = useState('');

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const u = await LocalDB.getAuthUser();
      const uid = u?.id || 1;
      if (u) setCurrentUser(u);

      // Load ONLY the vendor's chosen products
      const products = await api.getVendorProducts(uid);
      const activeProducts = (products || []).filter(p => p.is_active !== false);
      setVendorProducts(activeProducts);

      // Initialize entries with 0 for all fields
      const initialMap = {};
      activeProducts.forEach((p) => {
        initialMap[p.id] = {
          item_id: p.item_id || p.id,
          name_en: p.name_en,
          name_ta: p.name_ta,
          category: p.category,
          unit: p.default_unit || 'kg',
          quantity_sold: '0',
          selling_price: '0',
          purchase_cost: '0',
          unsold_quantity: '0',
          damaged_quantity: '0',
          included: true
        };
      });
      setItemEntries(initialMap);
    } catch (e) {
      console.warn("Failed to load products for daily entry", e);
    } finally {
      setLoading(false);
    }
  };

  const updateItemField = (itemId, field, value) => {
    // If user types over '0', replace '0' with the new digit instead of '0X'
    let cleanVal = value;
    if (cleanVal.length > 1 && cleanVal.startsWith('0') && cleanVal[1] !== '.') {
      cleanVal = cleanVal.replace(/^0+/, '');
    }
    setItemEntries(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: cleanVal
      }
    }));
  };

  const toggleItemIncluded = (itemId) => {
    setItemEntries(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        included: !prev[itemId]?.included
      }
    }));
  };

  // --- Calculations ---
  const activeEntriesList = Object.values(itemEntries).filter(it => it.included);

  const totalSalesRevenue = activeEntriesList.reduce((acc, it) => {
    const qty = parseFloat(it.quantity_sold) || 0;
    const price = parseFloat(it.selling_price) || 0;
    return acc + (qty * price);
  }, 0);

  const totalCOGS = activeEntriesList.reduce((acc, it) => {
    const qty = parseFloat(it.quantity_sold) || 0;
    const cost = parseFloat(it.purchase_cost) || 0;
    return acc + (qty * cost);
  }, 0);

  const grossProfit = totalSalesRevenue - totalCOGS;

  const totalDailyExpenses = (parseFloat(transportCost) || 0) +
    (parseFloat(rentCost) || 0) +
    (parseFloat(packagingCost) || 0) +
    (parseFloat(otherExpenses) || 0);

  const netProfit = grossProfit - totalDailyExpenses;

  const profitMarginPct = totalSalesRevenue > 0
    ? Math.round((netProfit / totalSalesRevenue) * 1000) / 10
    : 0;

  const totalUnsoldStockValue = activeEntriesList.reduce((acc, it) => {
    const unsold = parseFloat(it.unsold_quantity) || 0;
    const cost = parseFloat(it.purchase_cost) || 0;
    return acc + (unsold * cost);
  }, 0);

  const totalWastageLoss = activeEntriesList.reduce((acc, it) => {
    const damaged = parseFloat(it.damaged_quantity) || 0;
    const cost = parseFloat(it.purchase_cost) || 0;
    return acc + (damaged * cost);
  }, 0);

  // Voice fill handler
  const handleVoiceFill = async () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
      setVoiceHint(language === 'ta' ? 'பேசுங்கள்: "தக்காளி 15 கிலோ 40 ரூபாய்க்கு விற்றேன்..."' : 'Speak: "Sold 15 kg tomato for 40, cost 28..."');
    }
  };

  useEffect(() => {
    if (transcript) {
      setVoiceHint(transcript);
      parseTranscriptIntoEntry(transcript);
    }
  }, [transcript]);

  const parseTranscriptIntoEntry = (text) => {
    const lower = text.toLowerCase();
    // Match numbers
    const numbers = lower.match(/\d+(\.\d+)?/g);
    if (!numbers || numbers.length === 0) return;

    // Find if any product name matches
    const matched = vendorProducts.find(p => {
      const en = (p.name_en || '').toLowerCase();
      const ta = (p.name_ta || '').toLowerCase();
      return lower.includes(en) || lower.includes(ta);
    });

    const targetId = matched ? matched.id : vendorProducts[0]?.id;
    if (targetId && itemEntries[targetId]) {
      const updated = { ...itemEntries[targetId], included: true };
      if (numbers[0]) updated.quantity_sold = numbers[0];
      if (numbers[1]) updated.selling_price = numbers[1];
      if (numbers[2]) updated.purchase_cost = numbers[2];
      if (numbers[3]) updated.unsold_quantity = numbers[3];
      if (numbers[4]) updated.damaged_quantity = numbers[4];

      setItemEntries(prev => ({
        ...prev,
        [targetId]: updated
      }));
    }
  };

  const handleSubmit = async () => {
    if (activeEntriesList.length === 0) {
      Alert.alert(
        language === 'ta' ? 'தயவுசெய்து பொருளை சேர்க்கவும்' : 'No Items Selected',
        language === 'ta' ? 'குறைந்தபட்சம் 1 பொருளுக்கான விற்பனையை தேர்வு செய்யவும்' : 'Please select at least 1 item for today\'s entry.'
      );
      return;
    }

    setSubmitting(true);
    try {
      // Validate quantities and prices
      for (const it of activeEntriesList) {
        const qtySold = parseFloat(it.quantity_sold) || 0;
        const sp = parseFloat(it.selling_price) || 0;
        const cp = parseFloat(it.purchase_cost) || 0;
        const unsold = parseFloat(it.unsold_quantity) || 0;
        const damaged = parseFloat(it.damaged_quantity) || 0;

        if (qtySold < 0 || sp < 0 || cp < 0 || unsold < 0 || damaged < 0) {
          Alert.alert(
            language === 'ta' ? 'பிழை' : 'Validation Error',
            language === 'ta' ? 'எதிர்மறை மதிப்புகள் அனுமதிக்கப்படாது.' : 'Quantities and prices cannot be negative.'
          );
          setSubmitting(false);
          return;
        }
      }

      // Exclude completely unused products from submitted sales records!
      const usedItemsPayload = activeEntriesList
        .filter(it => {
          const qtySold = parseFloat(it.quantity_sold) || 0;
          const unsold = parseFloat(it.unsold_quantity) || 0;
          const damaged = parseFloat(it.damaged_quantity) || 0;
          return qtySold > 0 || unsold > 0 || damaged > 0;
        })
        .map(it => {
          const qtySold = parseFloat(it.quantity_sold) || 0;
          const sp = parseFloat(it.selling_price) || 0;
          const cp = parseFloat(it.purchase_cost) || 0;
          const unsold = parseFloat(it.unsold_quantity) || 0;
          const damaged = parseFloat(it.damaged_quantity) || 0;
          return {
            item_id: it.item_id,
            unit: it.unit || 'kg',
            quantity_sold: qtySold,
            selling_price: sp,
            selling_price_per_unit: sp,
            purchase_cost: cp,
            purchase_cost_per_unit: cp,
            unsold_quantity: unsold,
            damaged_quantity: damaged,
            notes: null
          };
        });

      if (usedItemsPayload.length === 0) {
        Alert.alert(
          language === 'ta' ? 'விற்பனை பதிவு இல்லை' : 'No Sales Entered',
          language === 'ta' ? 'குறைந்தபட்சம் 1 பொருளுக்கான விற்பனை அல்லது இருப்பை உள்ளிடவும்.' : 'Please enter sales or stock for at least one item.'
        );
        setSubmitting(false);
        return;
      }

      const tCost = parseFloat(transportCost) || 0;
      const rCost = parseFloat(rentCost) || 0;
      const pCost = parseFloat(packagingCost) || 0;
      const oCost = parseFloat(otherExpenses) || 0;
      const cColl = parseFloat(cashCollection) || 0;
      const uColl = parseFloat(upiCollection) || 0;
      const dColl = parseFloat(otherDigital) || 0;
      const pCred = parseFloat(pendingCredit) || 0;
      const todayDate = new Date().toISOString().split('T')[0];

      const payload = {
        user_id: currentUser?.id || 1,
        date: todayDate,
        entry_date: todayDate,
        transport_cost: tCost,
        rent_cost: rCost,
        packaging_cost: pCost,
        other_expenses: oCost,
        cash_collection: cColl,
        upi_collection: uColl,
        other_digital_collection: dColl,
        pending_credit: pCred,
        expenses: {
          transport: tCost,
          rent: rCost,
          packaging: pCost,
          other: oCost
        },
        payments: {
          cash: cColl,
          upi: uColl,
          digital_other: dColl,
          credit_pending: pCred
        },
        notes: null,
        items: usedItemsPayload
      };

      const result = await api.submitDailyEntry(payload);
      const report = result.report;

      // Speak confirmation
      const speakMsg = language === 'ta'
        ? `இன்றைய அறிக்கை தயார். மொத்த வருமானம் ₹${report.total_sales_revenue}, நிகர லாபம் ₹${report.net_profit}.`
        : `Daily report ready. Total revenue ₹${report.total_sales_revenue}, net profit ₹${report.net_profit}.`;
      speak(speakMsg);

      if (onReportGenerated) {
        onReportGenerated(report);
      }
    } catch (e) {
      Alert.alert(
        language === 'ta' ? 'பிழை' : 'Error',
        language === 'ta' ? 'அறிக்கை உருவாக்குவதில் தவறு ஏற்பட்டது' : 'Failed to generate report. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={THEME.colors.primary} />
        <Text style={styles.loadingText}>{t('loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Header
        title={t('dailyEntryTitle')}
        showBack={true}
        onBack={() => onNavigate('home')}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* VOICE FILL ACTION HERO */}
        <View style={styles.voiceHeroBox}>
          <TouchableOpacity
            onPress={handleVoiceFill}
            activeOpacity={0.85}
            style={[styles.voiceBtn, isListening && styles.voiceBtnActive]}
          >
            <MaterialCommunityIcons
              name={isListening ? "stop-circle" : "microphone"}
              size={34}
              color="#FFFFFF"
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.voiceBtnTitle}>
                {isListening
                  ? (language === 'ta' ? 'கேட்கிறது... முடிக்க மீண்டும் தொடவும்' : 'Listening... Tap again to finish')
                  : t('voiceFillBtn')}
              </Text>
              <Text style={styles.voiceBtnSub} numberOfLines={2}>
                {isListening
                  ? (language === 'ta' ? 'பேசி முடித்தவுடன் பட்டனை மீண்டும் தொட்டு பதிவு செய்யவும்' : 'Speak numbers & items, then tap button again to auto-fill')
                  : (voiceHint || t('voiceFillHint'))}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* SECTION 1: PRODUCT-WISE SALES & STOCK */}
        <View style={styles.sectionHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
            <MaterialCommunityIcons name="basket" size={24} color={THEME.colors.primary} />
            <Text style={styles.sectionHeading}>{t('productWiseDetails')}</Text>
          </View>
          <TouchableOpacity
            onPress={() => onNavigate && onNavigate('onboarding_edit')}
            style={styles.manageCatalogBtn}
            activeOpacity={0.75}
          >
            <MaterialCommunityIcons name="playlist-edit" size={16} color={THEME.colors.primary} />
            <Text style={styles.manageCatalogBtnText}>
              {language === 'ta' ? '+ பொருட்கள் சேர்க்க/நீக்க' : '+ Manage Products'}
            </Text>
          </TouchableOpacity>
        </View>

        {vendorProducts.length === 0 && (
          <View style={styles.emptyProductsCard}>
            <MaterialCommunityIcons name="basket-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyProductsTitle}>
              {language === 'ta' ? 'பொருட்கள் எதுவும் தேர்வு செய்யப்படவில்லை' : 'No Products Selected for Your Shop'}
            </Text>
            <Text style={styles.emptyProductsSub}>
              {language === 'ta'
                ? 'உங்கள் கடையில் விற்கப்படும் குறிப்பிட்ட பழங்கள் அல்லது காய்கறிகளை தேர்வு செய்து தொடங்கவும்.'
                : 'Select specific fruits or vegetables sold in your shop under Manage Products.'}
            </Text>
            <TouchableOpacity
              style={styles.chooseProductsBtn}
              onPress={() => onNavigate && onNavigate('onboarding_edit')}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="plus-circle" size={20} color="#FFFFFF" />
              <Text style={styles.chooseProductsBtnText}>
                {language === 'ta' ? 'பொருட்களை தேர்வு செய்க' : 'Choose Products to Sell'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {vendorProducts.map((prod) => {
          const entry = itemEntries[prod.id] || {
            quantity_sold: '0',
            selling_price: '0',
            purchase_cost: '0',
            unsold_quantity: '0',
            damaged_quantity: '0',
            included: true
          };
          const isIncluded = entry.included !== false;
          const prodName = language === 'ta' ? (prod.name_ta || prod.name_en) : (prod.name_en || prod.name_ta);
          const unit = prod.default_unit || 'kg';

          const itemRev = (parseFloat(entry.quantity_sold) || 0) * (parseFloat(entry.selling_price) || 0);
          const itemCogs = (parseFloat(entry.quantity_sold) || 0) * (parseFloat(entry.purchase_cost) || 0);
          const itemProfit = itemRev - itemCogs;
          const itemWastage = (parseFloat(entry.damaged_quantity) || 0) * (parseFloat(entry.purchase_cost) || 0);

          return (
            <View
              key={prod.id}
              style={[
                styles.productCard,
                isIncluded && styles.productCardActive
              ]}
            >
              {/* Product Card Top Header */}
              <TouchableOpacity
                onPress={() => toggleItemIncluded(prod.id)}
                style={styles.productCardHeader}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons
                  name={isIncluded ? "check-circle" : "checkbox-blank-circle-outline"}
                  size={28}
                  color={isIncluded ? "#16a34a" : "#9CA3AF"}
                />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.productNameText}>{prodName}</Text>
                  <Text style={styles.productUnitText}>{t('units')?.[unit] || unit}</Text>
                </View>
                <View style={styles.itemProfitBadge}>
                  <Text style={styles.itemProfitText}>
                    +{t('rs')}{Math.round(itemProfit)}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Input Fields */}
              {isIncluded && (
                <View style={styles.inputsGrid}>
                  {/* Row 1: Sold Qty & Selling Price */}
                  <View style={styles.inputPairRow}>
                    <View style={styles.inputCol}>
                      <Text style={styles.fieldLabel}>{t('qtySold')} ({unit})</Text>
                      <TextInput
                        style={styles.numberInput}
                        keyboardType="numeric"
                        value={entry.quantity_sold}
                        onChangeText={(v) => updateItemField(prod.id, 'quantity_sold', v)}
                        placeholder="0"
                      />
                    </View>
                    <View style={styles.inputCol}>
                      <Text style={styles.fieldLabel}>{t('sellingPrice')} (₹/{unit})</Text>
                      <TextInput
                        style={styles.numberInput}
                        keyboardType="numeric"
                        value={entry.selling_price}
                        onChangeText={(v) => updateItemField(prod.id, 'selling_price', v)}
                        placeholder="0"
                      />
                    </View>
                  </View>

                  {/* Row 2: Purchase Cost per unit & Unsold Qty */}
                  <View style={styles.inputPairRow}>
                    <View style={styles.inputCol}>
                      <Text style={styles.fieldLabel}>{t('purchaseCost')} (₹/{unit})</Text>
                      <TextInput
                        style={styles.numberInput}
                        keyboardType="numeric"
                        value={entry.purchase_cost}
                        onChangeText={(v) => updateItemField(prod.id, 'purchase_cost', v)}
                        placeholder="0"
                      />
                    </View>
                    <View style={styles.inputCol}>
                      <Text style={styles.fieldLabel}>{t('unsoldQty')} ({unit})</Text>
                      <TextInput
                        style={styles.numberInput}
                        keyboardType="numeric"
                        value={entry.unsold_quantity}
                        onChangeText={(v) => updateItemField(prod.id, 'unsold_quantity', v)}
                        placeholder="0"
                      />
                    </View>
                  </View>

                  {/* Row 3: Damaged/Spoiled Qty */}
                  <View style={styles.inputPairRow}>
                    <View style={[styles.inputCol, { width: '100%' }]}>
                      <Text style={styles.damagedLabel}>
                        {t('damagedQty')} ({unit}) - {t('wastageLoss')}: ₹{Math.round(itemWastage)}
                      </Text>
                      <TextInput
                        style={styles.damagedNumberInput}
                        keyboardType="numeric"
                        value={entry.damaged_quantity}
                        onChangeText={(v) => updateItemField(prod.id, 'damaged_quantity', v)}
                        placeholder="0"
                      />
                    </View>
                  </View>
                </View>
              )}
            </View>
          );
        })}

        {/* SECTION 2: DAILY EXPENSES */}
        <View style={styles.expensesCard}>
          <View style={styles.sectionHeaderRow}>
            <MaterialCommunityIcons name="wallet-outline" size={24} color="#D84315" />
            <Text style={styles.sectionHeading}>{t('dailyExpensesTitle')}</Text>
          </View>

          <View style={styles.inputPairRow}>
            <View style={styles.inputCol}>
              <Text style={styles.fieldLabel}>{t('expenseTransport')}</Text>
              <TextInput
                style={styles.numberInput}
                keyboardType="numeric"
                value={transportCost}
                onChangeText={setTransportCost}
                placeholder="0"
              />
            </View>
            <View style={styles.inputCol}>
              <Text style={styles.fieldLabel}>{t('expenseRent')}</Text>
              <TextInput
                style={styles.numberInput}
                keyboardType="numeric"
                value={rentCost}
                onChangeText={setRentCost}
                placeholder="0"
              />
            </View>
          </View>

          <View style={styles.inputPairRow}>
            <View style={styles.inputCol}>
              <Text style={styles.fieldLabel}>{t('expensePackaging')}</Text>
              <TextInput
                style={styles.numberInput}
                keyboardType="numeric"
                value={packagingCost}
                onChangeText={setPackagingCost}
                placeholder="0"
              />
            </View>
            <View style={styles.inputCol}>
              <Text style={styles.fieldLabel}>{t('expenseOther')}</Text>
              <TextInput
                style={styles.numberInput}
                keyboardType="numeric"
                value={otherExpenses}
                onChangeText={setOtherExpenses}
                placeholder="0"
              />
            </View>
          </View>

          <View style={styles.totalRow}>
            <Text style={styles.totalRowLabel}>{t('totalExpenses')}:</Text>
            <Text style={styles.totalRowValue}>₹{totalDailyExpenses}</Text>
          </View>
        </View>

        {/* SECTION 3: PAYMENTS BREAKDOWN */}
        <View style={styles.paymentsCard}>
          <View style={styles.sectionHeaderRow}>
            <MaterialCommunityIcons name="cash-fast" size={24} color="#00838F" />
            <Text style={styles.sectionHeading}>{t('paymentsTitle')}</Text>
          </View>

          <View style={styles.inputPairRow}>
            <View style={styles.inputCol}>
              <Text style={styles.fieldLabel}>{t('cashCollected')} (₹)</Text>
              <TextInput
                style={styles.numberInput}
                keyboardType="numeric"
                value={cashCollection}
                onChangeText={setCashCollection}
                placeholder="0"
              />
            </View>
            <View style={styles.inputCol}>
              <Text style={styles.fieldLabel}>{t('upiCollected')} (₹)</Text>
              <TextInput
                style={styles.numberInput}
                keyboardType="numeric"
                value={upiCollection}
                onChangeText={setUpiCollection}
                placeholder="0"
              />
            </View>
          </View>

          <View style={styles.inputPairRow}>
            <View style={styles.inputCol}>
              <Text style={styles.fieldLabel}>{t('otherDigital')} (₹)</Text>
              <TextInput
                style={styles.numberInput}
                keyboardType="numeric"
                value={otherDigital}
                onChangeText={setOtherDigital}
                placeholder="0"
              />
            </View>
            <View style={styles.inputCol}>
              <Text style={styles.fieldLabel}>{t('creditPending')} (₹)</Text>
              <TextInput
                style={styles.numberInput}
                keyboardType="numeric"
                value={pendingCredit}
                onChangeText={setPendingCredit}
                placeholder="0"
              />
            </View>
          </View>
        </View>

        {/* SECTION 4: LIVE CALCULATION SUMMARY CARD */}
        <View style={styles.liveSummaryCard}>
          <Text style={styles.liveSummaryTitle}>{t('calcSummaryTitle')}</Text>

          <View style={styles.summaryItemRow}>
            <Text style={styles.summaryItemLabel}>{t('revenue')}</Text>
            <Text style={styles.summaryItemValue}>₹{Math.round(totalSalesRevenue)}</Text>
          </View>

          <View style={styles.summaryItemRow}>
            <Text style={styles.summaryItemLabel}>{t('cogs')}</Text>
            <Text style={styles.summaryItemValue}>-₹{Math.round(totalCOGS)}</Text>
          </View>

          <View style={styles.summaryItemRow}>
            <Text style={styles.summaryItemLabel}>{t('grossProfit')}</Text>
            <Text style={[styles.summaryItemValue, { color: THEME.colors.primary }]}>
              ₹{Math.round(grossProfit)}
            </Text>
          </View>

          <View style={styles.summaryItemRow}>
            <Text style={styles.summaryItemLabel}>{t('totalExpenses')}</Text>
            <Text style={styles.summaryItemValue}>-₹{Math.round(totalDailyExpenses)}</Text>
          </View>

          <View style={styles.netProfitBanner}>
            <View>
              <Text style={styles.netProfitBannerLabel}>{t('netProfit')}</Text>
              <Text style={styles.profitMarginText}>{t('profitMargin')}: {profitMarginPct}%</Text>
            </View>
            <Text style={styles.netProfitBannerValue}>₹{Math.round(netProfit)}</Text>
          </View>

          {/* Stock & Wastage Notice */}
          <View style={styles.stockNoticeBox}>
            <View style={styles.stockNoticeCol}>
              <Text style={styles.stockNoticeLabel}>{t('unsoldStockValue')}</Text>
              <Text style={styles.stockNoticeVal}>₹{Math.round(totalUnsoldStockValue)}</Text>
              <Text style={styles.stockNoticeSub}>
                {language === 'ta' ? '(சொத்து - நஷ்டமல்ல)' : '(Retained Asset)'}
              </Text>
            </View>
            <View style={[styles.stockNoticeCol, { borderLeftWidth: 1, borderLeftColor: '#E5E7EB' }]}>
              <Text style={[styles.stockNoticeLabel, { color: THEME.colors.loss }]}>
                {t('wastageLoss')}
              </Text>
              <Text style={[styles.stockNoticeVal, { color: THEME.colors.loss }]}>
                ₹{Math.round(totalWastageLoss)}
              </Text>
              <Text style={styles.stockNoticeSub}>
                {language === 'ta' ? '(சேத நஷ்டம்)' : '(Actual Loss)'}
              </Text>
            </View>
          </View>
        </View>

        {/* SUBMIT BUTTON */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
          style={styles.submitBtn}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <MaterialCommunityIcons name="file-chart-outline" size={26} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.submitBtnText}>{t('generateDailyReport')}</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: THEME.colors.bg
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: THEME.colors.textMuted
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40
  },
  voiceHeroBox: {
    marginBottom: 16
  },
  voiceBtn: {
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.borderRadius.lg,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    elevation: 4,
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6
  },
  voiceBtnActive: {
    backgroundColor: '#D32F2F'
  },
  voiceBtnTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF'
  },
  voiceBtnSub: {
    fontSize: 13,
    color: '#E8F5E9',
    marginTop: 2
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    marginTop: 8
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '900',
    color: THEME.colors.textDark,
    flexWrap: 'wrap',
    flexShrink: 1
  },
  manageCatalogBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.colors.primaryBg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.colors.primary
  },
  manageCatalogBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.colors.primary
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#16a34a',
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 2
  },
  productCardActive: {
    borderColor: '#16a34a',
    borderWidth: 2
  },
  productCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF'
  },
  productNameText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827'
  },
  productUnitText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
    marginTop: 2
  },
  itemProfitBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16
  },
  itemProfitText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#16a34a'
  },
  inputsGrid: {
    paddingHorizontal: 16,
    paddingBottom: 16
  },
  inputPairRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12
  },
  inputCol: {
    flex: 1
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
    flexWrap: 'wrap'
  },
  numberInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '700',
    color: '#111827'
  },
  damagedLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B91C1C',
    marginBottom: 6,
    flexWrap: 'wrap'
  },
  damagedNumberInput: {
    backgroundColor: '#FFF5F5',
    borderWidth: 1.5,
    borderColor: '#FECDD3',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '700',
    color: '#111827'
  },
  expensesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.md,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    marginBottom: 14,
    elevation: 2
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6'
  },
  totalRowLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.textDark
  },
  totalRowValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#D84315'
  },
  paymentsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.md,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    marginBottom: 14,
    elevation: 2
  },
  liveSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.lg,
    padding: 18,
    borderWidth: 2,
    borderColor: THEME.colors.primary,
    marginBottom: 20,
    elevation: 4
  },
  liveSummaryTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: THEME.colors.primary,
    marginBottom: 12
  },
  summaryItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  summaryItemLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textMuted
  },
  summaryItemValue: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.textDark
  },
  netProfitBanner: {
    backgroundColor: THEME.colors.primaryBg,
    borderRadius: THEME.borderRadius.md,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 14
  },
  netProfitBannerLabel: {
    fontSize: 16,
    fontWeight: '900',
    color: THEME.colors.primary
  },
  profitMarginText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.primaryDark,
    marginTop: 2
  },
  netProfitBannerValue: {
    fontSize: 26,
    fontWeight: '900',
    color: THEME.colors.primary
  },
  stockNoticeBox: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: THEME.borderRadius.sm,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  stockNoticeCol: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 6
  },
  stockNoticeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textDark,
    textAlign: 'center'
  },
  stockNoticeVal: {
    fontSize: 16,
    fontWeight: '900',
    color: THEME.colors.textDark,
    marginVertical: 2
  },
  stockNoticeSub: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center'
  },
  submitBtn: {
    backgroundColor: THEME.colors.accent,
    borderRadius: THEME.borderRadius.md,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    elevation: 5,
    shadowColor: THEME.colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6
  },
  submitBtnText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5
  },
  emptyProductsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.md,
    padding: 24,
    alignItems: 'center',
    marginVertical: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed'
  },
  emptyProductsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.textDark,
    marginTop: 12,
    textAlign: 'center'
  },
  emptyProductsSub: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
    lineHeight: 18
  },
  chooseProductsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: THEME.borderRadius.sm,
    gap: 8
  },
  chooseProductsBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800'
  }
});
