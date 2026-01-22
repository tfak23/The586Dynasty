import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { League, Team, TeamCapSummary, Contract } from './api';

// Rookie pick salary values by overall pick number (default values)
export const DEFAULT_ROOKIE_VALUES: Record<number, number> = {
  1: 45, 2: 38, 3: 32, 4: 27, 5: 23, 6: 19, 7: 16, 8: 14, 9: 13, 10: 12, 11: 11, 12: 10,
  13: 9, 14: 9, 15: 9, 16: 8, 17: 8, 18: 8, 19: 7, 20: 7, 21: 6, 22: 6, 23: 5, 24: 5,
  // Round 3
  25: 1, 26: 1, 27: 1, 28: 1, 29: 1, 30: 1, 31: 1, 32: 1, 33: 1, 34: 1, 35: 1, 36: 1,
  // Round 4
  37: 1, 38: 1, 39: 1, 40: 1, 41: 1, 42: 1, 43: 1, 44: 1, 45: 1, 46: 1, 47: 1, 48: 1,
  // Round 5
  49: 1, 50: 1, 51: 1, 52: 1, 53: 1, 54: 1, 55: 1, 56: 1, 57: 1, 58: 1, 59: 1, 60: 1,
};

// Suggested values for 4-round draft (all round 3+ picks are $1)
export const SUGGESTED_4_ROUND_VALUES: Record<number, number> = {
  1: 45, 2: 38, 3: 32, 4: 27, 5: 23, 6: 19, 7: 16, 8: 14, 9: 13, 10: 12, 11: 11, 12: 10,
  13: 9, 14: 9, 15: 9, 16: 8, 17: 8, 18: 8, 19: 7, 20: 7, 21: 6, 22: 6, 23: 5, 24: 5,
  // Round 3 - all $1
  25: 1, 26: 1, 27: 1, 28: 1, 29: 1, 30: 1, 31: 1, 32: 1, 33: 1, 34: 1, 35: 1, 36: 1,
  // Round 4 - all $1
  37: 1, 38: 1, 39: 1, 40: 1, 41: 1, 42: 1, 43: 1, 44: 1, 45: 1, 46: 1, 47: 1, 48: 1,
};

// Suggested values for 5-round draft (all round 3+ picks are $1)
export const SUGGESTED_5_ROUND_VALUES: Record<number, number> = {
  1: 45, 2: 38, 3: 32, 4: 27, 5: 23, 6: 19, 7: 16, 8: 14, 9: 13, 10: 12, 11: 11, 12: 10,
  13: 9, 14: 9, 15: 9, 16: 8, 17: 8, 18: 8, 19: 7, 20: 7, 21: 6, 22: 6, 23: 5, 24: 5,
  // Round 3 - all $1
  25: 1, 26: 1, 27: 1, 28: 1, 29: 1, 30: 1, 31: 1, 32: 1, 33: 1, 34: 1, 35: 1, 36: 1,
  // Round 4 - all $1
  37: 1, 38: 1, 39: 1, 40: 1, 41: 1, 42: 1, 43: 1, 44: 1, 45: 1, 46: 1, 47: 1, 48: 1,
  // Round 5 - all $1
  49: 1, 50: 1, 51: 1, 52: 1, 53: 1, 54: 1, 55: 1, 56: 1, 57: 1, 58: 1, 59: 1, 60: 1,
};

interface AppSettings {
  rookieDraftRounds: 3 | 4 | 5;
  rookiePickValues: Record<number, number>;
  isOffseason: boolean; // When true, shows draft picks with cap hits
  commissionerTeamIds: string[]; // Team IDs that have commissioner access
}

interface AppState {
  // Current league
  currentLeague: League | null;
  setCurrentLeague: (league: League | null) => void;

  // Current team (user's team)
  currentTeam: Team | null;
  setCurrentTeam: (team: Team | null) => void;

  // Teams list
  teams: Team[];
  setTeams: (teams: Team[]) => void;

  // Cap summaries
  capSummaries: TeamCapSummary[];
  setCapSummaries: (summaries: TeamCapSummary[]) => void;

  // User's roster
  roster: Contract[];
  setRoster: (contracts: Contract[]) => void;

  // Is commissioner
  isCommissioner: boolean;
  setIsCommissioner: (isCommissioner: boolean) => void;

  // Loading states
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;

