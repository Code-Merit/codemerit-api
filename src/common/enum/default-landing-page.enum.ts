// Where a Subscriber/Manager lands right after login (see PostLoginNavigationService).
// AUTO keeps today's resolvePostLoginRoute() waterfall behavior.
export enum DefaultLandingPageEnum {
  AUTO = 'auto',
  PROFILE = 'profile',
  SUBJECT_DASHBOARD = 'subjectDashboard',
  LEARNING_DASHBOARD = 'learningDashboard',
}
