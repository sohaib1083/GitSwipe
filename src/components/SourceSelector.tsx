import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { IssueSource } from '../types';

interface SourceSelectorProps {
  selected: IssueSource;
  onChange: (source: IssueSource) => void;
}

const SOURCES: { key: IssueSource; label: string }[] = [
  { key: 'all', label: 'My Issues' },
  { key: 'organization', label: 'Organization' },
];

const SourceSelector: React.FC<SourceSelectorProps> = ({ selected, onChange }) => {
  return (
    <View style={styles.container}>
      {SOURCES.map((src) => {
        const active = selected === src.key;
        return (
          <TouchableOpacity
            key={src.key}
            style={[styles.tab, active && styles.tabActive]}
            onPress={() => onChange(src.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {src.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#f6f8fa',
    borderRadius: 10,
    padding: 3,
    marginHorizontal: 16,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: '#656d76',
  },
  labelActive: {
    color: '#1f2328',
    fontWeight: '600',
  },
});

export default SourceSelector;
