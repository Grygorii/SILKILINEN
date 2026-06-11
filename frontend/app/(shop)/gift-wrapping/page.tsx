import styles from '../legal.module.css';

export const metadata = {
  title: 'Gift Wrapping',
  description: 'Every SILKILINEN order arrives gift-ready — wrapped in a tissue-lined box with silk ribbon, at no extra cost.',
  alternates: { canonical: 'https://www.silkilinen.com/gift-wrapping' },
};

export default function GiftWrappingPage() {
  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <h1>Gift Wrapping</h1>
          <p>Every order arrives ready to give — beautifully, and at no extra cost.</p>
        </header>

        <div className={styles.highlight}>
          Gift wrapping is <strong>included on every order</strong>. There is nothing to add at
          checkout — your pieces arrive wrapped and ready to gift.
        </div>

        <section className={styles.section}>
          <h2>How it arrives</h2>
          <p>
            Each piece is folded in tissue, placed in our signature box, and finished with a
            silk ribbon. The same care we put into the garment, we put into the way it
            reaches you — or whoever you are sending it to.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Add a personal note</h2>
          <p>
            Sending it as a gift? Add your message in the order notes at checkout and we will
            include it on a card with the parcel. No prices appear on anything inside a gifted order.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Not sure of the size?</h2>
          <p>
            Use <strong>Drop a Hint</strong> on any product page to send a tasteful message to
            someone who might gift it to you — or share a piece directly so they can choose the size
            and colour themselves.
          </p>
        </section>
      </div>
    </main>
  );
}
