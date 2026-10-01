// E-Presensi UI · Modern Shadcn Login Screen
// Clean surfaces, subtle hairline borders, refined typography.

import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AttendanceService } from '../../services/attendanceService';
import { UserProfile } from '../../types/attendance';
import { Button } from '../ui/Button';
import { colors, fontSize, neoShadow, radius, spacing, touch } from '../../theme';

interface LoginScreenProps {
  onLoginSuccess: (user?: UserProfile) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    setErrorMessage(null);

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Isi email dan kata sandi dulu, lalu tekan Masuk.');
      return;
    }

    setLoading(true);
    const { user, error } = await AttendanceService.signInWithEmail(email, password);
    setLoading(false);

    if (user) {
      onLoginSuccess(user);
      return;
    }

    setErrorMessage(error || 'Gagal masuk. Periksa kembali email dan kata sandi.');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brand}>
            <Image
              source={require('../../../assets/skmi-logo3.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>E-Presensi</Text>
            <Text style={styles.subtitle}>Portal Presensi Karyawan</Text>
          </View>

          <View style={[styles.card, neoShadow.sm]}>
            <Text style={styles.cardTitle}>Masuk Akun</Text>
            <Text style={styles.cardHint}>Gunakan email dan kata sandi resmi dari kantor.</Text>

            {errorMessage && (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={16} color={colors.danger} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputRow}>
                <Feather name="mail" size={16} color={colors.faint} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="nama@kantor.com"
                  placeholderTextColor={colors.faint}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  returnKeyType="next"
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Kata sandi</Text>
              <View style={styles.inputRow}>
                <Feather name="lock" size={16} color={colors.faint} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Kata sandi"
                  placeholderTextColor={colors.faint}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((v) => !v)}
                  style={styles.eyeBtn}
                  hitSlop={12}
                >
                  <Feather name={showPassword ? 'eye-off' : 'eye'} size={16} color={colors.muted} />
                </TouchableOpacity>
              </View>
            </View>

            <Button
              title={loading ? 'Sedang masuk...' : 'Masuk'}
              icon="log-in"
              loading={loading}
              onPress={handleLogin}
              style={styles.loginBtn}
            />

            <Text style={styles.help}>
              Lupa kata sandi atau belum punya akun?{'\n'}Hubungi tim admin kantor.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  brand: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  logo: {
    width: 64,
    height: 64,
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: fontSize.xs,
    color: colors.muted,
    marginTop: 2,
    textAlign: 'center',
    fontWeight: '500',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  cardHint: {
    fontSize: fontSize.xs,
    color: colors.muted,
    marginTop: 3,
    marginBottom: spacing.md,
    lineHeight: 18,
    textAlign: 'center',
    fontWeight: '500',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.izinBorder,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.md,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.dangerInk,
    fontWeight: '600',
    lineHeight: 18,
  },
  field: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.ink,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    minHeight: touch.inputMinHeight,
  },
  inputIcon: {
    marginRight: spacing.xs,
  },
  input: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.ink,
    paddingVertical: 10,
    paddingLeft: spacing.xs,
    paddingRight: spacing.xs,
    textAlignVertical: 'center',
  },
  eyeBtn: {
    padding: 8,
    marginLeft: spacing.xs,
  },
  loginBtn: {
    marginTop: spacing.sm,
  },
  help: {
    fontSize: fontSize.xs,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 20,
    fontWeight: '500',
  },
});
