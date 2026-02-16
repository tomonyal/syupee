import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient' ;
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOWS } from '../../constants';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
  fullWidth = false,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const sizeStyles = {
    small: { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md },
    medium: { paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg },
    large: { paddingVertical: SPACING.lg, paddingHorizontal: SPACING.xl },
  };

  const textSizeStyles = {
    small: { fontSize: FONT_SIZE.sm },
    medium: { fontSize: FONT_SIZE.md },
    large: { fontSize: FONT_SIZE.lg },
  };

  if (variant === 'primary') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.8}
        style={[fullWidth && { width: '100%' }, style]}
      >
        <LinearGradient
          colors={isDisabled ? ['#CCC', '#BBB'] : [COLORS.gradientStart, COLORS.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[
            styles.base,
            sizeStyles[size],
            SHADOWS.medium,
            { borderRadius: BORDER_RADIUS.lg },
          ]}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.textOnPrimary} />
          ) : (
            <>
              {icon}
              <Text style={[styles.primaryText, textSizeStyles[size], textStyle]}>
                {title}
              </Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  const variantStyles: Record<string, ViewStyle> = {
    secondary: {
      backgroundColor: COLORS.secondary,
    },
    outline: {
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderColor: COLORS.primary,
    },
    ghost: {
      backgroundColor: 'transparent',
    },
  };

  const variantTextStyles: Record<string, TextStyle> = {
    secondary: { color: COLORS.textOnPrimary },
    outline: { color: COLORS.primary },
    ghost: { color: COLORS.primary },
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      style={[
        styles.base,
        sizeStyles[size],
        variantStyles[variant],
        isDisabled && styles.disabled,
        fullWidth && { width: '100%' },
        variant === 'secondary' && SHADOWS.medium,
        { borderRadius: BORDER_RADIUS.lg },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variantTextStyles[variant]?.color || COLORS.primary} />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.text,
              variantTextStyles[variant],
              textSizeStyles[size],
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  text: {
    fontWeight: '700',
  },
  primaryText: {
    color: COLORS.textOnPrimary,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.5,
  },
});
