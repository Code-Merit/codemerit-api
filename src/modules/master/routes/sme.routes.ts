export const smeRoutes = [
  {
    path: '/sme/dashboard',
    title: 'SME Dashboard',
    iconType: 'material-icons-outlined',
    icon: 'star',
    class: '',
    groupTitle: false,
    badge: '',
    badgeClass: '',
    role: ['SME'],
    submenu: [],
  },
];

// Gated on the dedicated `SME` permission (see UserPermissionEnum.Sme), not on LmsManager —
// injected by RouteService only when the user holds that permission. `role: ['All']` here because
// visibility is already fully decided by that injection condition (same convention as
// interviewManagerRoutes in interview.routes.ts) — `role: ['SME']` doesn't match any real
// UserRoleEnum value (User/Admin/Moderator), so it silently filtered this item out for everyone.
export const smeInterviewRoutes = [
  {
    path: '/assessment/panel',
    title: 'My Interview Rounds',
    iconType: 'material-icons-outlined',
    icon: 'record_voice_over',
    class: '',
    groupTitle: false,
    badge: '',
    badgeClass: '',
    role: ['All'],
    submenu: [],
  },
];
