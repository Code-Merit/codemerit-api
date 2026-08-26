// Recognition & social proof — kept visitor-visible on purpose (role: ['All']). Badges and
// certificates are the platform's best conversion content for anonymous visitors, so unlike
// "My Assessments" this group isn't gated to signed-in users.
export const achievementsRoutes = [
  {
    path: '',
    title: 'Achievements',
    iconType: '',
    icon: '',
    class: '',
    groupTitle: true,
    badge: '',
    badgeClass: '',
    role: ['All'],
    submenu: [],
  },
  {
    // Public badge explorer (Earned/Relevant/Browse All) — standalone route (see codemerit's
    // app.routes.ts), backed by the equally-public apis/achievements/explorer. Not scoped to any
    // job role.
    path: '/badges',
    title: 'Badges',
    iconType: 'material-icons-outlined',
    icon: 'military_tech',
    class: '',
    groupTitle: false,
    badge: '',
    badgeClass: '',
    role: ['All'],
    submenu: [],
  },
  // Certificates showcase — mirrors /badges above (same visitor-visible reasoning), not yet
  // wired up. Today the only certificate-related frontend route is the admin-facing
  // certification-tracks manager under /lms (src/app/lms/certification-tracks) — there is no
  // public showcase page yet. Uncomment once that page ships.
  // {
  //   path: '/certificates',
  //   title: 'Certificates',
  //   iconType: 'material-icons-outlined',
  //   icon: 'card_membership',
  //   class: '',
  //   groupTitle: false,
  //   badge: '',
  //   badgeClass: '',
  //   role: ['All'],
  //   submenu: [],
  // },
  {
    // Public global XP leaderboard — standalone route (see codemerit's app.routes.ts), not
    // scoped to any job role.
    path: '/leaderboard',
    title: 'Leaderboard',
    iconType: 'material-icons-outlined',
    icon: 'leaderboard',
    class: '',
    groupTitle: false,
    badge: '',
    badgeClass: '',
    role: ['All'],
    submenu: [],
  },
];
