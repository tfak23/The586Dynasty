import React from 'react';
import { View, ScrollView, StyleSheet, Text } from 'react-native';
import { Stack } from 'expo-router';
import GoogleDocsIntegration from '@/components/GoogleDocsIntegration';
import { colors, spacing } from '@/lib/theme';

export default function GoogleDocsScreen() {
  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'Google Docs Integration',
          headerShown: true,
        }} 
      />
      <ScrollView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.description}>
            Use Google Docs to import and export league data. You can read from Google Docs
            using an API key, making it easy to sync data from shared documents.
          </Text>
          
          <GoogleDocsIntegration 
            onDataImported={(data) => {
              console.log('Imported data:', data);
              // Handle imported data here
            }}
          />
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
});
