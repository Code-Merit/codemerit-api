// Visible to every signed-in user — mirrors welcomeRoutes' `role: ['All']` convention.
export const interviewRoutes = [
  {
    path: '/assessment/schedule',
    title: 'Schedule Interview',
    iconType: 'material-icons-outlined',
    icon: 'event_available',
    class: '',
    groupTitle: false,
    "badge": "New",
    "badgeClass": "badge bg-blue sidebar-badge float-end",
    role: ['All'],
    submenu: [],
  },
  {
    path: '/assessment/scheduled',
    title: 'My Interviews',
    iconType: 'material-icons-outlined',
    icon: 'video_camera_front',
    class: '',
    groupTitle: false,
    badge: '',
    badgeClass: '',
    role: ['All'],
    submenu: [],
  },
];

// Conditionally injected by RouteService for Admin (by role) OR anyone holding the
// Role:InterviewManager permission (by permission, not role) — mirrors manageUsersRoutes in
// admin.routes.ts and matches InterviewManagerGuard's own access check. `role: ['All']` here
// because visibility is already fully decided by that injection condition.
export const interviewManagerRoutes = [
  {
    path: '/assessment/manage',
    title: 'Manage Interviews',
    iconType: 'material-icons-outlined',
    icon: 'manage_accounts',
    class: '',
    groupTitle: false,
    badge: '',
    badgeClass: '',
    role: ['All'],
    submenu: [],
  },
];
