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

// Suggested values for 4-round draft (slightly lower round 3 values)
export const SUGGESTED_4_ROUND_VALUES: Record<number, number> = {
  1: 45, 2: 38, 3: 32, 4: 27, 5: 23, 6: 19, 7: 16, 8: 14, 9: 13, 10: 12, 11: 11, 12: 10,
  13: 9, 14: 9, 15: 9, 16: 8, 17: 8, 18: 8, 19: 7, 20: 7, 21: 6, 22: 6, 23: 5, 24: 5,
  // Round 3 - $2 for top half, $1 for bottom half
  25: 2, 26: 2, 27: 2, 28: 2, 29: 2, 30: 2, 31: 1, 32: 1, 33: 1, 34: 1, 35: 1, 36: 1,
  // Round 4
  37: 1, 38: 1, 39: 1, 40: 1, 41: 1, 42: 1, 43: 1, 44: 1, 45: 1, 46: 1, 47: 1, 48: 1,
};

// Suggested values for 5-round draft (graduated round 3-4 values)
export const SUGGESTED_5_ROUND_VALUES: Record<number, number> = {
  1: 45, 2: 38, 3: 32, 4: 27, 5: 23, 6: 19, 7: 16, 8: 14, 9: 13, 10: 12, 11: 11, 12: 10,
  13: 9, 14: 9, 15: 9, 16: 8, 17: 8, 18: 8, 19: 7, 20: 7, 21: 6, 22: 6, 23: 5, 24: 5,
  // Round 3 - $3 for top third, $2 for middle, $1 for bottom
  25: 3, 26: 3, 27: 3, 28: 3, 29: 2, 30: 2, 31: 2, 32: 2, 33: 1, 34: 1, 35: 1, 36: 1,
  // Round 4 - $2 for top half, $1 for bottom
  37: 2, 38: 2, 39: 2, 40: 2, 41: 2, 42: 2, 43: 1, 44: 1, 45: 1, 46: 1, 47: 1, 48: 1,
  // Round 5
  49: 1, 50: 1, 51: 1, 52: 1, 53: 1, 54: 1, 55: 1, 56: 1, 57: 1, 58: 1, 59: 1, 60: 1,
};

interface AppSettings {
  rookieDraftRounds: 3 | 4 | 5;
  rookiePickValues: Record<number, number>;
  isOffseason: boolean; // When true, shows draft picks with cap hits
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

  // Reset all state
  reset: () => void;
}

const getDefaultSettings = (): AppSettings => ({
  rookieDraftRounds: 5,
  rookiePickValues: { ...SUGGESTED_5_ROUND_VALUES },
  isOffseason: true, // Default to true for offseason view
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
