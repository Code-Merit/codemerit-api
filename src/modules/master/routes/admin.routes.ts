// Everything an Admin can reach lives inside this one expandable menu — no separate
// "Administration" group header floating above a "Dashboard" toggle, no flat top-level
// duplicates. route.service.ts only injects this array when role === Admin, and suppresses
// the standalone Talent Partner Tools / Manage Interviews groups for Admins (see the isAdmin
// checks there) since Manage Users and Manage Interviews are covered here instead.
export const adminRoutes = [
  {
    path: '',
    title: 'Administration',
    iconType: 'material-icons-outlined',
    icon: 'admin_panel_settings',
    class: 'menu-toggle',
    groupTitle: false,
    badge: '',
    badgeClass: '',
    role: ['Admin'],
    submenu: [
      {
        // Renamed from "LMS Dashboard" — this is the 9-tab Overview hub (People, Content,
        // Engagement, Achievements, Interviews, Plans & Enrollments, Revenue, Trends), the real
        // day-to-day admin command center, so it leads the submenu.
        path: '/admin/dashboard/main',
        title: 'Admin Panel',
        iconType: '',
        icon: '',
        class: 'ml-menu',
        groupTitle: false,
        badge: '',
        badgeClass: '',
        role: ['Admin'],
        submenu: [],
      },
      {
        // Renamed from the old "Admin Panel" — that title now belongs to the page above.
        // This is the older per-subject analytics view (AnalyticsDashboardComponent).
        path: '/admin/dashboard/analysis',
        title: 'Subject Analytics',
        iconType: '',
        icon: '',
        class: 'ml-menu',
        groupTitle: false,
        badge: '',
        badgeClass: '',
        role: ['Admin'],
        submenu: [],
      },
      {
        path: '/users/list',
        title: 'Manage Users',
        iconType: '',
        icon: '',
        class: 'ml-menu',
        groupTitle: false,
        badge: '',
        badgeClass: '',
        role: ['Admin'],
        submenu: [],
      },
      {
        path: '/admin/permissions/list',
        title: 'User Permissions',
        iconType: '',
        icon: '',
        class: 'ml-menu',
        groupTitle: false,
        badge: '',
        badgeClass: '',
        role: ['Admin'],
        submenu: [],
      },
      {
        // Moved out of lmsRoutes — it was already role: ['Admin']-only there, so this changes
        // nothing about who can see it, only where.
        path: '/lms/topics',
        title: 'Topics Manager',
        iconType: '',
        icon: '',
        class: 'ml-menu',
        groupTitle: false,
        badge: '',
        badgeClass: '',
        role: ['Admin'],
        submenu: [],
      },
      {
        // Moved out of lmsRoutes and repointed: the old path (/lms/certificates) had no
        // matching frontend route. The real page is certification-tracks.
        path: '/lms/certification-tracks',
        title: 'Certification Tracks',
        iconType: '',
        icon: '',
        class: 'ml-menu',
        groupTitle: false,
        badge: '',
        badgeClass: '',
        role: ['Admin'],
        submenu: [],
      },
      {
        // Folded in from interviewManagerRoutes — Admin role alone already satisfies
        // InterviewManagerGuard, so Admins get this here instead of a separate top-level item.
        path: '/assessment/manage',
        title: 'Manage Interviews',
        iconType: '',
        icon: '',
        class: 'ml-menu',
        groupTitle: false,
        badge: '',
        badgeClass: '',
        role: ['Admin'],
        submenu: [],
      },
    ],
  },
];

// Conditionally injected by RouteService for anyone holding the Role:TalentPartner permission
// who is NOT an Admin — Admins reach the same /users/list page via Administration > Manage Users
// above instead, so this group is suppressed for them to avoid showing the same destination
// twice. `role: ['All']` here because visibility is already fully decided by that injection
// condition, not by the caller's actual UserRoleEnum value (a Talent Partner's own role is
// typically 'User', not 'Admin').
export const manageUsersRoutes = [
    {
    path: "",
    title: "Talent Partner Tools",
    iconType: "",
    icon: "",
    class: "",
    groupTitle: true,
    badge: "",
    badgeClass: "",
    role: ['User', 'Admin'],
    submenu: []
  },
  {
    path: '/users/list',
    title: 'Tech Talents',
    iconType: 'material-icons-outlined',
    icon: 'supervised_user_circle',
    class: '',
    groupTitle: false,
    badge: '',
    badgeClass: '',
    role: ['All'],
    submenu: [],
  },
];
