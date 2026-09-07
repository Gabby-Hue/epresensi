import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, fontSize, radius, touch } from '../../theme';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  icon?: keyof typeof Feather.glyphMap;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  icon,
  loading = false,
  fullWidth = true,
  disabled,
  style,
  ...props
}) => {
  const palette = {
    primary: { bg: colors.primary, text: '#FFFFFF', border: colors.primaryDark },
    secondary: { bg: colors.surfaceSoft, text: colors.ink, border: colors.borderStrong },
    outline: { bg: colors.surface, text: colors.ink, border: colors.borderStrong },
    danger: { bg: colors.surface, text: colors.danger, border: colors.danger },
  }[variant];

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={disabled || loading}
      style={[
        styles.button,
        { backgroundColor: disabled ? colors.surfaceSoft : palette.bg, borderColor: palette.border },
        fullWidth && styles.fullWidth,
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} size="small" />
      ) : (
        <>
          {icon && <Feather name={icon} size={20} color={palette.text} style={styles.icon} />}
          <Text style={[styles.text, { color: disabled ? colors.faint : palette.text }]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: touch.buttonMinHeight,
  },
  fullWidth: {
    width: '100%',
  },
  icon: {
    marginRight: 10,
  },
  text: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
});
