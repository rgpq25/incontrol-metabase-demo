import { redirect } from 'next/navigation';
import { DASHBOARD_HOME_PATH } from '@/features/dashboards/config/availableDashboards';

export default function HomePage() {
    // Auth is enforced in middleware; root is just an entrypoint.
    redirect(DASHBOARD_HOME_PATH);
}
