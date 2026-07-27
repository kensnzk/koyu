import React from 'react';
import clsx from 'clsx';
import {ThemeClassNames, useThemeConfig} from '@docusaurus/theme-common';
import {useAnnouncementBar} from '@docusaurus/theme-common/internal';
import AnnouncementBarCloseButton from '@theme/AnnouncementBar/CloseButton';
import AnnouncementBarContent from '@theme/AnnouncementBar/Content';
import styles from './styles.module.css';

export default function AnnouncementBar() {
  const {announcementBar} = useThemeConfig();
  const {isActive, close} = useAnnouncementBar();

  if (!isActive) return null;

  const {backgroundColor, textColor, isCloseable} = announcementBar;

  return (
    <div
      className={clsx(
        ThemeClassNames.announcementBar.container,
        styles.announcementBar,
      )}
      role="banner"
      style={{backgroundColor, color: textColor}}>
      {isCloseable && <div className={styles.placeholder} />}
      <AnnouncementBarContent className={styles.content} />
      {isCloseable && (
        <AnnouncementBarCloseButton
          className={styles.close}
          onClick={close}
        />
      )}
    </div>
  );
}
