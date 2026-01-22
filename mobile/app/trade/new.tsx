import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, Modal } from 'react-native';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius, positionColors } from '@/lib/theme';
import { getTeams, getTeamRoster, createTrade, getTeamDraftPicks } from '@/lib/api';
import { useAppStore } from '@/lib/store';

type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF';

// Format pick display (e.g., "1.02" or "2026 Rd 1")
const formatPickDisplay = (pick: any) => {
  if (pick.pick_number) {
    const round = pick.round;
    const pickInRound = ((pick.pick_number - 1) % 12) + 1;
    return `${pick.season} ${round}.${pickInRound.toString().padStart(2, '0')}`;
  }
  return `${pick.season} Rd ${pick.round}`;
};

type SelectedAsset = {
  type: 'player' | 'pick' | 'cap';
  id: string;
  name: string;
  fromTeamId: string;
  position?: string;
  salary?: number;
  // For picks
  season?: number;
  round?: number;
  // For cap space
  capAmount?: number;
  capYear?: number;
};

export default function NewTradeScreen() {
  const queryClient = useQueryClient();
  const { currentLeague, currentTeam, settings } = useAppStore();

  // Get pick value from settings
  const getPickValue = (pick: any) => {
    if (pick.pick_number) {
      return settings.rookiePickValues[pick.pick_number] || 1;
    }
    const midPick = (pick.round - 1) * 12 + 6;
    return settings.rookiePickValues[midPick] || 1;
  };
  
  const [selectedTeams, setSelectedTeams] = useState<string[]>([currentTeam?.id || '']);
  const [myAssets, setMyAssets] = useState<SelectedAsset[]>([]);
  const [theirAssets, setTheirAssets] = useState<SelectedAsset[]>([]);
  const [notes, setNotes] = useState('');
  const [step, setStep] = useState<'teams' | 'assets' | 'review'>('teams');
  const [activeSelector, setActiveSelector] = useState<'mine' | 'theirs' | null>(null);
  // Cap space modal state
  const [showCapModal, setShowCapModal] = useState(false);
  const [capModalIsMine, setCapModalIsMine] = useState(true);
  const [capAmount, setCapAmount] = useState('');
  const [capYear, setCapYear] = useState(2026);

  const { data: teams } = useQuery({
    queryKey: ['teams', currentLeague?.id],
    queryFn: async () => {
      if (!currentLeague) return [];
      const res = await getTeams(currentLeague.id);
      return res.data.data;
    },
    enabled: !!currentLeague,
  });

  const tradingPartner = teams?.find((t: any) => 
    selectedTeams.includes(t.id) && t.id !== currentTeam?.id
  );

  const { data: myRoster } = useQuery({
    queryKey: ['roster', currentTeam?.id],
    queryFn: async () => {
      if (!currentTeam) return null;
      const res = await getTeamRoster(currentTeam.id);
      return res.data.data;
    },
    enabled: !!currentTeam && step === 'assets',
  });

  const { data: theirRoster } = useQuery({
    queryKey: ['roster', tradingPartner?.id],
    queryFn: async () => {
      if (!tradingPartner) return null;
      const res = await getTeamRoster(tradingPartner.id);
      return res.data.data;
    },
    enabled: !!tradingPartner && step === 'assets',
  });

  const { data: myDraftPicks } = useQuery({
    queryKey: ['draftPicks', currentTeam?.id],
    queryFn: async () => {
      if (!currentTeam) return [];
      const res = await getTeamDraftPicks(currentTeam.id);
      return res.data.data || [];
    },
    enabled: !!currentTeam && step === 'assets',
  });

  const { data: theirDraftPicks } = useQuery({
    queryKey: ['draftPicks', tradingPartner?.id],
    queryFn: async () => {
      if (!tradingPartner) return [];
      const res = await getTeamDraftPicks(tradingPartner.id);
      return res.data.data || [];
    },
    enabled: !!tradingPartner && step === 'assets',
  });

  // Helper to add cap space
  const addCapSpace = () => {
    const amount = parseFloat(capAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid cap amount');
      return;
    }

    const capAsset: SelectedAsset = {
      type: 'cap',
      id: `cap-${Date.now()}`,
      name: `$${amount} cap (${capYear})`,
      fromTeamId: capModalIsMine ? currentTeam?.id || '' : tradingPartner?.id || '',
      capAmount: amount,
      capYear: capYear,
    };

    if (capModalIsMine) {
      setMyAssets([...myAssets, capAsset]);
    } else {
      setTheirAssets([...theirAssets, capAsset]);
    }

    setShowCapModal(false);
    setCapAmount('');
    setCapYear(2026);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!currentLeague || !currentTeam || !tradingPartner) {
        throw new Error('Missing required data');
      }

      // Build assets array for the new trade API format
      const assets = [];

      // My assets go TO trading partner
      for (const asset of myAssets) {
        if (asset.type === 'player') {
          assets.push({
            from_team_id: currentTeam.id,
            to_team_id: tradingPartner.id,
            asset_type: 'contract',
            contract_id: asset.id,
          });
        } else if (asset.type === 'pick') {
          assets.push({
            from_team_id: currentTeam.id,
            to_team_id: tradingPartner.id,
            asset_type: 'draft_pick',
            draft_pick_id: asset.id,
          });
        } else if (asset.type === 'cap') {
          assets.push({
            from_team_id: currentTeam.id,
            to_team_id: tradingPartner.id,
            asset_type: 'cap_space',
            cap_amount: asset.capAmount,
            cap_year: asset.capYear,
          });
        }
      }

      // Their assets come TO me
      for (const asset of theirAssets) {
        if (asset.type === 'player') {
          assets.push({
            from_team_id: tradingPartner.id,
            to_team_id: currentTeam.id,
            asset_type: 'contract',
            contract_id: asset.id,
          });
        } else if (asset.type === 'pick') {
          assets.push({
            from_team_id: tradingPartner.id,
            to_team_id: currentTeam.id,
            asset_type: 'draft_pick',
            draft_pick_id: asset.id,
          });
        } else if (asset.type === 'cap') {
          assets.push({
            from_team_id: tradingPartner.id,
            to_team_id: currentTeam.id,
            asset_type: 'cap_space',
            cap_amount: asset.capAmount,
            cap_year: asset.capYear,
          });
        }
      }

      return createTrade({
        league_id: currentLeague.id,
        team_ids: [currentTeam.id, tradingPartner.id],
        assets,
        notes,
      });
    },
    onSuccess: () => {
      Alert.alert('Success', 'Trade proposal sent!');
      queryClient.invalidateQueries();
      router.back();
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to create trade');
    },
  });

  const handleSelectTeam = (teamId: string) => {
    if (teamId === currentTeam?.id) return;
    
    setSelectedTeams([currentTeam?.id || '', teamId]);
    setTheirAssets([]);
  };

  const toggleAsset = (asset: SelectedAsset, isMine: boolean) => {
    if (isMine) {
      const exists = myAssets.find(a => a.id === asset.id);
      if (exists) {
        setMyAssets(myAssets.filter(a => a.id !== asset.id));
      } else {
        setMyAssets([...myAssets, asset]);
      }
    } else {
      const exists = theirAssets.find(a => a.id === asset.id);
      if (exists) {
        setTheirAssets(theirAssets.filter(a => a.id !== asset.id));
      } else {
        setTheirAssets([...theirAssets, asset]);
      }
    }
  };

  const renderTeamSelection = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Select Trading Partner</Text>
      <Text style={styles.stepSubtitle}>Choose a team to trade with</Text>
      
      <ScrollView style={styles.teamList}>
        {teams?.filter((t: any) => t.id !== currentTeam?.id).map((team: any) => (
          <TouchableOpacity
            key={team.id}
            style={[
              styles.teamOption,
              selectedTeams.includes(team.id) && styles.teamOptionSelected,
            ]}
            onPress={() => handleSelectTeam(team.id)}
          >
            <View style={styles.teamOptionInfo}>
              <Text style={styles.teamOptionName}>{team.team_name}</Text>
              <Text style={styles.teamOptionOwner}>{team.owner_name}</Text>
            </View>
            {selectedTeams.includes(team.id) && (
              <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity 
        style={!tradingPartner ? styles.nextButtonDisabled : styles.nextButton}
        onPress={() => setStep('assets')}
        disabled={!tradingPartner}
      >
        <Text style={styles.nextButtonText}>Next: Select Assets</Text>
        <Ionicons name="arrow-forward" size={20} color={colors.white} />
      </TouchableOpacity>
    </View>
  );

  const renderAssetSelector = (roster: any, draftPicks: any[], isMine: boolean) => {
    const selectedAssets = isMine ? myAssets : theirAssets;
    // roster is now an array directly, not roster.contracts
    const contracts = Array.isArray(roster) ? roster : [];
    // Filter picks by round settings
    const picks = (draftPicks || []).filter((p: any) => p.round <= settings.rookieDraftRounds);

    return (
      <View style={styles.assetSection}>
        <Text style={styles.assetSectionTitle}>
          {isMine ? 'Your Assets' : `${tradingPartner?.team_name}'s Assets`}
        </Text>
        
        <Text style={styles.assetGroupLabel}>Players</Text>
        {contracts.map((contract: any) => {
          const isSelected = selectedAssets.some(a => a.id === contract.id);
          const position = contract.position as Position;
          
          return (
            <TouchableOpacity
              key={contract.id}
              style={isSelected ? styles.assetOptionSelected : styles.assetOption}
              onPress={() => toggleAsset({
                type: 'player',
                id: contract.id,
                name: contract.full_name,
                fromTeamId: isMine ? currentTeam?.id || '' : tradingPartner?.id || '',
                position: contract.position,
                salary: contract.salary,
              }, isMine)}
            >
              <View style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.sm, marginRight: spacing.sm, backgroundColor: positionColors[position] || colors.textMuted }}>
                <Text style={styles.positionText}>{contract.position}</Text>
              </View>
              <View style={styles.assetInfo}>
                <Text style={styles.assetName}>{contract.full_name}</Text>
                <Text style={styles.assetDetails}>
                  ${Number(contract.salary).toFixed(2)}/yr • {contract.years_remaining}yr
                </Text>
              </View>
              {isSelected && (
                <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
              )}
            </TouchableOpacity>
          );
        })}

        {contracts.length === 0 && (
          <Text style={styles.noAssetsText}>No players available</Text>
        )}

        <Text style={styles.assetGroupLabel}>Draft Picks</Text>
        {picks.sort((a: any, b: any) => {
          // Sort by season, then by pick_number or round
          if (a.season !== b.season) return a.season - b.season;
          if (a.pick_number && b.pick_number) return a.pick_number - b.pick_number;
          return a.round - b.round;
        }).map((pick: any) => {
          const isSelected = selectedAssets.some(a => a.id === pick.id);
          const pickDisplay = formatPickDisplay(pick);
          const pickValue = getPickValue(pick);
          const isTraded = pick.original_team_id !== pick.current_team_id;
          const tradedFrom = isTraded && pick.original_team_name ? ` (via ${pick.original_team_name})` : '';
          
          return (
            <TouchableOpacity
              key={pick.id}
              style={isSelected ? styles.assetOptionSelected : styles.assetOption}
              onPress={() => toggleAsset({
                type: 'pick',
                id: pick.id,
                name: `${pickDisplay}${tradedFrom}`,
                fromTeamId: isMine ? currentTeam?.id || '' : tradingPartner?.id || '',
                season: pick.season,
                round: pick.round,
              }, isMine)}
            >
              <View style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.sm, marginRight: spacing.sm, backgroundColor: colors.secondary }}>
                <Text style={styles.positionText}>PICK</Text>
              </View>
              <View style={styles.assetInfo}>
                <Text style={styles.assetName}>{pickDisplay}{tradedFrom}</Text>
                <Text style={styles.assetDetails}>${pickValue}/yr • {pick.round <= 2 ? '4yr + option' : '2yr'}</Text>
              </View>
              {isSelected && (
                <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
              )}
            </TouchableOpacity>
          );
        })}

        {picks.length === 0 && (
          <Text style={styles.noAssetsText}>No draft picks available</Text>
        )}

        {/* Cap Space Section */}
        <Text style={styles.assetGroupLabel}>Cap Space</Text>
        {selectedAssets.filter(a => a.type === 'cap').map(capAsset => (
          <TouchableOpacity
            key={capAsset.id}
            style={styles.assetOptionSelected}
            onPress={() => toggleAsset(capAsset, isMine)}
          >
            <View style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.sm, marginRight: spacing.sm, backgroundColor: colors.warning }}>
              <Text style={styles.positionText}>CAP</Text>
            </View>
            <View style={styles.assetInfo}>
              <Text style={styles.assetName}>${capAsset.capAmount} cap relief</Text>
              <Text style={styles.assetDetails}>Year: {capAsset.capYear}</Text>
            </View>
            <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={styles.addCapButton}
          onPress={() => {
            setCapModalIsMine(isMine);
            setShowCapModal(true);
          }}
        >
          <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
          <Text style={styles.addCapButtonText}>Add Cap Space</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderAssetSelection = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Select Assets</Text>
      <Text style={styles.stepSubtitle}>
        {currentTeam?.team_name} ↔ {tradingPartner?.team_name}
      </Text>
      
      <ScrollView style={styles.assetsList}>
        {renderAssetSelector(myRoster, myDraftPicks || [], true)}
        
        <View style={styles.tradeDivider}>
          <View style={styles.dividerLine} />
          <Ionicons name="swap-horizontal" size={24} color={colors.primary} />
          <View style={styles.dividerLine} />
        </View>
        
        {renderAssetSelector(theirRoster, theirDraftPicks || [], false)}
      </ScrollView>

      <View style={styles.buttonRow}>
        <TouchableOpacity 
          style={styles.backStepButton}
          onPress={() => setStep('teams')}
        >
          <Ionicons name="arrow-back" size={20} color={colors.primary} />
          <Text style={styles.backStepButtonText}>Back</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={(myAssets.length === 0 && theirAssets.length === 0) ? styles.nextButtonDisabledFlex : styles.nextButtonFlex}
          onPress={() => setStep('review')}
          disabled={myAssets.length === 0 && theirAssets.length === 0}
        >
          <Text style={styles.nextButtonText}>Review Trade</Text>
          <Ionicons name="arrow-forward" size={20} color={colors.white} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderReview = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Review Trade</Text>
      
      <ScrollView style={styles.reviewContent}>
        {/* Your side */}
        <View style={styles.reviewSection}>
          <Text style={styles.reviewTeamName}>{currentTeam?.team_name} sends:</Text>
          {myAssets.map(asset => {
            // Determine badge color and text based on asset type
            let badgeColor = colors.textMuted;
            let badgeText = 'PICK';
            if (asset.type === 'player' && asset.position) {
              badgeColor = positionColors[asset.position as Position] || colors.textMuted;
              badgeText = asset.position;
            } else if (asset.type === 'pick') {
              badgeColor = colors.secondary;
              badgeText = 'PICK';
            } else if (asset.type === 'cap') {
              badgeColor = colors.warning;
              badgeText = 'CAP';
            }
            return (
              <View key={asset.id} style={styles.reviewAsset}>
                <View style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.sm, marginRight: spacing.sm, backgroundColor: badgeColor }}>
                  <Text style={styles.positionText}>{badgeText}</Text>
                </View>
                <Text style={styles.reviewAssetName}>{asset.name}</Text>
              </View>
            );
          })}
          {myAssets.length === 0 && (
            <Text style={styles.noAssetsText}>Nothing</Text>
          )}
        </View>

        <View style={styles.reviewDivider}>
          <Ionicons name="swap-vertical" size={24} color={colors.primary} />
        </View>

        {/* Their side */}
        <View style={styles.reviewSection}>
          <Text style={styles.reviewTeamName}>{tradingPartner?.team_name} sends:</Text>
          {theirAssets.map(asset => {
            // Determine badge color and text based on asset type
            let badgeColor = colors.textMuted;
            let badgeText = 'PICK';
            if (asset.type === 'player' && asset.position) {
              badgeColor = positionColors[asset.position as Position] || colors.textMuted;
              badgeText = asset.position;
            } else if (asset.type === 'pick') {
              badgeColor = colors.secondary;
              badgeText = 'PICK';
            } else if (asset.type === 'cap') {
              badgeColor = colors.warning;
              badgeText = 'CAP';
            }
            return (
              <View key={asset.id} style={styles.reviewAsset}>
                <View style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.sm, marginRight: spacing.sm, backgroundColor: badgeColor }}>
                  <Text style={styles.positionText}>{badgeText}</Text>
                </View>
                <Text style={styles.reviewAssetName}>{asset.name}</Text>
              </View>
            );
          })}
          {theirAssets.length === 0 && (
            <Text style={styles.noAssetsText}>Nothing</Text>
          )}
        </View>

        {/* Notes */}
        <View style={styles.notesSection}>
          <Text style={styles.notesLabel}>Add a note (optional)</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Any additional details..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
          />
        </View>
      </ScrollView>

      <View style={styles.buttonRow}>
        <TouchableOpacity 
          style={styles.backStepButton}
          onPress={() => setStep('assets')}
        >
          <Ionicons name="arrow-back" size={20} color={colors.primary} />
          <Text style={styles.backStepButtonText}>Back</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.submitButtonFlex}
          onPress={() => createMutation.mutate()}
          disabled={createMutation.isPending}
        >
          <Text style={styles.submitButtonText}>
            {createMutation.isPending ? 'Sending...' : 'Send Trade Offer'}
          </Text>
          <Ionicons name="send" size={20} color={colors.white} />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (!currentTeam || !currentLeague) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={64} color={colors.error} />
        <Text style={styles.errorText}>Please connect a league first</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Trade</Text>
      </View>

      {/* Progress */}
      <View style={styles.progress}>
        <View style={step === 'teams' ? styles.progressStepActive : styles.progressStep}>
          <Text style={styles.progressText}>1. Partner</Text>
        </View>
        <View style={styles.progressLine} />
        <View style={step === 'assets' ? styles.progressStepActive : styles.progressStep}>
          <Text style={styles.progressText}>2. Assets</Text>
        </View>
        <View style={styles.progressLine} />
        <View style={step === 'review' ? styles.progressStepActive : styles.progressStep}>
          <Text style={styles.progressText}>3. Review</Text>
        </View>
      </View>

      {/* Step Content */}
      {step === 'teams' && renderTeamSelection()}
      {step === 'assets' && renderAssetSelection()}
      {step === 'review' && renderReview()}

      {/* Cap Space Modal */}
      <Modal
        visible={showCapModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCapModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Cap Space</Text>
              <TouchableOpacity onPress={() => setShowCapModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDescription}>
              {capModalIsMine
                ? `${currentTeam?.team_name} will absorb this cap hit (the other team gets cap relief)`
                : `${tradingPartner?.team_name} will absorb this cap hit (you get cap relief)`}
            </Text>

            <Text style={styles.inputLabel}>Cap Amount ($)</Text>
            <TextInput
              style={styles.capInput}
              value={capAmount}
              onChangeText={setCapAmount}
              placeholder="e.g., 10"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
            />

            <Text style={styles.inputLabel}>Year</Text>
            <View style={styles.yearButtons}>
              {[2026, 2027, 2028, 2029, 2030].map(year => (
                <TouchableOpacity
                  key={year}
                  style={capYear === year ? styles.yearButtonActive : styles.yearButton}
                  onPress={() => setCapYear(year)}
                >
                  <Text style={capYear === year ? styles.yearButtonTextActive : styles.yearButtonText}>
                    {year}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.addCapConfirmButton} onPress={addCapSpace}>
              <Text style={styles.addCapConfirmText}>Add Cap Space</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  errorText: {
    color: colors.text,
    fontSize: fontSize.lg,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  backBtn: {
    padding: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
  },
  backBtnText: {
    color: colors.white,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.sm,
    marginRight: spacing.sm,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.text,
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  progressStep: {
    flex: 1,
    alignItems: 'center',
    opacity: 0.5,
  },
  progressStepActive: {
    flex: 1,
    alignItems: 'center',
    opacity: 1,
  },
  progressText: {
    fontSize: fontSize.sm,
    color: colors.text,
    fontWeight: '600',
  },
  progressLine: {
    width: 20,
    height: 2,
    backgroundColor: colors.border,
  },
  stepContent: {
    flex: 1,
    padding: spacing.md,
  },
  stepTitle: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.text,
  },
  stepSubtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  teamList: {
    flex: 1,
  },
  teamOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  teamOptionSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  teamOptionInfo: {
    flex: 1,
  },
  teamOptionName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  teamOptionOwner: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
  },
  nextButtonDisabled: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
    opacity: 0.5,
  },
  nextButtonFlex: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginLeft: spacing.sm,
  },
  nextButtonDisabledFlex: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginLeft: spacing.sm,
    opacity: 0.5,
  },
  nextButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: fontSize.md,
    marginRight: spacing.sm,
  },
  assetsList: {
    flex: 1,
  },
  assetSection: {
    marginBottom: spacing.md,
  },
  assetSectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  assetGroupLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  assetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  assetOptionSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  positionBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginRight: spacing.sm,
  },
  positionText: {
    color: colors.white,
    fontSize: fontSize.xs,
    fontWeight: 'bold',
  },
  assetInfo: {
    flex: 1,
  },
  assetName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  assetDetails: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  noAssetsText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontStyle: 'italic',
    padding: spacing.md,
  },
  tradeDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
  },
  backStepButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
  },
  backStepButtonText: {
    color: colors.primary,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
  reviewContent: {
    flex: 1,
  },
  reviewSection: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  reviewTeamName: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  reviewAsset: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  reviewAssetName: {
    fontSize: fontSize.md,
    color: colors.text,
    flex: 1,
  },
  reviewDivider: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  notesSection: {
    marginTop: spacing.lg,
  },
  notesLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  notesInput: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  submitButtonFlex: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginLeft: spacing.sm,
  },
  submitButtonText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: fontSize.md,
    marginRight: spacing.sm,
  },
  // Cap space styles
  addCapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  addCapButtonText: {
    color: colors.primary,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.text,
  },
  modalDescription: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  inputLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  capInput: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.lg,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  yearButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  yearButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.backgroundSecondary,
  },
  yearButtonActive: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
  },
  yearButtonText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  yearButtonTextActive: {
    color: colors.white,
    fontWeight: '600',
  },
  addCapConfirmButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  addCapConfirmText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: fontSize.md,
  },
});
