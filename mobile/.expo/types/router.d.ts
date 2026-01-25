/* eslint-disable */
import * as Router from 'expo-router';

export * from 'expo-router';

declare module 'expo-router' {
  export namespace ExpoRouter {
    export interface __routes<T extends string = string> extends Record<string, unknown> {
      StaticRoutes: `/` | `/(tabs)` | `/(tabs)/` | `/(tabs)/history` | `/(tabs)/league` | `/(tabs)/players` | `/(tabs)/projections` | `/(tabs)/settings` | `/(tabs)/trades` | `/_sitemap` | `/buy-ins` | `/commissioner` | `/commissioner/` | `/commissioner/cap` | `/commissioner/history` | `/commissioner/roster` | `/commissioner/rules` | `/commissioner/teams` | `/commissioner/trade` | `/history` | `/league` | `/league-history` | `/players` | `/projections` | `/rules` | `/settings` | `/trade/new` | `/trades`;
      DynamicRoutes: `/contract/${Router.SingleRoutePart<T>}` | `/freeagent/${Router.SingleRoutePart<T>}` | `/team/${Router.SingleRoutePart<T>}` | `/trade/${Router.SingleRoutePart<T>}`;
      DynamicRouteTemplate: `/contract/[id]` | `/freeagent/[id]` | `/team/[id]` | `/trade/[id]`;
    }
  }
}
