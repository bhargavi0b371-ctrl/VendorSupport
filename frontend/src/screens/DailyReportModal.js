import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { useVoice } from '../hooks/useVoice';
import { api } from '../api/client';

export const DailyReportModal = ({ visible, onClose, reportData, onRevisitReports }) => {
  const { t, language } = useLanguage();
  const { speak } = useVoice();
  const [insights, setInsights] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(true);

  const report = reportData || {};

  useEffect(() => {
    if (visible) {
      loadInsights();
    }
  }, [visible]);

  const loadInsights = async () => {
    setLoadingInsights(true);
    try {
      const data = await api.getAISalesInsights();
      setInsights(data);
    } catch (e) {
      console.warn("Failed to load insights", e);
    } finally {
      setLoadingInsights(false);
    }
  };

  const handleSpeakInsights = () => {
    if (!insights) return;
    const text = language === 'ta' ? insights.audio_script_ta : insights.audio_script_en;
    speak(text);
  };

  const handleSpeakSummary = () => {
    const textEn = `Daily Report: Revenue ₹${report.total_sales_revenue || 0}, Net Profit ₹${report.net_profit || 0}, Margin ${report.profit_margin_pct || 0} percent.`;
    const textTa = `இன்றைய அறிக்கை: வருமானம் ₹${report.total_sales_revenue || 0}, நிகர லாபம் ₹${report.net_profit || 0}, லாப விகிதம் ${report.profit_margin_pct || 0} சதவீதம்.`;
    speak(language === 'ta' ? textTa : textEn);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* TOP BAR */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <MaterialCommunityIcons name="close" size={26} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>{t('reportSuccessTitle')}</Text>
          <TouchableOpacity onPress={handleSpeakSummary} style={styles.speakHeaderBtn}>
            <MaterialCommunityIcons name="volume-high" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* RECEIPT HEADER */}
          <View style={styles.receiptHeader}>
            <MaterialCommunityIcons name="check-decagram" size={44} color={THEME.colors.primary} />
            <Text style={styles.reportDateText}>{t('reportDate')}: {report.date || new Date().toISOString().split('T')[0]}</Text>
            <Text style={styles.receiptBrand}>{t('appName')}</Text>
          </View>

          {/* NET PROFIT HIGHLIGHT HERO */}
          <View style={styles.netProfitHero}>
            <Text style={styles.netProfitHeroLabel}>{t('netProfit')}</Text>
            <Text style={styles.netProfitHeroValue}>₹{report.net_profit || 0}</Text>
            <View style={styles.marginTag}>
              <Text style={styles.marginTagText}>
                {t('profitMargin')}: {report.profit_margin_pct || 0}%
              </Text>
            </View>
          </View>

          {/* FINANCIAL SUMMARY TABLE */}
          <View style={styles.card}>
            <Text style={styles.cardHeading}>{t('financialSummary')}</Text>

            <View style={styles.summaryRow}>
              <Text style={styles.rowLabel}>{t('revenue')}</Text>
              <Text style={[styles.rowVal, { color: THEME.colors.salesBlue }]}>
                ₹{report.total_sales_revenue || 0}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.rowLabel}>{t('cogs')}</Text>
              <Text style={styles.rowVal}>-₹{report.total_cost_of_goods_sold || 0}</Text>
            </View>

            <View style={[styles.summaryRow, styles.subtotalRow]}>
              <Text style={styles.subtotalLabel}>{t('grossProfit')}</Text>
              <Text style={styles.subtotalVal}>₹{report.gross_profit || 0}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.rowLabel}>{t('totalExpenses')}</Text>
              <Text style={styles.rowVal}>-₹{report.total_daily_expenses || 0}</Text>
            </View>
          </View>

          {/* PAYMENT COLLECTIONS CARD */}
          <View style={styles.card}>
            <Text style={styles.cardHeading}>{t('paymentsTitle')}</Text>

            <View style={styles.paymentGrid}>
              <View style={styles.paymentBox}>
                <Text style={styles.paymentBoxLabel}>{t('cashCollected')}</Text>
                <Text style={styles.paymentBoxVal}>₹{report.cash_collection || 0}</Text>
              </View>
              <View style={styles.paymentBox}>
                <Text style={styles.paymentBoxLabel}>{t('upiCollected')}</Text>
                <Text style={[styles.paymentBoxVal, { color: THEME.colors.salesBlue }]}>
                  ₹{report.upi_collection || 0}
                </Text>
              </View>
            </View>

            {(report.other_digital_collection > 0 || report.pending_credit > 0) && (
              <View style={[styles.paymentGrid, { marginTop: 10 }]}>
                <View style={styles.paymentBox}>
                  <Text style={styles.paymentBoxLabel}>{t('otherDigital')}</Text>
                  <Text style={styles.paymentBoxVal}>₹{report.other_digital_collection || 0}</Text>
                </View>
                <View style={styles.paymentBox}>
                  <Text style={[styles.paymentBoxLabel, { color: '#E65100' }]}>{t('creditPending')}</Text>
                  <Text style={[styles.paymentBoxVal, { color: '#E65100' }]}>
                    ₹{report.pending_credit || 0}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* INVENTORY & WASTAGE (SEPARATED CLEARLY) */}
          <View style={styles.inventoryCard}>
            <View style={styles.inventoryRow}>
              <View style={styles.inventoryCol}>
                <MaterialCommunityIcons name="cube-outline" size={26} color="#00838F" />
                <Text style={styles.inventoryLabel}>{t('unsoldStockValue')}</Text>
                <Text style={styles.inventoryAmount}>₹{report.total_unsold_stock_value || 0}</Text>
                <Text style={styles.inventoryNote}>
                  {language === 'ta' ? 'அடுத்த நாளுக்கான இருப்பு (சொத்து)' : 'Carried forward (Asset)'}
                </Text>
              </View>

              <View style={[styles.inventoryCol, { borderLeftWidth: 1, borderLeftColor: '#E5E7EB' }]}>
                <MaterialCommunityIcons name="alert-decagram" size={26} color={THEME.colors.loss} />
                <Text style={[styles.inventoryLabel, { color: THEME.colors.loss }]}>
                  {t('wastageLoss')}
                </Text>
                <Text style={[styles.inventoryAmount, { color: THEME.colors.loss }]}>
                  ₹{report.total_wastage_loss || 0}
                </Text>
                <Text style={styles.inventoryNote}>
                  {language === 'ta' ? 'அழுகிய / சேதமடைந்த நஷ்டம்' : 'Actual Spoilage Loss'}
                </Text>
              </View>
            </View>
            <Text style={styles.auditNotice}>{t('inventoryWastageNotice')}</Text>
          </View>

          {/* BEST & LOWEST SELLING PRODUCTS */}
          <View style={styles.card}>
            <Text style={styles.cardHeading}>{t('performanceHighlights')}</Text>
            {report.best_selling_products && report.best_selling_products.length > 0 && (
              <View style={styles.highlightItem}>
                <MaterialCommunityIcons name="trophy" size={22} color="#F57F17" />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.highlightLabel}>{t('bestSeller')}:</Text>
                  <Text style={styles.highlightValue}>
                    {language === 'ta' ? report.best_selling_products[0].item_name_ta : report.best_selling_products[0].item_name_en}
                    {' '}(₹{report.best_selling_products[0].revenue})
                  </Text>
                </View>
              </View>
            )}

            {report.lowest_selling_products && report.lowest_selling_products.length > 0 && (
              <View style={[styles.highlightItem, { marginTop: 8 }]}>
                <MaterialCommunityIcons name="arrow-down-bold-circle-outline" size={22} color="#757575" />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.highlightLabel}>{t('lowestSeller')}:</Text>
                  <Text style={styles.highlightValue}>
                    {language === 'ta' ? report.lowest_selling_products[0].item_name_ta : report.lowest_selling_products[0].item_name_en}
                    {' '}(₹{report.lowest_selling_products[0].revenue})
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* PRODUCT-WISE SALES BREAKDOWN TABLE */}
          {report.items_breakdown && report.items_breakdown.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardHeading}>{t('productWiseDetails')}</Text>

              {report.items_breakdown.map((item, idx) => (
                <View key={idx} style={styles.tableRow}>
                  <View style={{ flex: 2 }}>
                    <Text style={styles.tableItemName}>
                      {language === 'ta' ? item.name_ta : item.name_en}
                    </Text>
                    <Text style={styles.tableItemSub}>
                      {item.quantity_sold} {item.unit} @ ₹{item.selling_price}
                    </Text>
                  </View>
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={styles.tableItemRev}>₹{item.revenue}</Text>
                    <Text style={styles.tableItemProfit}>+{t('rs')}{Math.round(item.gross_profit)}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* AI SALES INSIGHTS SECTION */}
          <View style={styles.insightsCard}>
            <View style={styles.insightsHeaderRow}>
              <MaterialCommunityIcons name="robot" size={26} color="#4A148C" />
              <View style={{ flex: 1 }}>
                <Text style={styles.insightsHeading}>{t('aiInsightsTitle')}</Text>
              </View>
              <TouchableOpacity
                onPress={handleSpeakInsights}
                style={styles.speakInsightsBtn}
              >
                <MaterialCommunityIcons name="volume-high" size={20} color="#FFFFFF" />
                <Text style={styles.speakInsightsBtnText}>{t('speakInsights')}</Text>
              </TouchableOpacity>
            </View>

            {loadingInsights ? (
              <ActivityIndicator size="small" color="#4A148C" style={{ marginVertical: 20 }} />
            ) : insights ? (
              <View style={styles.insightsContent}>
                {/* Stocking Advice */}
                {insights.stocking_suggestions && (
                  <View style={styles.insightBlock}>
                    <Text style={styles.insightBlockTitle}>📦 {t('stockAdviceTitle')}</Text>
                    {insights.stocking_suggestions.map((st, i) => (
                      <Text key={i} style={styles.insightBullet}>
                        • {language === 'ta' ? st.item_name_ta : st.item_name_en}: {language === 'ta' ? st.reason_ta : st.reason_en}
                      </Text>
                    ))}
                  </View>
                )}

                {/* Tomorrow Expected Demand Forecast */}
                {insights.tomorrow_demand_forecast && (
                  <View style={styles.insightBlock}>
                    <Text style={styles.insightBlockTitle}>📈 {t('expectedDemandTitle')}</Text>
                    {insights.tomorrow_demand_forecast.map((df, i) => (
                      <Text key={i} style={styles.insightBullet}>
                        • {language === 'ta' ? df.item_name_ta : df.item_name_en}: {df.expected_demand_kg} kg ({language === 'ta' ? df.reason_ta : df.reason_en})
                      </Text>
                    ))}
                  </View>
                )}

                {/* Wastage Reduction Tips */}
                {insights.wastage_reduction_tips && (
                  <View style={styles.insightBlock}>
                    <Text style={styles.insightBlockTitle}>🛡️ {t('wastageReductionTitle')}</Text>
                    {insights.wastage_reduction_tips.map((wr, i) => (
                      <Text key={i} style={styles.insightBullet}>
                        • {language === 'ta' ? wr.tip_ta : wr.tip_en}
                      </Text>
                    ))}
                  </View>
                )}

                {/* Promo Combos */}
                {insights.promotional_offers && (
                  <View style={styles.insightBlock}>
                    <Text style={styles.insightBlockTitle}>🏷️ {t('promoOffersTitle')}</Text>
                    {insights.promotional_offers.map((po, i) => (
                      <Text key={i} style={styles.insightBullet}>
                        • {language === 'ta' ? po.offer_title_ta : po.offer_title_en}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            ) : null}
          </View>

          {/* BOTTOM ACTIONS */}
          <View style={styles.actionRow}>
            {onRevisitReports && (
              <TouchableOpacity
                onPress={() => {
                  onClose();
                  onRevisitReports();
                }}
                style={styles.revisitBtn}
              >
                <MaterialCommunityIcons name="history" size={20} color={THEME.colors.primary} />
                <Text style={styles.revisitBtnText}>{t('revisitPreviousReports')}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={onClose} style={styles.doneBtn}>
              <Text style={styles.doneBtnText}>{t('close')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.bg
  },
  topBar: {
    backgroundColor: THEME.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14
  },
  closeBtn: {
    padding: 6
  },
  topBarTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF'
  },
  speakHeaderBtn: {
    padding: 6
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40
  },
  receiptHeader: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 18,
    borderRadius: THEME.borderRadius.lg,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    marginBottom: 14
  },
  reportDateText: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.textDark,
    marginTop: 8
  },
  receiptBrand: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    marginTop: 2
  },
  netProfitHero: {
    backgroundColor: THEME.colors.primaryBg,
    borderRadius: THEME.borderRadius.lg,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: THEME.colors.primary,
    marginBottom: 14
  },
  netProfitHeroLabel: {
    fontSize: 18,
    fontWeight: '900',
    color: THEME.colors.primary
  },
  netProfitHeroValue: {
    fontSize: 38,
    fontWeight: '900',
    color: THEME.colors.primary,
    marginVertical: 4
  },
  marginTag: {
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14
  },
  marginTagText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.md,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    marginBottom: 14,
    elevation: 2
  },
  cardHeading: {
    fontSize: 16,
    fontWeight: '900',
    color: THEME.colors.textDark,
    marginBottom: 12
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.textMuted
  },
  rowVal: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.textDark
  },
  subtotalRow: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F3F4F6',
    marginVertical: 4,
    paddingVertical: 8
  },
  subtotalLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.textDark
  },
  subtotalVal: {
    fontSize: 16,
    fontWeight: '900',
    color: THEME.colors.primary
  },
  paymentGrid: {
    flexDirection: 'row',
    gap: 12
  },
  paymentBox: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: THEME.borderRadius.sm,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  paymentBoxLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textMuted
  },
  paymentBoxVal: {
    fontSize: 18,
    fontWeight: '900',
    color: THEME.colors.textDark,
    marginTop: 4
  },
  inventoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.md,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    marginBottom: 14
  },
  inventoryRow: {
    flexDirection: 'row'
  },
  inventoryCol: {
    flex: 1,
    alignItems: 'center',
    padding: 8
  },
  inventoryLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#00838F',
    marginTop: 6,
    textAlign: 'center'
  },
  inventoryAmount: {
    fontSize: 20,
    fontWeight: '900',
    color: '#00838F',
    marginVertical: 2
  },
  inventoryNote: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center'
  },
  auditNotice: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic'
  },
  highlightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFDE7',
    padding: 10,
    borderRadius: THEME.borderRadius.sm,
    borderWidth: 1,
    borderColor: '#FFF59D'
  },
  highlightLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F57F17'
  },
  highlightValue: {
    fontSize: 15,
    fontWeight: '900',
    color: THEME.colors.textDark
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  tableItemName: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.textDark
  },
  tableItemSub: {
    fontSize: 12,
    color: '#6B7280'
  },
  tableItemRev: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.textDark
  },
  tableItemProfit: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.primary
  },
  insightsCard: {
    backgroundColor: '#F3E5F5',
    borderRadius: THEME.borderRadius.lg,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#CE93D8',
    marginBottom: 20
  },
  insightsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12
  },
  insightsHeading: {
    fontSize: 17,
    fontWeight: '900',
    color: '#4A148C'
  },
  speakInsightsBtn: {
    backgroundColor: '#4A148C',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  speakInsightsBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800'
  },
  insightsContent: {
    gap: 12
  },
  insightBlock: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.sm,
    padding: 12
  },
  insightBlockTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4A148C',
    marginBottom: 4
  },
  insightBullet: {
    fontSize: 13,
    color: THEME.colors.textDark,
    lineHeight: 18,
    marginTop: 2
  },
  actionRow: {
    gap: 12,
    marginTop: 4
  },
  revisitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: THEME.colors.primary,
    borderRadius: THEME.borderRadius.md,
    paddingVertical: 14,
    gap: 8
  },
  revisitBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.primary
  },
  doneBtn: {
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.borderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  doneBtnText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF'
  }
});
