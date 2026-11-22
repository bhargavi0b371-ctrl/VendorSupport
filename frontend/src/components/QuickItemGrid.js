import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';

export const QuickItemGrid = ({ items = [], selectedId, onSelect, numColumns = 2 }) => {
  const { language } = useLanguage();

  const renderItem = ({ item }) => {
    const isSelected = selectedId === item.id;
    const displayName = language === 'ta' ? item.name_ta : item.name_en;
    const secondaryName = language === 'ta' ? item.name_en : item.name_ta;

    return (
      <TouchableOpacity
        onPress={() => onSelect(item)}
        activeOpacity={0.75}
        style={[
          styles.card,
          { borderColor: isSelected ? THEME.colors.primary : '#E5E7EB' },
          isSelected && styles.selectedCard
        ]}
      >
        <View style={[styles.iconCircle, { backgroundColor: item.color || '#E8F5E9' }]}>
          <MaterialCommunityIcons 
            name={item.icon || "food-apple"} 
            size={32} 
            color="#FFFFFF" 
          />
        </View>
        <Text style={styles.itemName} numberOfLines={1}>{displayName}</Text>
        <Text style={styles.secondaryName} numberOfLines={1}>{secondaryName}</Text>
        <View style={styles.unitPill}>
          <Text style={styles.unitText}>{item.default_unit}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <FlatList
      data={items}
      renderItem={renderItem}
      keyExtractor={(it) => it.id.toString()}
      numColumns={numColumns}
      contentContainerStyle={styles.gridContainer}
      scrollEnabled={false}
    />
  );
};

const styles = StyleSheet.create({
  gridContainer: {
    paddingVertical: 8
  },
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    margin: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    minHeight: 125
  },
  selectedCard: {
    backgroundColor: '#F1F8E9',
    borderColor: THEME.colors.primary,
    borderWidth: 3
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8
  },
  itemName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center'
  },
  secondaryName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 2
  },
  unitPill: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 6
  },
  unitText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151'
  }
});
