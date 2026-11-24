import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { useVoice } from '../hooks/useVoice';

export const ExplainableReasoningCard = ({ prediction }) => {
  const { language } = useLanguage();
  const { speak } = useVoice();
  if (!prediction) return null;

  const reasoningText = language === 'ta' ? prediction.reasoning_ta : prediction.reasoning_en;
  const commName = language === 'ta' ? prediction.commodity_name_ta : prediction.commodity_name_en;
  const b = prediction.breakdown;

  const handleSpeak = () => {
    speak(reasoningText);
  };

  return (
    <View style={styles.card}>
      {/* Top Banner: Big Recommended Price & Range */}
      <View style={styles.heroRow}>
        <View style={styles.heroLeft}>
          <Text style={styles.commTitle}>{commName}</Text>
          <Text style={styles.heroLabel}>
            {language === 'ta' ? 'பரிந்துரைக்கப்பட்ட விற்பனை விலை' : 'Recommended Selling Price'}
          </Text>
          <View style={styles.priceRow}>
            <Text style={styles.mainPrice}>₹{prediction.recommended_price}</Text>
            <Text style={styles.unitText}>/kg</Text>
          </View>
          <Text style={styles.rangeText}>
            {language === 'ta' ? 'பரிந்துரை வரம்பு:' : 'Safe Range:'} ₹{prediction.min_price_range} - ₹{prediction.max_price_range}
          </Text>
        </View>

        <View style={styles.heroRight}>
          <View style={styles.marginPill}>
            <Text style={styles.marginPct}>{prediction.expected_margin_pct}%</Text>
            <Text style={styles.marginSub}>{language === 'ta' ? 'லாபம்' : 'Margin'}</Text>
          </View>
          <TouchableOpacity onPress={handleSpeak} style={styles.speakButton} activeOpacity={0.8}>
            <MaterialCommunityIcons name="volume-high" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Transparent Cost & Margin Breakdown Table */}
      <View style={styles.breakdownBox}>
        <Text style={styles.breakdownHeader}>
          {language === 'ta' ? 'விலை கணக்கீட்டு விளக்கம் (Cost Breakdown):' : 'Why this price? (Cost Breakdown)'}
        </Text>

        <View style={styles.breakdownRow}>
          <Text style={styles.rowLabel}>
            {language === 'ta' ? '1. மொத்த சந்தை விலை' : '1. Mandi Wholesale Benchmark'}
          </Text>
          <Text style={styles.rowVal}>₹{b.mandi_wholesale_cost}</Text>
        </View>

        <View style={styles.breakdownRow}>
          <Text style={styles.rowLabel}>
            {language === 'ta' ? '2. போக்குவரத்து செலவு' : '2. Transport Overhead'}
          </Text>
          <Text style={styles.rowVal}>+₹{b.transport_overhead_per_kg}</Text>
        </View>

        <View style={[styles.breakdownRow, styles.costFloorRow]}>
          <Text style={styles.costFloorLabel}>
            {language === 'ta' ? 'அடக்க விலை (Cost Floor)' : 'Cost Floor'}
          </Text>
          <Text style={styles.costFloorVal}>₹{b.cost_floor}</Text>
        </View>

        <View style={styles.breakdownRow}>
          <Text style={styles.rowLabel}>
            {language === 'ta' ? '3. உங்கள் இலக்கு லாபம்' : '3. Target Profit Margin'}
          </Text>
          <Text style={[styles.rowVal, { color: THEME.colors.primary }]}>
            +₹{b.target_margin_amount}
          </Text>
        </View>

        {b.festival_uplift_amount > 0 && (
          <View style={styles.breakdownRow}>
            <Text style={styles.rowLabel}>
              {language === 'ta' ? '4. பண்டிகை தேவை உயர்வு' : '4. Festival Demand Uplift'}
            </Text>
            <Text style={[styles.rowVal, { color: '#D97706' }]}>
              +₹{b.festival_uplift_amount}
            </Text>
          </View>
        )}
      </View>

      {/* Spoken Explanation Text Box */}
      <View style={styles.reasoningBox}>
        <MaterialCommunityIcons name="comment-text-outline" size={18} color={THEME.colors.primary} />
        <Text style={styles.reasoningText}>{reasoningText}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#C8E6C9',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14
  },
  heroLeft: {
    flex: 1
  },
  commTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 2
  },
  heroLabel: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '700'
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 2
  },
  mainPrice: {
    fontSize: 32,
    fontWeight: '900',
    color: THEME.colors.primary
  },
  unitText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '700',
    marginLeft: 2
  },
  rangeText: {
    fontSize: 12,
    color: '#0277BD',
    fontWeight: '800',
    marginTop: 2
  },
  heroRight: {
    alignItems: 'flex-end',
    gap: 8
  },
  marginPill: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#A5D6A7'
  },
  marginPct: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1B5E20'
  },
  marginSub: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2E7D32'
  },
  speakButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3
  },
  breakdownBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12
  },
  breakdownHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#374151',
    marginBottom: 8
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4
  },
  rowLabel: {
    fontSize: 12,
    color: '#4B5563'
  },
  rowVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827'
  },
  costFloorRow: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 6,
    marginVertical: 4
  },
  costFloorLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1F2937'
  },
  costFloorVal: {
    fontSize: 13,
    fontWeight: '900',
    color: '#B91C1C'
  },
  reasoningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0'
  },
  reasoningText: {
    flex: 1,
    fontSize: 12,
    color: '#166534',
    lineHeight: 18,
    fontWeight: '600'
  }
});
