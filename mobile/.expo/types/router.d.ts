/* eslint-disable */
import * as Router from 'expo-router';

export * from 'expo-router';

declare module 'expo-router' {
  export namespace ExpoRouter {
    export interface __routes<T extends string = string> extends Record<string, unknown> {
      StaticRoutes: `/` | `/(tabs)` | `/(tabs)/` | `/(tabs)/history` | `/(tabs)/league` | `/(tabs)/projections` | `/(tabs)/settings` | `/(tabs)/trades` | `/_sitemap` | `/history` | `/league` | `/projections` | `/settings` | `/trade/new` | `/trades`;
      DynamicRoutes: `/contract/${Router.SingleRoutePart<T>}` | `/team/${Router.SingleRoutePart<T>}` | `/trade/${Router.SingleRoutePart<T>}`;
      DynamicRouteTemplate: `/contract/[id]` | `/team/[id]` | `/trade/[id]`;
    }
  }
}
