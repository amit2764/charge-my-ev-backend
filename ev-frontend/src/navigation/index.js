export const USER_TABS = {
  CHARGE: 'charge',
  DISCOVER: 'discover',
  HISTORY: 'history',
  PROFILE: 'profile'
};

export const HOST_TABS = {
  DASHBOARD: 'dashboard',
  EARNINGS: 'earnings',
  PROFILE: 'profile'
};

export const DEFAULT_TAB_BY_ROLE = {
  user: USER_TABS.CHARGE,
  host: HOST_TABS.DASHBOARD
};

export const VALID_TABS_BY_ROLE = {
  user: new Set([USER_TABS.CHARGE, USER_TABS.DISCOVER, USER_TABS.HISTORY, USER_TABS.PROFILE]),
  host: new Set([HOST_TABS.DASHBOARD, HOST_TABS.EARNINGS, HOST_TABS.PROFILE])
};
