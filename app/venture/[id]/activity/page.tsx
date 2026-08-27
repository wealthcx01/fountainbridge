import ActivityPage from '@/app/activity/page';

/**
 * What happened, inside the venture shell (FB-124).
 *
 * The rail lists it, so it renders here to sit inside the layout.
 *
 * **This is a shim, and FB-132 finishes the job.** `/app/activity` is cross-venture today —
 * `loadAccessibleHealth` spans every venture the viewer can reach — while the design puts this screen
 * inside one venture's rail, showing that venture's events. Narrowing it is a real change to what a
 * founder sees and belongs with the screen's own rebuild, not smuggled into a shell ticket.
 *
 * Until then a founder reaching it from the rail sees the same feed they see today, in the new shell.
 * That is honest; what would not be is a feed that silently looked venture-scoped and was not.
 */
export default ActivityPage;
