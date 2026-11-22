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
import { Header } from '../components/Header';

export const DailySalesEntryScreen = ({ onNavigate, onReportGenerated }) => {
  const { t, language } = useLanguage();
  const { isListening, transcript, startListening, stopListening, speak } = useVoice();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [vendorProducts, setVendorProducts] = useState([]);

  // Product-wise entry state map: { [itemId]: { quantity_sold, selling_price, purchase_cost, unsold_quantity, damaged_quantity, included } }
  const [itemEntries, setItemEntries] = useState({});

  // Expenses
  const [transportCost, setTransportCost] = useState('50');
  const [rentCost, setRentCost] = useState('100');
  const [packagingCost, setPackagingCost] = useState('30');
  const [otherExpenses, setOtherExpenses] = useState('20');

  // Payments
  const [cashCollection, setCashCollection] = useState('');
  const [upiCollection, setUpiCollection] = useState('');
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
      let products = await api.getVendorProducts();
      if (!products || products.length === 0) {
        // Fallback to items catalog
        products = await api.getItems();
      }
      const activeProducts = products.filter(p => p.is_active !== false);
      setVendorProducts(activeProducts);

      // Initialize entries
      const initialMap = {};
      activeProducts.forEach((p, idx) => {
        initialMap[p.id] = {
          item_id: p.id,
          name_en: p.name_en,
          name_ta: p.name_ta,
          category: p.category,
          unit: p.default_unit || 'kg',
          quantity_sold: idx === 0 ? '15' : '10',
          selling_price: '40',
          purchase_cost: '28',
          unsold_quantity: '2',
          damaged_quantity: '1',
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
    setItemEntries(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value
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

  // Auto populate cash/upi if empty when revenue is computed
  useEffect(() => {
    if (totalSalesRevenue > 0 && !cashCollection && !upiCollection) {
      const estimatedCash = Math.round(totalSalesRevenue * 0.6);
      const estimatedUpi = Math.round(totalSalesRevenue - estimatedCash);
      setCashCollection(String(estimatedCash));
      setUpiCollection(String(estimatedUpi));
    }
  }, [totalSalesRevenue]);

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
      const itemsPayload = activeEntriesList.map(it => ({
        item_id: it.item_id,
        quantity_sold: parseFloat(it.quantity_sold) || 0,
        selling_price: parseFloat(it.selling_price) || 0,
        purchase_cost: parseFloat(it.purchase_cost) || 0,
        unsold_quantity: parseFloat(it.unsold_quantity) || 0,
        damaged_quantity: parseFloat(it.damaged_quantity) || 0,
        notes: null
      }));

      const payload = {
        entry_date: new Date().toISOString().split('T')[0],
        transport_cost: parseFloat(transportCost) || 0,
        rent_cost: parseFloat(rentCost) || 0,
        packaging_cost: parseFloat(packagingCost) || 0,
        other_expenses: parseFloat(otherExpenses) || 0,
        cash_collection: parseFloat(cashCollection) || 0,
        upi_collection: parseFloat(upiCollection) || 0,
        other_digital_collection: parseFloat(otherDigital) || 0,
        pending_credit: parseFloat(pendingCredit) || 0,
        notes: null,
        items: itemsPayload
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
              name={isListening ? "microphone" : "microphone-outline"}
              size={32}
              color="#FFFFFF"
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.voiceBtnTitle}>
                {isListening ? (language === 'ta' ? 'கேட்கிறது...' : 'Listening...') : t('voiceFillBtn')}
              </Text>
              <Text style={styles.voiceBtnSub} numberOfLines={2}>
                {voiceHint || t('voiceFillHint')}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* SECTION 1: PRODUCT-WISE SALES & STOCK */}
        <View style={styles.sectionHeaderRow}>
          <MaterialCommunityIcons name="basket" size={24} color={THEME.colors.primary} />
          <Text style={styles.sectionHeading}>{t('productWiseDetails')}</Text>
        </View>

        {vendorProducts.map((prod) => {
          const entry = itemEntries[prod.id] || {
            quantity_sold: '0',
            selling_price: '0',
            purchase_cost: '0',
            unsold_quantity: '0',
            damaged_quantity: '0',
            included: false
          };
          const isIncluded = entry.included;
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
                  name={isIncluded ? "checkbox-marked-circle" : "checkbox-blank-circle-outline"}
                  size={26}
                  color={isIncluded ? THEME.colors.primary : "#9CA3AF"}
                />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.productNameText}>{prodName}</Text>
                  <Text style={styles.productUnitText}>{t('units')?.[unit] || unit}</Text>
                </View>
                {isIncluded && (
                  <View style={styles.itemProfitBadge}>
                    <Text style={styles.itemProfitText}>
                      +{t('rs')}{Math.round(itemProfit)}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Input Fields (Rendered when checked) */}
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

                  {/* Row 2: Purchase Cost per unit */}
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
                      <Text style={[styles.fieldLabel, { color: THEME.colors.loss }]}>
                        {t('damagedQty')} ({unit}) - {t('wastageLoss')}: ₹{Math.round(itemWastage)}
                      </Text>
                      <TextInput
                        style={[styles.numberInput, { borderColor: '#FFCDD2' }]}
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
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    marginBottom: 14,
    overflow: 'hidden',
    elevation: 2
  },
  productCardActive: {
    borderColor: THEME.colors.primary
  },
  productCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#FAFAFA'
  },
  productNameText: {
    fontSize: 17,
    fontWeight: '800',
    color: THEME.colors.textDark
  },
  productUnitText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600'
  },
  itemProfitBadge: {
    backgroundColor: THEME.colors.primaryBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  itemProfitText: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.primary
  },
  inputsGrid: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6'
  },
  inputPairRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10
  },
  inputCol: {
    flex: 1
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    marginBottom: 4,
    flexWrap: 'wrap'
  },
  numberInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: THEME.borderRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.textDark
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
  }
});
