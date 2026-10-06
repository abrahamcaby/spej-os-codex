import { TEAM_HOME_MODULES, type TeamHomeModule } from "./team-views";
export type HomeModuleId = TeamHomeModule["id"];
export type HomeLayout = { version: 1; selectedModuleIds: HomeModuleId[]; scope: "mine" | "visible-workspace" };
export function normalizeHomeLayout(raw: unknown, defaults: HomeLayout): HomeLayout {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...defaults, selectedModuleIds: [...defaults.selectedModuleIds] };
  const value = raw as Record<string, unknown>;
  if (value.version !== 1) return { ...defaults, selectedModuleIds: [...defaults.selectedModuleIds] };
  return { version: 1, scope: value.scope === "visible-workspace" ? "visible-workspace" : "mine",
    selectedModuleIds: Array.isArray(value.selectedModuleIds) ? [...new Set(value.selectedModuleIds.filter((id): id is HomeModuleId => TEAM_HOME_MODULES.some((module) => module.id === id)))] : [...defaults.selectedModuleIds] };
}
export function resolveHomeModules(layout: HomeLayout, grantedIds: readonly HomeModuleId[], canView: (route: string) => boolean) {
  return layout.selectedModuleIds.flatMap((id) => {
    const component = TEAM_HOME_MODULES.find((item) => item.id === id);
    return component && grantedIds.includes(id) && canView(component.route) ? [component] : [];
  });
}
export function moveHomeModule(layout: HomeLayout, id: HomeModuleId, direction: -1 | 1): HomeLayout {
  const order = [...layout.selectedModuleIds], from = order.indexOf(id), to = from + direction;
  if (from < 0 || to < 0 || to >= order.length) return layout;
  [order[from], order[to]] = [order[to], order[from]];
  return { ...layout, selectedModuleIds: order };
}
export function homeLayoutKey(profileId: string) { return `spej:local-preview:home-layout:v1:${encodeURIComponent(profileId)}`; }
