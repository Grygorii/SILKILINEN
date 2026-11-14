import AdminLayout from '@/components/AdminLayout';
import ManualAiPanel from '../seo/ManualAiPanel';
import styles from '../seo/page.module.css';

export default function ManualAiPage() {
  return (
    <AdminLayout>
      <div className={styles.header}>
        <h1 className={styles.title}>Manual AI</h1>
        <p className={styles.intro}>
          A separate workspace for running reviewed AI jobs with a subscription you already have.
          Every workflow prepares the right facts, checks the reply, and asks for your approval before publishing.
        </p>
      </div>
      <div className={styles.panel}>
        <ManualAiPanel />
      </div>
    </AdminLayout>
  );
}
