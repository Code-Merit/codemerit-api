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

// Gated on the dedicated `SME` permission (see UserPermissionEnum.Sme), not on LmsManager.
export const smeInterviewRoutes = [
  {
    path: '/interview-panel/test',
    title: 'Interview',
    iconType: 'material-icons-outlined',
    icon: 'record_voice_over',
    class: '',
    groupTitle: false,
    badge: '',
    badgeClass: '',
    role: ['SME'],
    submenu: [],
  },
];
