import React, { useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { AttendanceRecord } from '../../types/attendance';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Feather } from '@expo/vector-icons';
import { colors, fontSize, radius } from '../../theme';

interface AttendanceFeedProps {
  attendances: AttendanceRecord[];
  onSelectRecord: (record: AttendanceRecord) => void;
}

export const AttendanceFeed: React.FC<AttendanceFeedProps> = ({
  attendances,
  onSelectRecord,
}) => {
  const [filter, setFilter] = useState<'all' | 'luring' | 'daring' | 'izin_sakit'>('all');
  const [search, setSearch] = useState('');

  const filtered = attendances.filter((item) => {
    const matchesFilter = filter === 'all' ? true : item.type === filter;
    const matchesSearch =
      item.userName.toLowerCase().includes(search.toLowerCase()) ||
      item.userEmail.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <Card
      title="Presensi"
      icon="list"
    >
      <View style={styles.searchBox}>
        <Feather name="search" size={16} color="#9CA3AF" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Cari nama..."
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Feather name="x-circle" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filterBar}>
        <TouchableOpacity
          onPress={() => setFilter('all')}
          style={[styles.filterChip, filter === 'all' && styles.activeChip]}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.activeFilterText]}>
            Semua ({attendances.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setFilter('luring')}
          style={[styles.filterChip, filter === 'luring' && styles.activeChip]}
        >
          <Text style={[styles.filterText, filter === 'luring' && styles.activeFilterText]}>
            Kantor
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setFilter('daring')}
          style={[styles.filterChip, filter === 'daring' && styles.activeChip]}
        >
          <Text style={[styles.filterText, filter === 'daring' && styles.activeFilterText]}>
            Rumah
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setFilter('izin_sakit')}
          style={[styles.filterChip, filter === 'izin_sakit' && styles.activeChip]}
        >
          <Text style={[styles.filterText, filter === 'izin_sakit' && styles.activeFilterText]}>
            Izin
          </Text>
        </TouchableOpacity>
      </View>

      {filtered.length === 0 ? (
        <View style={styles.emptyBox}>
          <Feather name="inbox" size={36} color={colors.faint} />
          <Text style={styles.emptyText}>Belum ada data.</Text>
        </View>
      ) : (
        filtered.map((item) => (
          <TouchableOpacity
            key={item.id}
            activeOpacity={0.7}
            onPress={() => onSelectRecord(item)}
            style={styles.feedItem}
          >
            <View style={styles.itemLeft}>
              {item.photoUrl ? (
                <Image source={{ uri: item.photoUrl }} style={styles.thumbnail} />
              ) : (
                <View style={styles.thumbFallback}>
                  <Text style={styles.thumbText}>
                    {item.userName.substring(0, 2).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.empName}>{item.userName}</Text>
                <Text style={styles.timeText}>
                  {new Date(item.clockInTime).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            </View>

            <View style={styles.itemRight}>
              <Badge type={item.type} size="sm" />
              <Feather name="chevron-right" size={16} color={colors.faint} style={{ marginTop: 4 }} />
            </View>
          </TouchableOpacity>
        ))
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    minHeight: 56,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.ink,
  },
  filterBar: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 6,
  },
  activeChip: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  filterText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.muted,
  },
  activeFilterText: {
    color: '#FFFFFF',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: fontSize.xs,
    color: colors.faint,
    marginTop: 8,
  },
  feedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  thumbnail: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: colors.surfaceSoft,
  },
  thumbFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  thumbText: {
    color: colors.ink,
    fontWeight: '700',
    fontSize: 13,
  },
  empName: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.ink,
  },
  timeText: {
    fontSize: fontSize.xs,
    color: colors.muted,
    marginTop: 2,
  },
  reasonText: {
    fontSize: fontSize.xs,
    color: colors.muted,
    fontStyle: 'italic',
    marginTop: 2,
  },
  itemRight: {
    alignItems: 'flex-end',
  },
});
