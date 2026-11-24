import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';

export const MandiPriceCard = ({ priceItem, isBestDeal = false }) => {
  const { language } = useLanguage();
  if (!priceItem) return null;

  const marketName = language === 'ta' ? priceItem.market_name_ta : priceItem.market_name_en;

  return (
    <View style={[styles.card, isBestDeal && styles.bestDealCard]}>
      {/* Top Row: Market Title & Best Deal Badge */}
      <View style={styles.topRow}>
        <View style={styles.marketTitleCol}>
          <Text style={styles.marketName}>{marketName}</Text>
          <View style={styles.subInfoRow}>
            <MaterialCommunityIcons name="map-marker-outline" size={14} color="#6B7280" />
            <Text style={styles.districtText}>{priceItem.district}</Text>
            {priceItem.distance_km !== null && priceItem.distance_km !== undefined && (
              <Text style={styles.distanceText}>• {priceItem.distance_km} km</Text>
            )}
          </View>
        </View>

        {isBestDeal && (
          <View style={styles.bestDealBadge}>
            <MaterialCommunityIcons name="tag-check" size={14} color="#7F4400" />
            <Text style={styles.bestDealText}>
              {language === 'ta' ? 'குறைந்த விலை' : 'Best Rate'}
            </Text>
          </View>
        )}
      </View>

      {/* Middle Row: Min, Modal, Max Price Display */}
      <View style={styles.pricesRow}>
        <View style={styles.priceCol}>
          <Text style={styles.priceLabel}>{language === 'ta' ? 'குறைந்த விலை' : 'Min Price'}</Text>
          <Text style={styles.minPriceVal}>
            ₹{priceItem.min_price_per_kg !== null ? priceItem.min_price_per_kg : '—'}
          </Text>
          <Text style={styles.unitSub}>/kg</Text>
        </View>

        <View style={[styles.priceCol, styles.modalPriceCol]}>
          <Text style={styles.modalPriceLabel}>{language === 'ta' ? 'சராசரி மொத்த விலை' : 'Modal Wholesale'}</Text>
          <Text style={styles.modalPriceVal}>₹{priceItem.modal_price_per_kg}</Text>
          <Text style={styles.modalUnitSub}>/kg</Text>
        </View>

        <View style={styles.priceCol}>
          <Text style={styles.priceLabel}>{language === 'ta' ? 'அதிகபட்ச விலை' : 'Max Price'}</Text>
          <Text style={styles.maxPriceVal}>
            ₹{priceItem.max_price_per_kg !== null ? priceItem.max_price_per_kg : '—'}
          </Text>
          <Text style={styles.unitSub}>/kg</Text>
        </View>
      </View>

      {/* Bottom Footer: Source & Last Updated Time */}
      <View style={styles.footerRow}>
        <View style={styles.sourceTag}>
          <MaterialCommunityIcons name="shield-check" size={12} color="#1565C0" />
          <Text style={styles.sourceText}>AGMARKNET</Text>
        </View>
        <Text style={styles.timestampText}>
          {language === 'ta' ? 'புதுப்பிக்கப்பட்டது:' : 'Updated:'} {priceItem.fetched_at || priceItem.date}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2
  },
  bestDealCard: {
    borderColor: '#2E7D32',
    backgroundColor: '#F9FDF9',
    borderWidth: 2
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  marketTitleCol: {
    flex: 1,
    marginRight: 8
  },
  marketName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827'
  },
  subInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2
  },
  districtText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600'
  },
  distanceText: {
    fontSize: 12,
    color: '#0277BD',
    fontWeight: '700'
  },
  bestDealBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFECB3',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8
  },
  bestDealText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#7F4400'
  },
  pricesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginBottom: 10
  },
  priceCol: {
    flex: 1,
    alignItems: 'center'
  },
  modalPriceCol: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 6,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  priceLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 2
  },
  modalPriceLabel: {
    fontSize: 11,
    color: THEME.colors.primary,
    fontWeight: '800',
    marginBottom: 2
  },
  minPriceVal: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E3A8A'
  },
  modalPriceVal: {
    fontSize: 20,
    fontWeight: '900',
    color: THEME.colors.primary
  },
  maxPriceVal: {
    fontSize: 15,
    fontWeight: '700',
    color: '#B91C1C'
  },
  unitSub: {
    fontSize: 10,
    color: '#9CA3AF'
  },
  modalUnitSub: {
    fontSize: 11,
    color: '#1B5E20',
    fontWeight: '700'
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6'
  },
  sourceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  sourceText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1565C0'
  },
  timestampText: {
    fontSize: 10,
    color: '#9CA3AF'
  }
});
