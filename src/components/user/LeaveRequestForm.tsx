import React, { useState } from 'react';
import {
  Alert,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Feather } from '@expo/vector-icons';
import { colors, fontSize, radius } from '../../theme';

interface LeaveRequestFormProps {
  onSubmit: (data: {
    startDate: string;
    endDate: string;
    reason: string;
    documentUrl?: string;
  }) => void;
}

export const LeaveRequestForm: React.FC<LeaveRequestFormProps> = ({ onSubmit }) => {
  const today = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [reason, setReason] = useState('');
  const [attachedUri, setAttachedUri] = useState<string | undefined>(undefined);
  const [attachedName, setAttachedName] = useState<string>('');

  const handlePickDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        setAttachedUri(asset.uri);
        setAttachedName(asset.name);
      }
    } catch {
      // Image picker fallback
      const imgRes = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.6,
      });

      if (!imgRes.canceled && imgRes.assets[0]?.uri) {
        setAttachedUri(imgRes.assets[0].uri);
        setAttachedName('Surat_Dokter.jpg');
      }
    }
  };

  const handleSubmit = () => {
    if (!reason.trim()) {
      Alert.alert('Alasan Diperlukan', 'Mohon tuliskan deskripsi/alasan pengajuan izin atau sakit.');
      return;
    }

    onSubmit({
      startDate,
      endDate,
      reason,
      documentUrl: attachedUri,
    });
  };

  return (
    <Card
      title="Pengajuan Izin / Sakit"
      subtitle="Isi periode tanggal, deskripsi alasan, dan unggah surat bukti pendukung (opsional)"
      icon="file-text"
    >
      <View style={styles.dateRow}>
        <View style={[styles.formGroup, { flex: 1, marginRight: 6 }]}>
          <Text style={styles.label}>Mulai Tanggal:</Text>
          <TextInput
            style={styles.input}
            value={startDate}
            onChangeText={setStartDate}
            placeholder="YYYY-MM-DD"
          />
        </View>

        <View style={[styles.formGroup, { flex: 1, marginLeft: 6 }]}>
          <Text style={styles.label}>Hingga Tanggal:</Text>
          <TextInput
            style={styles.input}
            value={endDate}
            onChangeText={setEndDate}
            placeholder="YYYY-MM-DD"
          />
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Alasan & Deskripsi Izin / Sakit:</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={reason}
          onChangeText={setReason}
          multiline
          numberOfLines={4}
          placeholder="Tuliskan keterangan detail alasan izin/sakit Anda..."
          textAlignVertical="top"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Unggah Berkas Pendukung (Surat Dokter / Cuti):</Text>
        {attachedUri ? (
          <View style={styles.attachmentBox}>
            <Feather name="paperclip" size={16} color={colors.ink} style={{ marginRight: 8 }} />
            <Text style={styles.attachmentName} numberOfLines={1}>
              {attachedName || 'Dokumen_Terlampir'}
            </Text>
            <TouchableOpacity onPress={() => setAttachedUri(undefined)} style={{ padding: 4 }}>
              <Feather name="x" size={16} color={colors.danger} />
            </TouchableOpacity>
          </View>
        ) : (
          <Button
            title="Upload Surat Dokter / Cuti (Opsional)"
            variant="outline"
            icon="upload"
            onPress={handlePickDocument}
          />
        )}
      </View>

      <Button
        title="Lanjutkan Pengajuan & Ambil Swafoto"
        variant="primary"
        icon="camera"
        onPress={handleSubmit}
        style={{ marginTop: 8 }}
      />
    </Card>
  );
};

const styles = StyleSheet.create({
  dateRow: {
    flexDirection: 'row',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: fontSize.md,
    color: colors.ink,
    minHeight: 56,
  },
  textArea: {
    height: 110,
  },
  attachmentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  attachmentName: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.ink,
    fontWeight: '700',
  },
});
