import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AttendanceService } from '../../services/attendanceService';
import { UserProfile } from '../../types/attendance';
import { Button } from '../ui/Button';
import { colors, fontSize, radius, spacing, touch } from '../../theme';

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
    <SafeAreaView style={styles.container}>
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
            <View style={styles.logo}>
              <Feather name="check-square" size={30} color="#FFFFFF" />
            </View>
            <Text style={styles.title}>E-Presensi</Text>
            <Text style={styles.subtitle}>Absensi karyawan yang mudah dipakai</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Masuk</Text>
            <Text style={styles.cardHint}>Gunakan email dan kata sandi dari kantor.</Text>

            {errorMessage && (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={18} color={colors.danger} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            <Text style={styles.label}>Email</Text>
            <View style={styles.inputRow}>
              <Feather name="mail" size={20} color={colors.faint} style={styles.inputIcon} />
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

            <Text style={styles.label}>Kata sandi</Text>
            <View style={styles.inputRow}>
              <Feather name="lock" size={20} color={colors.faint} style={styles.inputIcon} />
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
                <Feather name={showPassword ? 'eye-off' : 'eye'} size={20} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <Button
              title={loading ? 'Sedang masuk...' : 'Masuk'}
              icon="log-in"
              loading={loading}
              onPress={handleLogin}
              style={styles.loginBtn}
            />

            <Text style={styles.help}>
              Lupa kata sandi atau belum punya akun?{'\n'}Hubungi bagian admin kantor.
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
    padding: spacing.xl,
    justifyContent: 'center',
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%',
  },
  brand: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.ink,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.muted,
    marginTop: 6,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.ink,
  },
  cardHint: {
    fontSize: fontSize.sm,
    color: colors.muted,
    marginTop: 4,
    marginBottom: spacing.lg,
    lineHeight: 21,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.danger,
    fontWeight: '600',
    lineHeight: 21,
  },
  label: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 8,
    marginTop: spacing.md,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: touch.inputMinHeight,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.ink,
    paddingVertical: 14,
  },
  eyeBtn: {
    padding: 8,
  },
  loginBtn: {
    marginTop: spacing.xl,
  },
  help: {
    fontSize: fontSize.sm,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 22,
  },
});
