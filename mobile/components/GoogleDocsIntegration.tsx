import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { readGoogleDoc, extractTextFromDoc, parseDocAsTable, isGoogleDocsConfigured } from '@/lib/googleDocs';
import { colors } from '@/lib/theme';

interface GoogleDocsIntegrationProps {
  onDataImported?: (data: any) => void;
}

export const GoogleDocsIntegration: React.FC<GoogleDocsIntegrationProps> = ({ onDataImported }) => {
  const [documentId, setDocumentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const isConfigured = isGoogleDocsConfigured();

  const extractDocumentId = (url: string): string => {
    // Extract document ID from various Google Docs URL formats
    const patterns = [
      /\/document\/d\/([a-zA-Z0-9-_]+)/,
      /^([a-zA-Z0-9-_]+)$/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }

    return url;
  };

  const handleReadDocument = async () => {
    if (!documentId.trim()) {
      setError('Please enter a document ID or URL');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const docId = extractDocumentId(documentId.trim());
      const response = await readGoogleDoc(docId);

      if (response.success) {
        const text = extractTextFromDoc(response.data);
        const tableData = parseDocAsTable(response.data);

        setResult({
          title: response.title,
          text,
          tableData,
          raw: response.data
        });

        if (onDataImported && tableData.length > 0) {
          onDataImported(tableData);
        }
      } else {
        setError(response.error || 'Failed to read document');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!isConfigured) {
    return (
      <View style={styles.container}>
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>⚠️ Google Docs API Not Configured</Text>
          <Text style={styles.warningSubtext}>
            Please set EXPO_PUBLIC_GOOGLE_DOCS_API_KEY in your environment to enable Google Docs integration.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Google Docs Integration</Text>
      <Text style={styles.subtitle}>
        Import league data from a Google Doc
      </Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Document ID or URL</Text>
        <TextInput
          style={styles.input}
          value={documentId}
          onChangeText={setDocumentId}
          placeholder="Enter Google Doc ID or paste URL"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleReadDocument}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Read Document</Text>
        )}
      </TouchableOpacity>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>❌ {error}</Text>
        </View>
      ) : null}

      {result ? (
        <ScrollView style={styles.resultContainer}>
          <Text style={styles.resultTitle}>✅ Document Read Successfully</Text>
          
          <View style={styles.resultSection}>
            <Text style={styles.resultLabel}>Title:</Text>
            <Text style={styles.resultValue}>{result.title}</Text>
          </View>

          <View style={styles.resultSection}>
            <Text style={styles.resultLabel}>Text Content:</Text>
            <Text style={styles.resultValue} numberOfLines={10}>
              {result.text.substring(0, 500)}
              {result.text.length > 500 ? '...' : ''}
            </Text>
          </View>

          {result.tableData.length > 0 ? (
            <View style={styles.resultSection}>
              <Text style={styles.resultLabel}>
                Table Data ({result.tableData.length} rows):
              </Text>
              <Text style={styles.resultValue}>
                {result.tableData.slice(0, 5).map((row: string[], idx: number) => 
                  `Row ${idx + 1}: ${row.join(', ')}`
                ).join('\n')}
                {result.tableData.length > 5 ? `\n... and ${result.tableData.length - 5} more rows` : ''}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: '#ff000020',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ff0000',
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 14,
  },
  warningBox: {
    backgroundColor: '#ffaa0020',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ffaa00',
  },
  warningText: {
    color: '#ffaa00',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  warningSubtext: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  resultContainer: {
    maxHeight: 400,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4ade80',
    marginBottom: 16,
  },
  resultSection: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: 8,
  },
  resultLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  resultValue: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});

export default GoogleDocsIntegration;
