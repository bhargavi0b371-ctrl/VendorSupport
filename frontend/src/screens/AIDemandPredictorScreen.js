import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { useVoice } from '../hooks/useVoice';
import { api } from '../api/client';
import { Header } from '../components/Header';

export const AIDemandPredictorScreen = ({ onNavigate }) => {
  const { t, language } = useLanguage();
  const { speak } = useVoice();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [retraining, setRetraining] = useState(false);
  const [overview, setOverview] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    loadForecast();
  }, []);

  const loadForecast = async () => {
    setLoading(true);
    setStatusMsg('');
    try {
      const data = await api.getDemandForecast();
      setOverview(data);
      if (data.products && data.products.length > 0) {
        // Keep selected product if still in list, else pick first
        setSelectedProduct(prev => {
          if (prev) {
            const found = data.products.find(p => p.product_id === prev.product_id);
            if (found) return found;
          }
          return data.products[0];
        });
      }
    } catch (e) {
      console.warn("Failed to load demand forecast", e);
      setStatusMsg(language === 'ta' ? 'கணிப்பை ஏற்றுவதில் பிழை' : 'Failed to load forecast');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadForecast();
  };

  const handleRetrain = async () => {
    setRetraining(true);
    try {
      const res = await api.retrainDemandModels();
      const msgEn = `Retraining complete: ${res.trained_products_count} models trained, ${res.skipped_products_count} skipped (insufficient history).`;
      const msgTa = `பயிற்சி முடிந்தது: ${res.trained_products_count} மாடல்கள் தயார், ${res.skipped_products_count} பொருட்கள் காத்திருப்பில் (குறைந்த தரவு).`;
      Alert.alert(language === 'ta' ? 'AI மறுபயிற்சி' : 'AI Model Retrain', language === 'ta' ? msgTa : msgEn);
      await loadForecast();
    } catch (e) {
      Alert.alert(language === 'ta' ? 'பிழை' : 'Error', language === 'ta' ? 'மறுபயிற்சி தோல்வியடைந்தது' : 'Retraining failed');
    } finally {
      setRetraining(false);
    }
  };

  const speakProductForecast = (prod) => {
    if (!prod) return;
    const name = language === 'ta' ? prod.product_name_ta : prod.product_name_en;
    const rec = language === 'ta' ? prod.recommendation_ta : prod.recommendation_en;
    const msg = language === 'ta'
      ? `${name} நாளைக்கான கணிக்கப்பட்ட தேவை ${prod.tomorrow_predicted_demand} ${prod.unit}. ${rec}`
      : `${name} tomorrow's predicted demand is ${prod.tomorrow_predicted_demand} ${prod.unit}. ${rec}`;
    speak(msg, language);
  };

  // Helper to render simple chart bars for sales vs prediction
  const renderSimpleChart = (prod) => {
    if (!prod) return null;
    const actuals = prod.recent_actual_sales || [];
    const forecasts = prod.forecast_7_days || [];

    const allVals = [
      ...actuals.map(a => a.quantity_sold),
      ...forecasts.map(f => f.predicted_demand)
    ];
    const maxVal = Math.max(...allVals, 1.0);

    return (
      <View style={styles.chartContainer}>
        <View style={styles.chartHeaderRow}>
          <Text style={styles.chartTitle}>{t('chartTitle') || "Sales vs Predicted Demand"}</Text>
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendColorBox, { backgroundColor: '#3B82F6' }]} />
              <Text style={styles.legendText}>{language === 'ta' ? 'விற்பனை' : 'Actual'}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColorBox, { backgroundColor: '#10B981' }]} />
              <Text style={styles.legendText}>{language === 'ta' ? 'கணிப்பு' : 'Forecast'}</Text>
            </View>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.barsScroll}>
          {/* Past actuals */}
          {actuals.map((act, idx) => {
            const hPct = Math.min(100, Math.max(12, Math.round((act.quantity_sold / maxVal) * 100)));
            return (
              <View key={`act-${idx}`} style={styles.barCol}>
                <Text style={styles.barValText}>{act.quantity_sold}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFillActual, { height: `${hPct}%` }]} />
                </View>
                <Text style={styles.barLabelText}>{act.date ? act.date.slice(5) : ''}</Text>
                <Text style={styles.barSubLabel}>{language === 'ta' ? 'விற்றது' : 'Sold'}</Text>
              </View>
            );
          })}

          {/* Divider */}
          {actuals.length > 0 && <View style={styles.chartDivider} />}

          {/* Future predictions */}
          {forecasts.map((fc, idx) => {
            const hPct = Math.min(100, Math.max(12, Math.round((fc.predicted_demand / maxVal) * 100)));
            return (
              <View key={`fc-${idx}`} style={styles.barCol}>
                <Text style={styles.barValText}>{fc.predicted_demand}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFillForecast, { height: `${hPct}%` }]} />
                </View>
                <Text style={styles.barLabelText}>{fc.day_name || fc.date.slice(5)}</Text>
                <Text style={[styles.barSubLabel, { color: '#059669' }]}>
                  {fc.is_festival ? '★ Fest' : (idx === 0 ? (language === 'ta' ? 'நாளை' : 'Tmrw') : `+${idx+1}d`)}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <Header title={t('demandPredictorTitle')} showBack onBack={() => onNavigate('home')} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* BANNER / STATUS OVERVIEW */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryTitle}>{t('demandPredictorTitle')}</Text>
              <Text style={styles.summarySubtitle}>{t('demandPredictorSubtitle')}</Text>
            </View>
            <TouchableOpacity
              style={styles.retrainBtn}
              onPress={handleRetrain}
              disabled={retraining}
              activeOpacity={0.8}
            >
              {retraining ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialCommunityIcons name="brain" size={18} color="#FFFFFF" />
                  <Text style={styles.retrainBtnText}>{t('retrainModelsBtn') || "Retrain AI"}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {overview && (
            <View style={styles.metricsBadgeRow}>
              <View style={styles.badgeItem}>
                <Text style={styles.badgeVal}>{overview.total_products_tracked}</Text>
                <Text style={styles.badgeLbl}>{language === 'ta' ? 'பொருட்கள்' : 'Products'}</Text>
              </View>
              <View style={styles.badgeItem}>
                <Text style={[styles.badgeVal, { color: '#059669' }]}>{overview.ml_models_active}</Text>
                <Text style={styles.badgeLbl}>{language === 'ta' ? 'AI மாடல்கள்' : 'ML Active'}</Text>
              </View>
              <View style={styles.badgeItem}>
                <Text style={[styles.badgeVal, { color: '#D97706' }]}>{overview.baseline_products}</Text>
                <Text style={styles.badgeLbl}>{language === 'ta' ? 'வரலாற்று சராசரி' : 'Baseline'}</Text>
              </View>
            </View>
          )}
        </View>

        {loading && !overview && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={THEME.colors.primary} />
            <Text style={styles.loadingText}>{t('loading')}</Text>
          </View>
        )}

        {/* HORIZONTAL PRODUCT SELECTOR */}
        {overview && overview.products && overview.products.length > 0 && (
          <View style={styles.productPillWrapper}>
            <Text style={styles.sectionHeader}>{language === 'ta' ? 'பொருள் தேர்வு செய்யவும்:' : 'Select Product:'}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productPillRow}>
              {overview.products.map((prod) => {
                const isSelected = selectedProduct?.product_id === prod.product_id;
                const name = language === 'ta' ? prod.product_name_ta : prod.product_name_en;
                return (
                  <TouchableOpacity
                    key={`prod-${prod.product_id}`}
                    style={[styles.productPill, isSelected && styles.productPillActive]}
                    onPress={() => setSelectedProduct(prod)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.productPillText, isSelected && styles.productPillTextActive]}>
                      {name}
                    </Text>
                    {prod.is_ml_trained ? (
                      <View style={styles.mlDot} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* SELECTED PRODUCT FORECAST CARD */}
        {selectedProduct && (
          <View style={styles.detailCard}>
            {/* Header with audio speaker */}
            <View style={styles.detailHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailTitle}>
                  {language === 'ta' ? selectedProduct.product_name_ta : selectedProduct.product_name_en}
                </Text>
                <Text style={styles.detailCategory}>
                  {selectedProduct.category} • {selectedProduct.unit}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.speakerBtn}
                onPress={() => speakProductForecast(selectedProduct)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="volume-high" size={24} color="#1565C0" />
              </TouchableOpacity>
            </View>

            {/* Model Tag */}
            <View style={styles.tagRow}>
              {selectedProduct.is_ml_trained ? (
                <View style={[styles.statusTag, styles.statusTagML]}>
                  <MaterialCommunityIcons name="check-decagram" size={16} color="#059669" />
                  <Text style={styles.statusTagTextML}>{t('mlActiveTag') || "RandomForest ML Active"}</Text>
                </View>
              ) : (
                <View style={[styles.statusTag, styles.statusTagBaseline]}>
                  <MaterialCommunityIcons name="chart-bell-curve" size={16} color="#D97706" />
                  <Text style={styles.statusTagTextBaseline}>{t('baselineTag') || "Historical Baseline"}</Text>
                </View>
              )}

              <View style={styles.obsBadge}>
                <Text style={styles.obsBadgeText}>
                  {selectedProduct.observations_count} {t('observations') || "Observations"}
                </Text>
              </View>
            </View>

            {/* Method / Data Notice Box */}
            <View style={[styles.noticeBox, selectedProduct.is_ml_trained ? styles.noticeBoxML : styles.noticeBoxWarning]}>
              <MaterialCommunityIcons
                name={selectedProduct.is_ml_trained ? "robot" : "alert-circle-outline"}
                size={20}
                color={selectedProduct.is_ml_trained ? "#059669" : "#B45309"}
                style={{ marginTop: 2 }}
              />
              <Text style={[styles.noticeText, { color: selectedProduct.is_ml_trained ? "#065F46" : "#92400E" }]}>
                {language === 'ta' ? selectedProduct.status_message_ta : selectedProduct.status_message_en}
              </Text>
            </View>

            {/* 4 CORE KPI METRICS */}
            <View style={styles.kpiGrid}>
              <View style={styles.kpiBox}>
                <Text style={styles.kpiLabel}>{t('tomorrowDemand')}</Text>
                <Text style={[styles.kpiValue, { color: '#1E40AF' }]}>
                  {selectedProduct.tomorrow_predicted_demand}
                  <Text style={styles.kpiUnit}> {selectedProduct.unit}</Text>
                </Text>
                <Text style={styles.kpiSub}>
                  {selectedProduct.trend === 'increasing' ? '▲ Upward' : (selectedProduct.trend === 'decreasing' ? '▼ Downward' : '● Steady')}
                </Text>
              </View>

              <View style={styles.kpiBox}>
                <Text style={styles.kpiLabel}>{t('suggestedPurchase')}</Text>
                <Text style={[styles.kpiValue, { color: '#047857' }]}>
                  {selectedProduct.suggested_purchase_quantity}
                  <Text style={styles.kpiUnit}> {selectedProduct.unit}</Text>
                </Text>
                <Text style={styles.kpiSub}>
                  {language === 'ta' ? `இருப்பு: ${selectedProduct.current_unsold_stock}` : `Stock: ${selectedProduct.current_unsold_stock}`}
                </Text>
              </View>

              <View style={styles.kpiBox}>
                <Text style={styles.kpiLabel}>{t('next7DaysDemand')}</Text>
                <Text style={styles.kpiValue}>
                  {selectedProduct.next_7_days_total_demand}
                  <Text style={styles.kpiUnit}> {selectedProduct.unit}</Text>
                </Text>
                <Text style={styles.kpiSub}>{language === 'ta' ? 'அடுத்த 7 நாட்கள்' : '7-day sum'}</Text>
              </View>

              <View style={styles.kpiBox}>
                <Text style={styles.kpiLabel}>{t('historicalAvg')}</Text>
                <Text style={styles.kpiValue}>
                  {selectedProduct.historical_avg_daily_sales}
                  <Text style={styles.kpiUnit}> {selectedProduct.unit}</Text>
                </Text>
                <Text style={styles.kpiSub}>{language === 'ta' ? 'தினசரி சராசரி' : 'Daily baseline'}</Text>
              </View>
            </View>

            {/* ACTIONABLE RECOMMENDATION CARD */}
            <View style={styles.recommendationCard}>
              <View style={styles.recIconWrap}>
                <MaterialCommunityIcons
                  name={selectedProduct.trend === 'increasing' ? 'trending-up' : (selectedProduct.trend === 'decreasing' ? 'trending-down' : 'lightbulb-on-outline')}
                  size={24}
                  color="#1565C0"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.recTitle}>{language === 'ta' ? 'கொள்முதல் வழிகாட்டல்' : 'Purchasing Advice'}</Text>
                <Text style={styles.recDesc}>
                  {language === 'ta' ? selectedProduct.recommendation_ta : selectedProduct.recommendation_en}
                </Text>
              </View>
            </View>

            {/* VISUAL CHART */}
            {renderSimpleChart(selectedProduct)}

            {/* MODEL EVALUATION INFO (When ML is trained) */}
            {selectedProduct.is_ml_trained && (
              <View style={styles.evalCard}>
                <View style={styles.evalHeaderRow}>
                  <MaterialCommunityIcons name="chart-box-outline" size={20} color="#374151" />
                  <Text style={styles.evalTitle}>{t('modelEvaluationTitle') || "Model Evaluation & Accuracy"}</Text>
                </View>
                <View style={styles.evalGrid}>
                  <View style={styles.evalItem}>
                    <Text style={styles.evalLabel}>{t('evalMae') || "Test MAE"}</Text>
                    <Text style={styles.evalVal}>± {selectedProduct.mae} {selectedProduct.unit}</Text>
                  </View>
                  <View style={styles.evalItem}>
                    <Text style={styles.evalLabel}>{language === 'ta' ? 'மாடல் வகை' : 'Model'}</Text>
                    <Text style={styles.evalVal}>RandomForest (100 trees)</Text>
                  </View>
                  <View style={styles.evalItem}>
                    <Text style={styles.evalLabel}>{language === 'ta' ? 'பயிற்சி / சோதனை' : 'Split'}</Text>
                    <Text style={styles.evalVal}>{selectedProduct.train_test_split_info}</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {/* BOTTOM REFRESH BUTTON */}
        <TouchableOpacity style={styles.bottomRefreshBtn} onPress={handleRefresh} activeOpacity={0.8}>
          <MaterialCommunityIcons name="refresh" size={20} color="#1565C0" />
          <Text style={styles.bottomRefreshBtnText}>{t('refreshPredictions') || "Refresh Forecast"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F3F4F6'
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 2
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827'
  },
  summarySubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2
  },
  retrainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6
  },
  retrainBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  metricsBadgeRow: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 10,
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  badgeItem: {
    alignItems: 'center'
  },
  badgeVal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827'
  },
  badgeLbl: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2
  },
  loadingBox: {
    padding: 40,
    alignItems: 'center'
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#6B7280'
  },
  productPillWrapper: {
    marginBottom: 14
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8
  },
  productPillRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4
  },
  productPill: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  productPillActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary
  },
  productPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151'
  },
  productPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  mlDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981'
  },
  detailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 3,
    marginBottom: 16
  },
  detailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827'
  },
  detailCategory: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    textTransform: 'capitalize'
  },
  speakerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center'
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  statusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5
  },
  statusTagML: {
    backgroundColor: '#D1FAE5'
  },
  statusTagTextML: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46'
  },
  statusTagBaseline: {
    backgroundColor: '#FEF3C7'
  },
  statusTagTextBaseline: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E'
  },
  obsBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8
  },
  obsBadgeText: {
    fontSize: 11,
    color: '#4B5563',
    fontWeight: '600'
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    borderRadius: 10,
    gap: 8,
    marginBottom: 14
  },
  noticeBoxML: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0'
  },
  noticeBoxWarning: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A'
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14
  },
  kpiBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  kpiLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600'
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
    marginTop: 4
  },
  kpiUnit: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280'
  },
  kpiSub: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2
  },
  recommendationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 12,
    gap: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE'
  },
  recIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center'
  },
  recTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E40AF'
  },
  recDesc: {
    fontSize: 12,
    color: '#1E3A8A',
    marginTop: 2,
    lineHeight: 16
  },
  chartContainer: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 14
  },
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  chartTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151'
  },
  chartLegend: {
    flexDirection: 'row',
    gap: 10
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  legendColorBox: {
    width: 10,
    height: 10,
    borderRadius: 2
  },
  legendText: {
    fontSize: 11,
    color: '#6B7280'
  },
  barsScroll: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingVertical: 6,
    gap: 10
  },
  barCol: {
    alignItems: 'center',
    width: 38
  },
  barValText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#4B5563',
    marginBottom: 4
  },
  barTrack: {
    width: 18,
    height: 90,
    backgroundColor: '#E5E7EB',
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden'
  },
  barFillActual: {
    backgroundColor: '#3B82F6',
    borderRadius: 6
  },
  barFillForecast: {
    backgroundColor: '#10B981',
    borderRadius: 6
  },
  barLabelText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#374151',
    marginTop: 4
  },
  barSubLabel: {
    fontSize: 8,
    color: '#9CA3AF',
    marginTop: 1
  },
  chartDivider: {
    width: 1,
    height: 90,
    backgroundColor: '#D1D5DB',
    marginHorizontal: 4
  },
  evalCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  evalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8
  },
  evalTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151'
  },
  evalGrid: {
    gap: 4
  },
  evalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  evalLabel: {
    fontSize: 11,
    color: '#6B7280'
  },
  evalVal: {
    fontSize: 11,
    fontWeight: '700',
    color: '#111827'
  },
  bottomRefreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 6
  },
  bottomRefreshBtnText: {
    color: '#1565C0',
    fontSize: 14,
    fontWeight: '700'
  }
});
