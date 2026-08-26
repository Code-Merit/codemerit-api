export const lmsRoutes = [
  {
    path: "",
    title: "LMS Manager",
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
    path: '/lms/dashboard',
    title: 'LMS Dashboard',
    iconType: 'material-icons-outlined',
    icon: 'dashboard',
    class: '',
    groupTitle: false,
    badge: '',
    badgeClass: '',
    role: ['User', 'Admin'],
    submenu: [],
  },
  {
    path: '/lms/quizzes',
    title: 'My Quizzes',
    iconType: 'material-icons-outlined',
    icon: 'queue_play_next',
    class: '',
    groupTitle: false,
    badge: '',
    badgeClass: '',
    role: ['User', 'Admin'],
    submenu: [],
  },
  {
    path: '/lms/questions',
    title: 'My Questions',
    iconType: 'material-icons-outlined',
    icon: 'question_answer',
    class: '',
    badge: '',
    badgeClass: '',
    role: ['User', 'Admin'],
    submenu: [],
  },
  // Topics Manager and Certificates (both were role: ['Admin']-only here, i.e. never actually
  // reachable by a non-admin LmsManager permission holder) moved to the Administration menu —
  // see admin.routes.ts. This group now holds only the personal content-authoring workspace,
  // shared by Admins and non-admin LmsManager permission holders alike.
];
