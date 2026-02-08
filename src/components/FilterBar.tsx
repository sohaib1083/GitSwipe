import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Modal, FlatList, TextInput,
} from 'react-native';
import type { IssueFilters, IssueSource, SortOrder, GitHubOrg } from '../types';

interface FilterBarProps {
  filters: IssueFilters;
  onFiltersChange: (filters: IssueFilters) => void;
  orgs: GitHubOrg[];
  orgMembers: string[];
}

const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFiltersChange,
  orgs,
  orgMembers,
}) => {
  const [showOrgPicker, setShowOrgPicker] = useState(false);
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const [showSortPicker, setShowSortPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const update = useCallback(
    (partial: Partial<IssueFilters>) => onFiltersChange({ ...filters, ...partial }),
    [filters, onFiltersChange],
  );

  const sortOptions: { key: SortOrder; label: string }[] = [
    { key: 'updated', label: 'Recently Updated' },
    { key: 'created', label: 'Recently Created' },
    { key: 'comments', label: 'Most Comments' },
  ];

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {/* State Toggle */}
        <TouchableOpacity
          style={[styles.chip, filters.state === 'closed' && styles.chipActive]}
          onPress={() => update({ state: filters.state === 'open' ? 'closed' : 'open' })}
        >
          <View style={[styles.dot, filters.state === 'open' ? styles.dotOpen : styles.dotClosed]} />
          <Text style={[styles.chipText, filters.state === 'closed' && styles.chipTextActive]}>
            {filters.state === 'open' ? 'Open' : 'Closed'}
          </Text>
        </TouchableOpacity>

        {/* Org picker (org source) */}
        {filters.source === 'organization' && (
          <TouchableOpacity
            style={[styles.chip, filters.organization && styles.chipActive]}
            onPress={() => setShowOrgPicker(true)}
          >
            <Text style={[styles.chipText, filters.organization && styles.chipTextActive]}>
              {filters.organization || 'Organization'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Assignee (org source) */}
        {filters.source === 'organization' && filters.organization && (
          <TouchableOpacity
            style={[styles.chip, filters.assignee && styles.chipActive]}
            onPress={() => setShowAssigneePicker(true)}
          >
            <Text style={[styles.chipText, filters.assignee && styles.chipTextActive]}>
              {filters.assignee || 'Assignee'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Sort */}
        <TouchableOpacity style={styles.chip} onPress={() => setShowSortPicker(true)}>
          <Text style={styles.chipText}>
            {sortOptions.find(s => s.key === filters.sortOrder)?.label || 'Sort'}
          </Text>
        </TouchableOpacity>

        {/* Direction */}
        <TouchableOpacity
          style={styles.chip}
          onPress={() => update({ sortDirection: filters.sortDirection === 'desc' ? 'asc' : 'desc' })}
        >
          <Text style={styles.chipText}>
            {filters.sortDirection === 'desc' ? 'Newest' : 'Oldest'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Org Picker Modal */}
      <PickerModal
        visible={showOrgPicker}
        title="Select Organization"
        items={orgs.map(o => ({ id: o.login, label: o.login }))}
        selectedId={filters.organization}
        onSelect={(id) => {
          update({ organization: id, assignee: undefined });
          setShowOrgPicker(false);
        }}
        onClose={() => setShowOrgPicker(false)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      {/* Assignee Picker Modal */}
      <PickerModal
        visible={showAssigneePicker}
        title="Select Assignee"
        items={[
          { id: '', label: 'All' },
          ...orgMembers.map(m => ({ id: m, label: m })),
        ]}
        selectedId={filters.assignee}
        onSelect={(id) => {
          update({ assignee: id || undefined });
          setShowAssigneePicker(false);
        }}
        onClose={() => setShowAssigneePicker(false)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      {/* Sort Picker Modal */}
      <PickerModal
        visible={showSortPicker}
        title="Sort By"
        items={sortOptions.map(s => ({ id: s.key, label: s.label }))}
        selectedId={filters.sortOrder}
        onSelect={(id) => {
          update({ sortOrder: id as SortOrder });
          setShowSortPicker(false);
        }}
        onClose={() => setShowSortPicker(false)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />
    </View>
  );
};

/* ─── Reusable Picker Modal ─────────────────────────────────── */

interface PickerModalProps {
  visible: boolean;
  title: string;
  items: { id: string; label: string }[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

const PickerModal: React.FC<PickerModalProps> = ({
  visible, title, items, selectedId, onSelect, onClose, searchQuery, setSearchQuery,
}) => {
  const filtered = items.filter(i =>
    i.label.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={pickerStyles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={pickerStyles.sheet}>
          <Text style={pickerStyles.title}>{title}</Text>
          {items.length > 6 && (
            <TextInput
              style={pickerStyles.search}
              placeholder="Search..."
              placeholderTextColor="#8c959f"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
            />
          )}
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  pickerStyles.row,
                  selectedId === item.id && pickerStyles.rowSelected,
                ]}
                onPress={() => { onSelect(item.id); setSearchQuery(''); }}
              >
                <Text style={[
                  pickerStyles.rowText,
                  selectedId === item.id && pickerStyles.rowTextSelected,
                ]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            )}
            style={{ maxHeight: 300 }}
          />
          <TouchableOpacity style={pickerStyles.cancelBtn} onPress={() => { onClose(); setSearchQuery(''); }}>
            <Text style={pickerStyles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

/* ─── Styles ─────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  wrapper: {
    paddingVertical: 8,
  },
  container: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f6f8fa',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d0d7de',
    gap: 6,
  },
  chipActive: {
    backgroundColor: '#ddf4ff',
    borderColor: '#54aeff',
  },
  chipText: {
    fontSize: 12,
    color: '#1f2328',
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#0969da',
    fontWeight: '600',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotOpen: {
    backgroundColor: '#1a7f37',
  },
  dotClosed: {
    backgroundColor: '#8250df',
  },
});

const pickerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '60%',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2328',
    marginBottom: 12,
    textAlign: 'center',
  },
  search: {
    backgroundColor: '#f6f8fa',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#1f2328',
    borderWidth: 1,
    borderColor: '#d0d7de',
    marginBottom: 8,
  },
  row: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  rowSelected: {
    backgroundColor: '#ddf4ff',
  },
  rowText: {
    fontSize: 15,
    color: '#1f2328',
  },
  rowTextSelected: {
    color: '#0969da',
    fontWeight: '600',
  },
  cancelBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#d0d7de',
  },
  cancelText: {
    fontSize: 15,
    color: '#656d76',
    fontWeight: '500',
  },
});

export default FilterBar;
