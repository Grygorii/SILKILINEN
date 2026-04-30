import styles from './page.module.css';

export default function ContactPage() {
  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <h1>Get in touch.</h1>
        <p>We'd love to hear from you.</p>
      </div>
      <div className={styles.inner}>
        <div className={styles.info}>
          <div className={styles.block}>
            <h3>Email</h3>
            <p>hello@silkilinen.com</p>
          </div>
          <div className={styles.block}>
            <h3>Based in</h3>
            <p>Dublin, Ireland</p>
          </div>
          <div className={styles.block}>
            <h3>Shipping</h3>
            <p>Worldwide</p>
          </div>
        </div>
        <div className={styles.form}>
          <input type="text" placeholder="Your name" />
          <input type="email" placeholder="Email address" />
          <textarea rows={6} placeholder="Your message"></textarea>
          <button>Send message</button>
        </div>
      </div>
    </main>
  );
}