import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';

export const BigButton = ({
  title,
  subtitle,
  icon,
  onPress,
  color = THEME.colors.primary,
  textColor = '#FFFFFF',
  variant = 'filled', // 'filled' | 'outlined'
  size = 'large',    // 'medium' | 'large' | 'giant'
  disabled = false,
  style
}) => {
  const isOutlined = variant === 'outlined';
  const minHeight = size === 'giant' ? 84 : (size === 'large' ? 68 : 54);
  const iconSize = size === 'giant' ? 36 : (size === 'large' ? 30 : 24);
  const fontSize = size === 'giant' ? 22 : (size === 'large' ? 19 : 16);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      style={[
        styles.button,
        {
          minHeight,
          backgroundColor: isOutlined ? 'transparent' : color,
          borderColor: color,
          borderWidth: isOutlined ? 3 : 0,
          opacity: disabled ? 0.5 : 1.0
        },
        style
      ]}
    >
      <View style={styles.content}>
        {icon && (
          <MaterialCommunityIcons 
            name={icon} 
            size={iconSize} 
            color={isOutlined ? color : textColor} 
            style={styles.icon} 
          />
        )}
        <View style={styles.textContainer}>
          <Text 
            style={[
              styles.title, 
              { 
                color: isOutlined ? color : textColor, 
                fontSize 
              }
            ]}
          >
            {title}
          </Text>
          {subtitle && (
            <Text 
              style={[
                styles.subtitle, 
                { color: isOutlined ? color : 'rgba(255,255,255,0.85)' }
              ]}
            >
              {subtitle}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    marginVertical: 6
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  icon: {
    marginRight: 12
  },
  textContainer: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  title: {
    fontWeight: '900',
    letterSpacing: 0.4,
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center'
  }
});
