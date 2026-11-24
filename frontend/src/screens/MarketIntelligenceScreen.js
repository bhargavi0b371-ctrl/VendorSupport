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
import { api, API_BASE_URL } from '../api/client';
import { Header } from '../components/Header';
import { MandiPriceCard } from '../components/MandiPriceCard';
import { PriceTrendChart } from '../components/PriceTrendChart';
import { ExplainableReasoningCard } from '../components/ExplainableReasoningCard';

export const MarketIntelligenceScreen = ({ onNavigate }) => {
  const { t, language } = useLanguage();
  const { speak } = useVoice();

  // Active sub-tab: 'mandis' | 'prediction' | 'trends'
  const [activeTab, setActiveTab] = useState('mandis');

  // Common selections
  const [selectedCommodity, setSelectedCommodity] = useState('tomato');
  const [selectedDistrict, setSelectedDistrict] = useState('Chennai');
  const [commodities, setCommodities] = useState([]);

  // Data states
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [comparisonData, setComparisonData] = useState(null);
  const [predictionData, setPredictionData] = useState(null);
  const [trendData, setTrendData] = useState(null);
  const [trendDays, setTrendDays] = useState(30);
  const [alerts, setAlerts] = useState([]);
  const [syncStatusMsg, setSyncStatusMsg] = useState('');

  const DISTRICT_OPTIONS = ['Chennai', 'Chengalpattu', 'Tiruvallur', 'Madurai', 'Coimbatore'];

  const COMMODITY_OPTIONS = [
    { key: 'tomato', nameEn: 'Tomato', nameTa: 'தக்காளி', icon: 'food-apple' },
    { key: 'onion', nameEn: 'Onion', nameTa: 'வெங்காயம்', icon: 'circle-outline' },
    { key: 'potato', nameEn: 'Potato', nameTa: 'உருளைக்கிழங்கு', icon: 'circle-slice-8' },
    { key: 'green_chilli', nameEn: 'Chilli', nameTa: 'பச்சை மிளகாய்', icon: 'chili-mild' },
    { key: 'ginger', nameEn: 'Ginger', nameTa: 'இஞ்சி', icon: 'seed' },
    { key: 'coriander', nameEn: 'Coriander', nameTa: 'கொத்தமல்லி', icon: 'leaf' },
    { key: 'carrot', nameEn: 'Carrot', nameTa: 'கேரட்', icon: 'carrot' },
    { key: 'brinjal', nameEn: 'Brinjal', nameTa: 'கத்தரிக்காய்', icon: 'eggplant' }
  ];

  useEffect(() => {
    loadAllData();
  }, [selectedCommodity, selectedDistrict, trendDays]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      // 1. Fetch comparative prices across nearby mandis
      const compRes = await api._request(`/api/intelligence/prices/compare?commodity=${selectedCommodity}`);
      setComparisonData(compRes);

      // 2. Fetch AI selling price prediction
      const predRes = await api._request('/api/prediction/recommend-selling-price', {
        method: 'POST',
        body: JSON.stringify({ commodity_key: selectedCommodity })
      });
      setPredictionData(predRes);

      // 3. Fetch historical trend analysis
      const trendRes = await api._request(`/api/intelligence/trends/${selectedCommodity}?days=${trendDays}`);
      setTrendData(trendRes);

      // 4. Fetch price alerts
      const alertsRes = await api._request('/api/intelligence/alerts');
      setAlerts(alertsRes || []);
    } catch (e) {
      console.warn("Failed to load intelligence data", e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const syncRes = await api._request('/api/intelligence/sync-live-bulletin', { method: 'POST' });
      setSyncStatusMsg(syncRes.message || 'Synced successfully');
      await loadAllData();
    } catch (e) {
      console.warn("Sync failed", e);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={styles.screen}>
      <Header
        title={language === 'ta' ? 'சந்தை நுண்ணறிவு & கணிப்பு' : 'Market Intelligence & Prediction'}
        showBack
        onBack={() => onNavigate('home')}
      />

      {/* 3 TOP SUB-TABS */}
      <View style={styles.subTabsRow}>
        <TouchableOpacity
          onPress={() => setActiveTab('mandis')}
          style={[styles.subTabBtn, activeTab === 'mandis' && styles.subTabBtnActive]}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons
            name="storefront-outline"
            size={18}
            color={activeTab === 'mandis' ? THEME.colors.primary : '#6B7280'}
          />
          <Text style={[styles.subTabLabel, activeTab === 'mandis' && styles.subTabLabelActive]}>
            {language === 'ta' ? 'சந்தை விலை' : 'Mandi Rates'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('prediction')}
          style={[styles.subTabBtn, activeTab === 'prediction' && styles.subTabBtnActive]}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons
            name="calculator-variant"
            size={18}
            color={activeTab === 'prediction' ? THEME.colors.primary : '#6B7280'}
          />
          <Text style={[styles.subTabLabel, activeTab === 'prediction' && styles.subTabLabelActive]}>
            {language === 'ta' ? 'AI கணிப்பு' : 'AI Prediction'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('trends')}
          style={[styles.subTabBtn, activeTab === 'trends' && styles.subTabBtnActive]}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons
            name="chart-timeline-variant"
            size={18}
            color={activeTab === 'trends' ? THEME.colors.primary : '#6B7280'}
          />
          <Text style={[styles.subTabLabel, activeTab === 'trends' && styles.subTabLabelActive]}>
            {language === 'ta' ? 'விலை போக்கு' : 'Price Trends'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* COMMODITY HORIZONTAL SELECTOR PILLS */}
        <View style={styles.selectorSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsScroll}>
            {COMMODITY_OPTIONS.map((c) => {
              const isSelected = selectedCommodity === c.key;
              const name = language === 'ta' ? c.nameTa : c.nameEn;
              return (
                <TouchableOpacity
                  key={c.key}
                  onPress={() => setSelectedCommodity(c.key)}
                  style={[styles.pill, isSelected && styles.pillActive]}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name={c.icon}
                    size={16}
                    color={isSelected ? '#FFFFFF' : '#374151'}
                  />
                  <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>
                    {name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* SIGNIFICANT PRICE ALERTS BANNER (IF ANY) */}
        {alerts && alerts.length > 0 && (
          <View style={styles.alertCard}>
            <View style={styles.alertHeaderRow}>
              <MaterialCommunityIcons name="bell-ring" size={20} color="#DC2626" />
              <Text style={styles.alertHeaderText}>
                {language === 'ta' ? 'முக்கிய விலை மாற்றங்கள் (Price Alerts)' : 'Significant Market Alerts'}
              </Text>
            </View>
            {alerts.slice(0, 2).map((a) => (
              <Text key={a.id} style={styles.alertMessage}>
                • {language === 'ta' ? a.message_ta : a.message_en}
              </Text>
            ))}
          </View>
        )}

        {loading ? (
          <ActivityIndicator size="large" color={THEME.colors.primary} style={{ marginTop: 24 }} />
        ) : (
          <>
            {/* 1. LOCATION-BASED MANDI RATES TAB */}
            {activeTab === 'mandis' && (
              <View>
                {/* District Switcher Row */}
                <View style={styles.districtBar}>
                  <Text style={styles.districtBarLabel}>
                    {language === 'ta' ? 'மாவட்டம்:' : 'District:'}
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    {DISTRICT_OPTIONS.map((d) => (
                      <TouchableOpacity
                        key={d}
                        onPress={() => setSelectedDistrict(d)}
                        style={[styles.districtChip, selectedDistrict === d && styles.districtChipActive]}
                      >
                        <Text style={[styles.districtChipText, selectedDistrict === d && styles.districtChipTextActive]}>
                          {d}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Mandi Price Comparison List */}
                {comparisonData && comparisonData.prices && comparisonData.prices.length > 0 ? (
                  comparisonData.prices.map((p) => (
                    <MandiPriceCard
                      key={p.market_id}
                      priceItem={p}
                      isBestDeal={p.market_id === comparisonData.best_market_id}
                    />
                  ))
                ) : (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyText}>
                      {language === 'ta' ? 'இன்றைய விலை விவரங்கள் கிடைக்கவில்லை' : 'No market rates available for this vegetable today.'}
                    </Text>
                  </View>
                )}

                {/* Refresh Trigger Action */}
                <TouchableOpacity onPress={onRefresh} style={styles.refreshActionBtn} activeOpacity={0.8}>
                  <MaterialCommunityIcons name="cloud-sync" size={20} color="#FFFFFF" />
                  <Text style={styles.refreshActionText}>
                    {language === 'ta' ? 'சந்தை விலைகளை புதுப்பிக்கவும்' : 'Refresh AGMARKNET Rates'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* 2. AI SELLING PRICE PREDICTION TAB */}
            {activeTab === 'prediction' && (
              <View>
                {predictionData && <ExplainableReasoningCard prediction={predictionData} />}

                {/* Fast Action to Apply */}
                {predictionData && (
                  <TouchableOpacity
                    onPress={() => {
                      speak(
                        language === 'ta'
                          ? `${predictionData.commodity_name_ta} விற்பனை விலை ₹${predictionData.recommended_price} உறுதி செய்யப்பட்டது.`
                          : `Selling price for ${predictionData.commodity_name_en} set to ₹${predictionData.recommended_price}.`
                      );
                      Alert.alert(
                        language === 'ta' ? 'விலை உறுதி செய்யப்பட்டது' : 'Selling Price Selected',
                        language === 'ta'
                          ? `₹${predictionData.recommended_price} விற்பனை விலை உங்கள் பதிவுக்கு தேர்ந்தெடுக்கப்பட்டது.`
                          : `₹${predictionData.recommended_price} is ready for logging in Daily Sales.`
                      );
                    }}
                    style={styles.applyBtn}
                    activeOpacity={0.85}
                  >
                    <MaterialCommunityIcons name="check-circle" size={22} color="#FFFFFF" />
                    <Text style={styles.applyBtnText}>
                      {language === 'ta' ? 'இந்த விலையை விற்பனைக்கு ஏற்கவும்' : 'Apply Recommended Price'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* 3. PRICE TREND ANALYSIS TAB */}
            {activeTab === 'trends' && (
              <View>
                {/* Period Selector (7d, 14d, 30d) */}
                <View style={styles.daysSelectorRow}>
                  {[7, 14, 30].map((d) => (
                    <TouchableOpacity
                      key={d}
                      onPress={() => setTrendDays(d)}
                      style={[styles.dayChip, trendDays === d && styles.dayChipActive]}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.dayChipText, trendDays === d && styles.dayChipTextActive]}>
                        {d} {language === 'ta' ? 'நாட்கள்' : 'Days'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {trendData && <PriceTrendChart trendData={trendData} />}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: THEME.colors.bg
  },
  subTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1.5,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  subTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent'
  },
  subTabBtnActive: {
    borderBottomColor: THEME.colors.primary
  },
  subTabLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280'
  },
  subTabLabelActive: {
    color: THEME.colors.primary,
    fontWeight: '900'
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 36
  },
  selectorSection: {
    marginBottom: 12
  },
  pillsScroll: {
    gap: 8,
    paddingVertical: 2
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#D1D5DB'
  },
  pillActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary
  },
  pillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#374151'
  },
  pillTextActive: {
    color: '#FFFFFF'
  },
  alertCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14
  },
  alertHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6
  },
  alertHeaderText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#991B1B'
  },
  alertMessage: {
    fontSize: 12,
    color: '#7F1D1D',
    lineHeight: 18,
    fontWeight: '600',
    marginTop: 2
  },
  districtBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  districtBarLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#374151',
    marginRight: 8,
    marginLeft: 4
  },
  districtChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F3F4F6'
  },
  districtChipActive: {
    backgroundColor: '#DCFCE7'
  },
  districtChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4B5563'
  },
  districtChipTextActive: {
    color: '#15803D',
    fontWeight: '900'
  },
  daysSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12
  },
  dayChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D1D5DB'
  },
  dayChipActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary
  },
  dayChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563'
  },
  dayChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '900'
  },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.primary,
    paddingVertical: 14,
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    marginTop: 4
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800'
  },
  refreshActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0277BD',
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 8
  },
  refreshActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800'
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  emptyText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600'
  }
});
