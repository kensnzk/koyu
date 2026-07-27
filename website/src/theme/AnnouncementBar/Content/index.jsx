import React from 'react';
import clsx from 'clsx';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import styles from './styles.module.css';

const copy = {
  ja: {
    body: 'Koyuは、個人で進めている探索的なプロジェクトです。精度や品質には発展途上の部分があります。完成品ではなく、開かれた実験として見守っていただければ幸いです。',
    support: 'プロジェクトを支援する',
    status: '支援方法は準備中',
  },
  en: {
    body: 'Koyu is an independently developed, exploratory project. Its accuracy and quality are still evolving. Please regard it as an open experiment rather than a finished product.',
    support: 'Support the project',
    status: 'Support options are coming soon',
  },
};

export default function AnnouncementBarContent({className}) {
  const {i18n} = useDocusaurusContext();
  const text = copy[i18n.currentLocale === 'en' ? 'en' : 'ja'];

  return (
    <div className={clsx(styles.notice, className)}>
      <span>{text.body}</span>
      <span className={styles.support}>
        <a
          href="https://github.com/kensnzk/koyu/discussions"
          rel="noreferrer"
          target="_blank">
          {text.support}
          <span aria-hidden="true">↗</span>
        </a>
        <span className={styles.status}>{text.status}</span>
      </span>
    </div>
  );
}
