import React, { createElement, useEffect, useRef, useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button } from '../ui/Button';
import { Feather } from '@expo/vector-icons';

interface CameraModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirmPhoto: (photoUri: string) => void;
  attendanceTypeLabel: string;
}

export const CameraModal: React.FC<CameraModalProps> = ({
  visible,
  onClose,
  onConfirmPhoto,
  attendanceTypeLabel,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [webStream, setWebStream] = useState<MediaStream | null>(null);
  const [webError, setWebError] = useState<string | null>(null);

  const cameraRef = useRef<CameraView>(null);
  const videoNodeRef = useRef<HTMLVideoElement | null>(null);

  // Initialize Web Camera Stream when modal opens on Web
  useEffect(() => {
    if (visible && Platform.OS === 'web' && !capturedPhoto) {
      initWebCamera();
    } else {
      stopWebCamera();
    }

    return () => {
      stopWebCamera();
    };
  }, [visible, capturedPhoto]);

  const initWebCamera = async () => {
    setWebError(null);
    try {
      if (typeof window !== 'undefined' && navigator?.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        setWebStream(stream);

        if (videoNodeRef.current) {
          videoNodeRef.current.srcObject = stream;
          videoNodeRef.current.play().catch(() => {});
        }
      } else {
        setWebError('Browser Anda tidak mendukung akses webcam.');
      }
    } catch (err: any) {
      setWebError('Gagal mengakses kamera laptop: ' + (err.message || 'Izin kamera ditolak.'));
    }
  };

  const stopWebCamera = () => {
    if (webStream) {
      webStream.getTracks().forEach((track) => track.stop());
      setWebStream(null);
    }
  };

  const handleTakePicture = async () => {
    setCapturing(true);

    try {
      if (Platform.OS === 'web') {
        // Web Canvas Snapshot
        const video = videoNodeRef.current;
        if (video) {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1); // Flip horizontally for natural selfie orientation
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            setCapturedPhoto(dataUrl);
            stopWebCamera();
          }
        } else {
          setWebError('Kamera belum siap. Mohon tunggu...');
        }
      } else {
        // Native Expo Camera Snapshot
        if (cameraRef.current) {
          const photo = await cameraRef.current.takePictureAsync({ quality: 0.6 });
          if (photo?.uri) {
            setCapturedPhoto(photo.uri);
          }
        }
      }
    } catch (e: any) {
      setWebError('Gagal mengambil potret: ' + e.message);
    } finally {
      setCapturing(false);
    }
  };

  const handleConfirm = () => {
    if (capturedPhoto) {
      onConfirmPhoto(capturedPhoto);
      setCapturedPhoto(null);
      stopWebCamera();
      onClose();
    }
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    if (Platform.OS === 'web') {
      setTimeout(initWebCamera, 250);
    }
  };

  const handleCloseModal = () => {
    stopWebCamera();
    setCapturedPhoto(null);
    onClose();
  };

  // Helper renderer for Web Video Element in React Native Web
  const renderWebVideo = () => {
    return (
      <View style={styles.webCameraContainer}>
        {webError ? (
          <View style={styles.webErrorBox}>
            <Feather name="alert-triangle" size={32} color="#B3261E" />
            <Text style={styles.webErrorTitle}>Akses Kamera Laptop Ditutup</Text>
            <Text style={styles.webErrorText}>{webError}</Text>
            <Button
              title="Aktifkan Kamera Laptop"
              variant="primary"
              onPress={initWebCamera}
              style={{ marginTop: 14 }}
            />
          </View>
        ) : (
          <View style={styles.videoWrapper}>
            {createElement('video', {
              ref: (node: HTMLVideoElement | null) => {
                videoNodeRef.current = node;
                if (node && webStream && node.srcObject !== webStream) {
                  node.srcObject = webStream;
                  node.play().catch(() => {});
                }
              },
              autoPlay: true,
              playsInline: true,
              muted: true,
              style: {
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'scaleX(-1)', // Mirror feed
              },
            })}
            <View style={styles.targetGuideOverlay}>
              <View style={styles.targetCircle} />
              <Text style={styles.targetGuideText}>Posisikan wajah Anda di dalam lingkaran</Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={handleCloseModal}>
      <SafeAreaView style={styles.container}>
        {/* Minimalist Top Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCloseModal} style={styles.closeBtn}>
            <Feather name="x" size={20} color="#1C1917" />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.headerTitle}>Swafoto Presensi Live</Text>
            <Text style={styles.headerSub}>{attendanceTypeLabel}</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        {/* Captured Photo Validation vs Live Camera Stream */}
        {capturedPhoto ? (
          <View style={styles.previewContainer}>
            <View style={styles.validationBanner}>
              <Feather name="check-circle" size={18} color="#346538" style={{ marginRight: 8 }} />
              <Text style={styles.validationText}>
                Foto Berhasil Diambil. Periksa kejelasan foto Anda sebelum konfirmasi.
              </Text>
            </View>

            <View style={styles.photoFrame}>
              <Image source={{ uri: capturedPhoto }} style={styles.previewImage} />
            </View>

            <View style={styles.actionRow}>
              <Button
                title="Ulangi Foto"
                variant="outline"
                icon="refresh-cw"
                onPress={handleRetake}
                style={{ flex: 1, marginRight: 6 }}
              />
              <Button
                title="Konfirmasi & Simpan"
                variant="primary"
                icon="check"
                onPress={handleConfirm}
                style={{ flex: 1, marginLeft: 6 }}
              />
            </View>
          </View>
        ) : (
          <View style={styles.cameraViewArea}>
            {Platform.OS === 'web' ? (
              renderWebVideo()
            ) : !permission?.granted ? (
              <View style={styles.permissionBox}>
                <Feather name="camera-off" size={36} color="#8A8580" />
                <Text style={styles.permText}>Izin Kamera Diperlukan</Text>
                <Text style={styles.permSubText}>
                  Aplikasi membutuhkan akses kamera untuk melakukan potret presensi langsung.
                </Text>
                <Button
                  title="Izinkan Akses Kamera"
                  onPress={requestPermission}
                  style={{ marginTop: 14 }}
                />
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                <CameraView style={styles.nativeCamera} facing="front" ref={cameraRef}>
                  <View style={styles.targetGuideOverlay}>
                    <View style={styles.targetCircle} />
                    <Text style={styles.targetGuideText}>Posisikan wajah Anda di dalam lingkaran</Text>
                  </View>
                </CameraView>
              </View>
            )}

            {/* Bottom Camera Snap Controls */}
            <View style={styles.bottomControls}>
              <View style={{ width: 44 }} />

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleTakePicture}
                disabled={capturing}
                style={styles.snapBtn}
              >
                <View style={styles.snapInnerCircle} />
              </TouchableOpacity>

              <View style={{ width: 44 }} />
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F6F3',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E3E1DD',
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#EFEDE9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E3E1DD',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1917',
  },
  headerSub: {
    fontSize: 13,
    color: '#57534E',
    fontWeight: '600',
  },
  previewContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  validationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDF3EC',
    borderWidth: 1,
    borderColor: '#E3E1DD',
    padding: 14,
    borderRadius: 10,
    width: '100%',
  },
  validationText: {
    fontSize: 14,
    color: '#346538',
    fontWeight: '700',
    flex: 1,
  },
  photoFrame: {
    width: 280,
    height: 280,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CFCBC4',
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  actionRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  cameraViewArea: {
    flex: 1,
    backgroundColor: '#1C1917',
  },
  webCameraContainer: {
    flex: 1,
    backgroundColor: '#1C1917',
  },
  videoWrapper: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  webErrorBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
  },
  webErrorTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 12,
  },
  webErrorText: {
    fontSize: 14,
    color: '#334155',
    textAlign: 'center',
    marginTop: 6,
  },
  nativeCamera: {
    flex: 1,
  },
  targetGuideOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(28, 25, 23, 0.35)',
  },
  targetCircle: {
    width: 260,
    height: 260,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    borderStyle: 'dashed',
  },
  targetGuideText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 16,
    backgroundColor: 'rgba(28, 25, 23, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  bottomControls: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E3E1DD',
  },
  snapBtn: {
    width: 76,
    height: 76,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#1C1917',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  snapInnerCircle: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#1C1917',
  },
  permissionBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    backgroundColor: '#FFFFFF',
  },
  permText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1917',
    marginTop: 14,
  },
  permSubText: {
    fontSize: 14,
    color: '#57534E',
    textAlign: 'center',
    marginTop: 6,
  },
});
