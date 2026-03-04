import { redirect } from 'next/navigation';

export default function HomePage() {
    // Auth is enforced in middleware; root is just an entrypoint.
    redirect('/collections');
}
