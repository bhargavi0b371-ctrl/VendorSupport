import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { useVoice } from '../hooks/useVoice';
import { api } from '../api/client';
import { Header } from '../components/Header';

export const WhereToBuyScreen = ({ onNavigate }) => {
  const { t, language } = useLanguage();
  const { speak } = useVoice();
  const [items, setItems] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState(1);
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadItems = async () => {
    try {
      const itms = await api.getItems();
      setItems(itms);
      if (itms.length > 0) {
        setSelectedItemId(itms[0].id);
        await loadRankings(itms[0].id);
      }
    } catch (e) {
      console.warn("Failed to load items in where to buy", e);
    }
  };

  const loadRankings = async (itemId) => {
    setLoading(true);
    try {
      const ranks = await api.getWhereToBuy(itemId, 25);
      setRankings(ranks);
    } catch (e) {
      console.warn("Failed to load rankings", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const handleItemSelect = async (itemId) => {
    setSelectedItemId(itemId);
    await loadRankings(itemId);
  };

  const handleOpenMap = (mapUrl) => {
    if (mapUrl) {
      Linking.openURL(mapUrl);
    }
  };

  const handleSpeakBestDeal = () => {
    if (rankings.length === 0) return;
    const best = rankings[0];
    const item = items.find(i => i.id === selectedItemId);
    const itemName = item ? (language === 'ta' ? item.name_ta : item.name_en) : '';

    const textEn = `Best market for ${itemName} is ${best.name_en}. Wholesale price is ₹${best.wholesale_price} per kg, distance is ${best.distance_km} kilometers.`;
    const textTa = `${itemName} வாங்க சிறந்த சந்தை ${best.name_ta}. மொத்த விலை கிலோ ₹${best.wholesale_price}, தூரம் ${best.distance_km} கிலோமீட்டர்.`;

    speak(language === 'ta' ? textTa : textEn);
  };

  const selectedItem = items.find(i => i.id === selectedItemId);

  return (
    <View style={styles.screen}>
      <Header title={t('whereToBuyTitle')} showBack onBack={() => onNavigate('home')} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* HORIZONTAL ITEM SELECTOR */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.itemScroll}
          contentContainerStyle={styles.itemScrollContent}
        >
          {items.map((it) => {
            const isSelected = it.id === selectedItemId;
            return (
              <TouchableOpacity
                key={it.id}
                onPress={() => handleItemSelect(it.id)}
                style={[
                  styles.itemPill,
                  isSelected && styles.itemPillActive
                ]}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons 
                  name={it.icon || "food-apple"} 
                  size={20} 
                  color={isSelected ? '#FFFFFF' : '#374151'} 
                />
                <Text style={[
                  styles.itemPillText,
                  isSelected && styles.itemPillTextActive
                ]}>
                  {language === 'ta' ? it.name_ta : it.name_en}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* INFO NOTICE BANNER */}
        <View style={styles.infoBanner}>
          <MaterialCommunityIcons name="information" size={20} color="#0277BD" />
          <Text style={styles.infoBannerText}>{t('batchSizeInfo')}</Text>
        </View>

        {/* RANKINGS LIST */}
        {rankings.map((m, idx) => {
          const isBest = m.is_best_deal || idx === 0;

          return (
            <View 
              key={m.market_id}
              style={[
                styles.marketCard,
                isBest && styles.bestMarketCard
              ]}
            >
              {/* BEST DEAL BADGE */}
              {isBest && (
                <View style={styles.bestBadge}>
                  <MaterialCommunityIcons name="crown" size={16} color="#7F4400" />
                  <Text style={styles.bestBadgeText}>{t('bestDeal')}</Text>
                </View>
              )}

              {/* CARD HEADER */}
              <View style={styles.marketCardHeader}>
                <View style={[
                  styles.rankCircle,
                  { backgroundColor: isBest ? '#FFD54F' : '#E5E7EB' }
                ]}>
                  <Text style={styles.rankNum}>#{m.rank}</Text>
                </View>

                <View style={styles.marketNameBox}>
                  <Text style={styles.marketName}>
                    {language === 'ta' ? m.name_ta : m.name_en}
                  </Text>
                  <Text style={styles.marketLoc}>
                    📍 {m.location} • {m.distance_km} km away
                  </Text>
                </View>
              </View>

              {/* STATS COMPARISON */}
              <View style={styles.statsRow}>
                {/* Wholesale Mandi Price */}
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>{t('todayWholesale')}</Text>
                  <Text style={styles.statValue}>₹{m.wholesale_price}</Text>
                  <Text style={styles.statUnit}>per {selectedItem ? selectedItem.default_unit : 'kg'}</Text>
                </View>

                {/* Transport Cost */}
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>{t('transportCost')}</Text>
                  <Text style={styles.statValue}>₹{m.transport_cost_estimate}</Text>
                  <Text style={styles.statUnit}>auto / loading</Text>
                </View>

                {/* Total Landed Cost (The key decision metric!) */}
                <View style={[styles.statBox, isBest && styles.bestStatBox]}>
                  <Text style={[styles.statLabel, isBest && { color: '#1B5E20' }]}>
                    {t('landedCost')}
                  </Text>
                  <Text style={[styles.landedVal, isBest && { color: '#1B5E20' }]}>
                    ₹{m.total_estimated_landed_cost}
                  </Text>
                  <Text style={styles.statUnit}>/ {selectedItem ? selectedItem.default_unit : 'kg'}</Text>
                </View>
              </View>

              {/* FOOTER: OPEN HOURS & MAP LINK BUTTON */}
              <View style={styles.cardFooter}>
                <View style={styles.hoursRow}>
                  <MaterialCommunityIcons name="clock-outline" size={16} color="#6B7280" />
                  <Text style={styles.hoursText}>{m.opening_hours}</Text>
                </View>

                <TouchableOpacity
                  onPress={() => handleOpenMap(m.map_url)}
                  style={styles.mapButton}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="map-marker" size={18} color="#FFFFFF" />
                  <Text style={styles.mapButtonText}>{t('openInMaps')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: THEME.colors.bg
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40
  },
  itemScroll: {
    marginBottom: 12
  },
  itemScrollContent: {
    gap: 8,
    paddingVertical: 4
  },
  itemPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    gap: 6
  },
  itemPillActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary
  },
  itemPillText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#374151'
  },
  itemPillTextActive: {
    color: '#FFFFFF'
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E1F5FE',
    borderRadius: 12,
    padding: 10,
    marginBottom: 14,
    gap: 8
  },
  infoBannerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0277BD',
    flex: 1
  },
  marketCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2
  },
  bestMarketCard: {
    borderColor: '#4CAF50',
    borderWidth: 2.5,
    backgroundColor: '#FAFCFA'
  },
  bestBadge: {
    position: 'absolute',
    top: -12,
    right: 18,
    backgroundColor: '#FFD54F',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    elevation: 3
  },
  bestBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#7F4400'
  },
  marketCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12
  },
  rankCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center'
  },
  rankNum: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111827'
  },
  marketNameBox: {
    flex: 1
  },
  marketName: {
    fontSize: 17,
    fontWeight: '900',
    color: '#111827'
  },
  marketLoc: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 2
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 12,
    gap: 8,
    marginBottom: 12
  },
  statBox: {
    flex: 1,
    alignItems: 'center'
  },
  bestStatBox: {
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    paddingVertical: 4
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280'
  },
  statValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
    marginTop: 2
  },
  landedVal: {
    fontSize: 22,
    fontWeight: '900',
    color: THEME.colors.primary,
    marginTop: 2
  },
  statUnit: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280'
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6'
  },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  hoursText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280'
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0277BD',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6
  },
  mapButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF'
  }
});
