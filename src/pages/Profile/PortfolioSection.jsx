import styles from './PortfolioSection.module.css'

export default function PortfolioSection({ items }) {
  return (
    <div className={styles.grid}>
      {items.map((item) => (
        <div key={item.id} className={styles.card}>
          <div className={styles.thumb}>
            {item.thumbnail ? (
              <img src={item.thumbnail} alt="" className={styles.thumbImg} />
            ) : (
              <span className={styles.thumbPlaceholder} aria-hidden="true">
                {item.category ? item.category[0] : '✦'}
              </span>
            )}
          </div>
          <div className={styles.body}>
            <p className={styles.category}>{item.category}</p>
            <p className={styles.title}>{item.title}</p>
            <p className={styles.description}>{item.description}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