  // Settings
  settings: AppSettings;
  setRookieDraftRounds: (rounds: 3 | 4 | 5) => void;
  setRookiePickValue: (pickNumber: number, value: number) => void;
  resetPickValuesToSuggested: (rounds: 3 | 4 | 5) => void;
  setIsOffseason: (isOffseason: boolean) => void;
  setCommissionerTeamIds: (teamIds: string[]) => void;
  toggleCommissionerTeam: (teamId: string) => void;

  // Computed: check if current team is commissioner
  currentLeagueId: string | null;

  // Reset all state
  reset: () => void;
}

const getDefaultSettings = (): AppSettings => ({
  rookieDraftRounds: 5,
  rookiePickValues: { ...SUGGESTED_5_ROUND_VALUES },
  isOffseason: true, // Default to true for offseason view
  commissionerTeamIds: [], // No commissioner teams by default
});

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentLeague: null,
      setCurrentLeague: (league) => set({ currentLeague: league }),

      currentTeam: null,
      setCurrentTeam: (team) => set({ currentTeam: team }),

      teams: [],
      setTeams: (teams) => set({ teams }),

      capSummaries: [],
      setCapSummaries: (summaries) => set({ capSummaries: summaries }),

      roster: [],
      setRoster: (contracts) => set({ roster: contracts }),

      isCommissioner: false,
      setIsCommissioner: (isCommissioner) => set({ isCommissioner }),

      isLoading: false,
      setIsLoading: (isLoading) => set({ isLoading }),

      settings: getDefaultSettings(),
      
      setRookieDraftRounds: (rounds) => set((state) => ({ 
        settings: { ...state.settings, rookieDraftRounds: rounds } 
      })),
      
      setRookiePickValue: (pickNumber, value) => set((state) => ({
        settings: {
          ...state.settings,
          rookiePickValues: { ...state.settings.rookiePickValues, [pickNumber]: value }
        }
      })),
      
      resetPickValuesToSuggested: (rounds) => set((state) => {
        let suggestedValues: Record<number, number>;
        switch (rounds) {
          case 4:
            suggestedValues = { ...SUGGESTED_4_ROUND_VALUES };
            break;
          case 5:
            suggestedValues = { ...SUGGESTED_5_ROUND_VALUES };
            break;
          default:
            suggestedValues = { ...DEFAULT_ROOKIE_VALUES };
        }
        return {
          settings: { ...state.settings, rookiePickValues: suggestedValues }
        };
      }),
      
      setIsOffseason: (isOffseason) => set((state) => ({
        settings: { ...state.settings, isOffseason }
      })),

      setCommissionerTeamIds: (teamIds) => set((state) => ({
        settings: { ...state.settings, commissionerTeamIds: teamIds }
      })),

      toggleCommissionerTeam: (teamId) => set((state) => {
        const current = state.settings.commissionerTeamIds || [];
        const isCurrentlyCommissioner = current.includes(teamId);
        const newIds = isCurrentlyCommissioner
          ? current.filter(id => id !== teamId)
          : [...current, teamId];

        // Also update isCommissioner if the toggled team is the current team
        const shouldUpdateIsCommissioner = state.currentTeam?.id === teamId;

        return {
          settings: { ...state.settings, commissionerTeamIds: newIds },
          ...(shouldUpdateIsCommissioner ? { isCommissioner: !isCurrentlyCommissioner } : {}),
        };
      }),

      // Computed property for convenience
      get currentLeagueId() {
        return null; // Will be computed from currentLeague in selector
      },

      reset: () => set({
        currentLeague: null,
        currentTeam: null,
        teams: [],
        capSummaries: [],
        roster: [],
        isCommissioner: false,
        isLoading: false,
        settings: getDefaultSettings(),
      }),
    }),
    {
      name: 'the586-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ settings: state.settings }),
    }
  )
);

// Selectors
export const selectCurrentTeamCap = (state: AppState) => {
  if (!state.currentTeam) return null;
  return state.capSummaries.find(s => s.team_id === state.currentTeam?.id) || null;
};

export const selectTeamCap = (teamId: string) => (state: AppState) => {
  return state.capSummaries.find(s => s.team_id === teamId) || null;
};

export const selectIsCommissioner = (state: AppState) => {
  if (!state.currentTeam) return false;
  return state.settings.commissionerTeamIds.includes(state.currentTeam.id);
};

export const selectCurrentLeagueId = (state: AppState) => {
  return state.currentLeague?.id || null;
};
