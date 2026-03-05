import { redirect } from 'next/navigation';
import { DASHBOARD_HOME_PATH } from '@/features/dashboards/config/availableDashboards';

export default function CollectionsPage() {
    redirect(DASHBOARD_HOME_PATH);
}
